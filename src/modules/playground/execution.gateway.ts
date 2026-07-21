import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { promises as fs, existsSync } from 'fs';
import { join, dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ExecutionService } from './execution.service';

interface RunningSession {
  process: ChildProcessWithoutNullStreams;
  sessionDir: string;
}

interface RuntimeConfig {
  directCommand: string;
  extension: string;
  compileCommand?: string;
}

/** Resolve `tsx` by absolute path next to the backend's own node_modules
 *  instead of a bare command name — a bare `tsx` depends on the PATH
 *  inherited by the pm2-managed process, which on the VPS doesn't
 *  necessarily include wherever a global `tsx` install would live. */
const LOCAL_TSX_BIN = join(process.cwd(), 'node_modules', '.bin', 'tsx');
const TSX_COMMAND = existsSync(LOCAL_TSX_BIN) ? LOCAL_TSX_BIN : 'tsx';

const RUNTIMES: Record<string, RuntimeConfig> = {
  javascript: { directCommand: 'node',       extension: '.js' },
  typescript: { directCommand: TSX_COMMAND,  extension: '.ts' },
  nestjs:     { directCommand: TSX_COMMAND,  extension: '.ts' },
  python:     { directCommand: 'python3',    extension: '.py' },
  kotlin:     { directCommand: 'kotlin',     extension: '.kt', compileCommand: 'kotlinc' },
  java:       { directCommand: 'java',       extension: '.java', compileCommand: 'javac' },
  dart:       { directCommand: 'dart',       extension: '.dart' },
  r:          { directCommand: 'Rscript',    extension: '.R' },
};

/** Packages installed globally on the host that a Vitest run needs.
 *  They are symlinked into the session's node_modules (see linkTestModules)
 *  so Vite/Vitest's own resolver finds them without relying on NODE_PATH. */
const TEST_GLOBAL_PACKAGES = [
  'vitest',
  'vite',
  '@vitejs/plugin-react',
  'react',
  'react-dom',
  '@testing-library/react',
  '@testing-library/jest-dom',
  'jsdom',
];

const VITE_TEST_CONFIG = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
});
`;

const VITEST_SETUP = `import '@testing-library/jest-dom';\n`;

/** Packages required by a NestJS app that are ALREADY dependencies of this very
 *  backend (personal-page-backend). Instead of installing them again, we
 *  symlink them straight from this project's own node_modules so a session's
 *  `tsx`/Jest run resolves `@nestjs/*` (and its transitive deps) correctly. */
const NEST_LOCAL_PACKAGES = [
  '@nestjs/common',
  '@nestjs/core',
  '@nestjs/testing',
  '@nestjs/platform-express',
  'reflect-metadata',
  'rxjs',
];

/** Packages installed globally on the host that a Jest run for NestJS needs. */
const NEST_GLOBAL_TEST_PACKAGES = ['jest', 'ts-jest', 'supertest'];

/** tsconfig.json shared by NestJS "Ejecutar" (tsx) and "Ejecutar tests" (ts-jest) runs.
 *  - experimentalDecorators/emitDecoratorMetadata: required by Nest's decorators.
 *  - isolatedModules: must live here (not as a deprecated ts-jest option).
 *  - ignoreDeprecations "6.0": the globally-installed ts-jest may bundle a very
 *    recent TypeScript that hard-errors on the legacy `moduleResolution` default. */
const DECORATOR_TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2021",
    "module": "commonjs",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "isolatedModules": true,
    "ignoreDeprecations": "6.0",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": false
  }
}
`;

const JEST_CONFIG = `module.exports = {
  testEnvironment: 'node',
  transform: { '^.+\\\\.ts$': 'ts-jest' },
  testRegex: '.*spec\\\\.ts$',
  setupFiles: ['./jest.setup.ts'],
};
`;

const JEST_SETUP = `import 'reflect-metadata';\n`;

@WebSocketGateway({
  cors: {
    origin: process.env.APP_ORIGINS?.split(',') ?? ['http://localhost:5173'],
    credentials: true,
  },
  namespace: '/execution',
  // Allow payloads up to 10 MB so that uploaded data files (CSV, JSON, TXT…)
  // can be sent together with source files without being rejected.
  maxHttpBufferSize: 10 * 1024 * 1024,
})
export class ExecutionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly TEMP_DIR = '/tmp/playground';
  private readonly KOTLIN_CACHE_DIR = '/tmp/playground-kotlin-cache';
  private readonly KOTLIN_CDS_ARCHIVE = '/opt/kotlin-cds/kotlin.jsa';
  private readonly READLINE_SYNC_SHIM = join(__dirname, 'readline-sync-shim.js');
  private readonly sessions = new Map<string, RunningSession>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly executionService: ExecutionService,
  ) {
    fs.mkdir(this.KOTLIN_CACHE_DIR, { recursive: true }).catch(() => {});
    // Pre-warm the kotlinc daemon so the first student compile doesn't pay cold-start
    spawn('sh', ['-c', 'kotlinc -version 2>/dev/null'], { stdio: 'ignore' }).unref();
  }

  /** Validate JWT from the httpOnly "jwt" cookie on the upgrade handshake */
  handleConnection(client: Socket) {
    const cookieHeader = client.handshake.headers.cookie ?? '';
    const jwtCookie = cookieHeader.split(';').find((c) => c.trim().startsWith('jwt='));
    const token = jwtCookie?.split('=').slice(1).join('=').trim();

    if (!token) {
      client.disconnect();
      return;
    }
    try {
      this.jwtService.verify(token);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.killSession(client.id);
  }

  // ── start_execution ────────────────────────────────────────────────────────

  @SubscribeMessage('start_execution')
  async handleStartExecution(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { language: string; files: { name: string; path?: string; content: string }[]; targetFile?: string },
  ) {
    // Kill any existing session for this client before starting a new one
    this.killSession(client.id);

    const lang = (payload?.language ?? '').toLowerCase();
    const runtime = RUNTIMES[lang];

    if (!runtime) {
      client.emit('terminal_output', `\x1b[31mLenguaje no soportado: ${payload?.language}\x1b[0m\r\n`);
      client.emit('execution_done', { code: 1 });
      return;
    }

    const sessionId = uuidv4();
    const sessionDir = join(this.TEMP_DIR, sessionId);

    try {
      await fs.mkdir(sessionDir, { recursive: true });

      const validFiles = (payload.files ?? []).filter((f) => f.content.trim() !== '');
      if (validFiles.length === 0) {
        client.emit('terminal_output', `\x1b[31mNo hay archivos con contenido para ejecutar.\x1b[0m\r\n`);
        client.emit('execution_done', { code: 1 });
        await this.cleanupDir(sessionDir);
        return;
      }

      // Preserve each file's folder `path` (when present) so multi-file
      // projects with relative imports (e.g. NestJS's src/*.ts) resolve
      // correctly. Falls back to the flat `name` for single-file languages,
      // which keeps existing behavior unchanged.
      const fileRelPath = (file: { name: string; path?: string }): string => {
        const raw = file.path && file.path.trim() !== '' ? file.path : file.name;
        return raw.includes('.') ? raw : raw + runtime.extension;
      };

      for (const file of validFiles) {
        const fullPath = join(sessionDir, fileRelPath(file));
        await fs.mkdir(dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, file.content);
      }

      const targetEntry =
        (payload.targetFile ? validFiles.find((f) => f.name === payload.targetFile) : undefined)
          ?? validFiles.find((f) => f.name.endsWith(runtime.extension))
          ?? validFiles[0];

      const mainFile = fileRelPath(targetEntry);
      const allFileNames = validFiles.map(fileRelPath);

      const shellCmd = lang === 'kotlin'
        ? await this.buildKotlinCommand(sessionDir, mainFile, allFileNames, validFiles)
        : this.buildShellCommand(lang, mainFile, allFileNames, runtime);

      // Inject NODE_PATH for JS/TS so global modules (like readline-sync) are resolved
      let execEnv: NodeJS.ProcessEnv = { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '1' };
      if (lang === 'javascript' || lang === 'typescript') {
        const globalModules = await this.executionService.getGlobalNodeModules();
        if (globalModules) {
          execEnv = { ...execEnv, NODE_PATH: globalModules };
        }

        // Inject a readline-sync shim into session's node_modules.
        // The real readline-sync opens /dev/tty directly which fails in
        // non-TTY environments. Our shim reads from stdin (fd 0) instead,
        // which works with the WebSocket-piped input.
        await this.injectReadlineSyncShim(sessionDir);
      } else if (lang === 'nestjs') {
        // tsx needs a nearby tsconfig.json with experimentalDecorators/
        // emitDecoratorMetadata to compile Nest's @Injectable/@Controller
        // decorators, and @nestjs/* must resolve from this very backend's
        // own node_modules (no extra global install required).
        await fs.writeFile(join(sessionDir, 'tsconfig.json'), DECORATOR_TSCONFIG);
        const nodeModulesDir = join(sessionDir, 'node_modules');
        await fs.mkdir(nodeModulesDir, { recursive: true });
        for (const pkg of NEST_LOCAL_PACKAGES) {
          const dir = this.resolveLocalPackageDir(pkg);
          if (dir) {
            await this.symlinkPackage(dir, join(nodeModulesDir, pkg));
          }
        }
      }

      this.spawnAndStream(client, sessionDir, shellCmd, execEnv);
    } catch (err: any) {
      client.emit('terminal_output', `\x1b[31mError iniciando ejecución: ${err.message}\x1b[0m\r\n`);
      client.emit('execution_done', { code: 1 });
      await this.cleanupDir(sessionDir);
    }
  }

  // ── start_test_execution (Vitest para React, Jest para NestJS) ─────────────

  @SubscribeMessage('start_test_execution')
  async handleStartTestExecution(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { files: { name: string; path: string; content: string }[]; language?: string },
  ) {
    this.killSession(client.id);

    const language = (payload?.language ?? 'react').toLowerCase();
    const sessionId = uuidv4();
    const sessionDir = join(this.TEMP_DIR, sessionId);

    try {
      await fs.mkdir(sessionDir, { recursive: true });

      const validFiles = (payload.files ?? []).filter((f) => f.content.trim() !== '');
      if (validFiles.length === 0) {
        client.emit('terminal_output', `\x1b[31mNo hay archivos con contenido para ejecutar.\x1b[0m\r\n`);
        client.emit('execution_done', { code: 1 });
        await this.cleanupDir(sessionDir);
        return;
      }

      for (const file of validFiles) {
        const relativePath = file.path && file.path.trim() !== '' ? file.path : file.name;
        const fullPath = join(sessionDir, relativePath);
        await fs.mkdir(dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, file.content);
      }

      let shellCmd: string;
      if (language === 'nestjs') {
        await fs.writeFile(join(sessionDir, 'tsconfig.json'), DECORATOR_TSCONFIG);
        await fs.writeFile(join(sessionDir, 'jest.config.js'), JEST_CONFIG);
        await fs.writeFile(join(sessionDir, 'jest.setup.ts'), JEST_SETUP);
        shellCmd = './node_modules/.bin/jest --config jest.config.js';
      } else {
        await fs.writeFile(join(sessionDir, 'vite.config.ts'), VITE_TEST_CONFIG);
        await fs.writeFile(join(sessionDir, 'vitest.setup.ts'), VITEST_SETUP);
        shellCmd = './node_modules/.bin/vitest run --reporter=verbose';
      }
      await this.linkTestModules(sessionDir, language);

      const execEnv: NodeJS.ProcessEnv = { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '1' };

      this.spawnAndStream(client, sessionDir, shellCmd, execEnv);
    } catch (err: any) {
      client.emit('terminal_output', `\x1b[31mError iniciando los tests: ${err.message}\x1b[0m\r\n`);
      client.emit('execution_done', { code: 1 });
      await this.cleanupDir(sessionDir);
    }
  }

  // ── terminal_input ────────────────────────────────────────────────────────

  @SubscribeMessage('terminal_input')
  handleTerminalInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: string,
  ) {
    const session = this.sessions.get(client.id);
    if (session?.process?.stdin?.writable) {
      session.process.stdin.write(data);
    }
  }

  // ── stop_execution ─────────────────────────────────────────────────────────

  @SubscribeMessage('stop_execution')
  handleStopExecution(@ConnectedSocket() client: Socket) {
    this.killSession(client.id);
    client.emit('execution_done', { code: -1, killed: true });
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Derive the Kotlin entry class name from a file name.
   *  "calculadora.kt" → "CalculadoraKt", "my_util.kt" → "MyUtilKt" */
  private kotlinClassName(fileName: string): string {
    return fileName
      .replace('.kt', '')
      .replace(/[-_](.)/g, (_: string, c: string) => c.toUpperCase())
      .replace(/^(.)/, (c: string) => c.toUpperCase())
      + 'Kt';
  }

  /** Build (and cache) the Kotlin compile+run command.
   *  Cache key = SHA-256 of all .kt file contents sorted by name.
   *  Cache hit  → skip kotlinc entirely; just run the cached JAR.
   *  Cache miss → compile (no -include-runtime, stdlib already on kotlin classpath),
   *               copy tiny JAR to cache, then run.
   *
   *  JVM flags:
   *    -XX:TieredStopAtLevel=1  — skip C2 JIT, faster startup for short-lived processes
   *    -Xss256k                 — smaller stack (enough for typical student programs) */
  private async buildKotlinCommand(
    sessionDir: string,
    mainFile: string,
    _allFileNames: string[],
    ktSources: { name: string; content: string }[],
  ): Promise<string> {
    // Compile ONLY the target file — compiling all files together means that
    // a syntax error in any other file blocks every run, even unrelated ones.
    const className = this.kotlinClassName(mainFile);
    const localJar  = mainFile.replace('.kt', '.jar');

    // JVM flags forwarded to both kotlinc and kotlin via -J prefix
    const cdsFlags = existsSync(this.KOTLIN_CDS_ARCHIVE)
      ? `-J-Xshare:on -J-XX:SharedArchiveFile=${this.KOTLIN_CDS_ARCHIVE}`
      : '';
    const runFlags  = [`-J-XX:TieredStopAtLevel=1`, `-J-Xss512k`, cdsFlags].filter(Boolean).join(' ');
    const compFlags = '-J-XX:TieredStopAtLevel=1';

    // Guarantee the cache dir exists (gets wiped on reboot since it's in /tmp)
    await fs.mkdir(this.KOTLIN_CACHE_DIR, { recursive: true }).catch(() => {});

    // Cache key: target file name + content only.
    // Failed compiles never produce a cached JAR because the cp only runs
    // after a successful (&&-chained) kotlinc.
    const targetSource = ktSources.find((f) => f.name === mainFile);
    const hash = createHash('sha256');
    hash.update(mainFile + '\0' + (targetSource?.content ?? ''));
    const cacheKey  = hash.digest('hex');
    const cachedJar = join(this.KOTLIN_CACHE_DIR, `${cacheKey}.jar`);

    try {
      await fs.access(cachedJar); // throws if not found
      // Cache HIT — skip compilation entirely
      return `kotlin ${runFlags} -cp "${cachedJar}" ${className}`;
    } catch {
      // Cache MISS — compile then run.
      // The cp is wrapped with `|| true` so that a cache-write failure
      // (permissions, disk full, dir missing) never blocks the kotlin run.
      return (
        `kotlinc ${compFlags} "${mainFile}" -d "${localJar}" 2>&1 && ` +
        `(cp "${localJar}" "${cachedJar}" 2>/dev/null || true) && ` +
        `kotlin ${runFlags} -cp "${localJar}" ${className}`
      );
    }
  }

  /** Build the shell command (single string passed to `sh -c`). For compiled
   *  languages (Kotlin, Java) the compile + run steps are chained with `&&`
   *  so the compilation output is streamed before the program starts.
   *  For Kotlin, all .kt files are compiled together so multi-file projects work. */
  private buildShellCommand(
    language: string,
    mainFile: string,
    _allFileNames: string[],
    runtime: RuntimeConfig,
  ): string {
    if (language === 'java') {
      const cls = mainFile.replace('.java', '');
      return `javac "${mainFile}" && java "${cls}"`;
    }
    // File paths use a virtual project-root convention where top-level files
    // are stored as "/name.ts" — that leading "/" is NOT a filesystem-root
    // path, it's relative to the session dir. Passed as-is (or as a bare
    // filename) to tsx, its ESM loader resolves it as an absolute/import
    // specifier instead of relative to cwd ("Cannot find module '/main.ts'").
    // Strip any leading slashes and force it to be unambiguously relative.
    const entryArg = `./${mainFile.replace(/^\/+/, '')}`;
    return `${runtime.directCommand} "${entryArg}"`;
  }

  /**
   * Place a readline-sync shim in session's node_modules so that
   * `require('readline-sync')` resolves our stdin-based implementation
   * before the global TTY-based one.
   */
  private async injectReadlineSyncShim(sessionDir: string): Promise<void> {
    const shimDir = join(sessionDir, 'node_modules', 'readline-sync');
    await fs.mkdir(shimDir, { recursive: true });
    await fs.copyFile(this.READLINE_SYNC_SHIM, join(shimDir, 'index.js'));
  }

  /** Symlink `target` at `linkPath`, creating any needed parent dirs first.
   *  Silently ignores failures (already exists / missing target) — callers
   *  treat this as best-effort, same as the pre-refactor inline try/catch. */
  private async symlinkPackage(target: string, linkPath: string, type: 'dir' | 'file' = 'dir'): Promise<void> {
    try {
      await fs.mkdir(dirname(linkPath), { recursive: true });
      await fs.symlink(target, linkPath, type);
    } catch {
      /* already exists or target missing — ignore */
    }
  }

  /** Resolve a package's real directory from THIS backend's own
   *  node_modules (works in dev via ts-node AND in the compiled dist/ build,
   *  since require.resolve walks up from the current file to find the real
   *  node_modules tree). Returns null if the package can't be found. */
  private resolveLocalPackageDir(pkg: string): string | null {
    try {
      const pkgJsonPath = require.resolve(join(pkg, 'package.json'));
      return dirname(pkgJsonPath);
    } catch {
      return null;
    }
  }

  /** ts-jest internally does `require('jest-util')`, which only resolves if
   *  jest-util exists as a SIBLING inside the global node_modules directory
   *  (Node resolves modules by realpath, not by where we symlink them per
   *  session). Jest nests jest-util inside jest/node_modules/jest-util, so
   *  this self-heals by lazily creating that sibling symlink once — no
   *  manual VPS step beyond `npm install -g jest ts-jest supertest`. */
  private async ensureJestUtilGlobalLink(globalModules: string): Promise<void> {
    const linkPath = join(globalModules, 'jest-util');
    if (existsSync(linkPath)) return;
    const target = join(globalModules, 'jest', 'node_modules', 'jest-util');
    if (!existsSync(target)) return;
    await this.symlinkPackage(target, linkPath);
  }

  /**
   * Symlink the packages a test run needs into the session's node_modules so
   * the runner's own resolver finds them via standard node_modules lookup
   * (NODE_PATH is not reliably honored by Vite/Vitest/Jest).
   *
   *  - React (Vitest): globally-installed Vitest/Vite/React/Testing-Library.
   *  - NestJS (Jest):   @nestjs/* etc. straight from THIS backend's own
   *                     node_modules (already a real dependency of this
   *                     app), plus globally-installed jest/ts-jest/supertest.
   */
  private async linkTestModules(sessionDir: string, language: string): Promise<void> {
    const nodeModulesDir = join(sessionDir, 'node_modules');
    await fs.mkdir(nodeModulesDir, { recursive: true });
    const binDir = join(nodeModulesDir, '.bin');
    await fs.mkdir(binDir, { recursive: true });

    if (language === 'nestjs') {
      for (const pkg of NEST_LOCAL_PACKAGES) {
        const dir = this.resolveLocalPackageDir(pkg);
        if (dir) {
          await this.symlinkPackage(dir, join(nodeModulesDir, pkg));
        }
      }

      const globalModules = await this.executionService.getGlobalNodeModules();
      if (globalModules) {
        for (const pkg of NEST_GLOBAL_TEST_PACKAGES) {
          await this.symlinkPackage(join(globalModules, pkg), join(nodeModulesDir, pkg));
        }
        await this.ensureJestUtilGlobalLink(globalModules);
        await this.symlinkPackage(join(globalModules, 'jest', 'bin', 'jest.js'), join(binDir, 'jest'), 'file');
      }
      return;
    }

    // React / Vitest (default)
    const globalModules = await this.executionService.getGlobalNodeModules();
    if (!globalModules) return;

    for (const pkg of TEST_GLOBAL_PACKAGES) {
      await this.symlinkPackage(join(globalModules, pkg), join(nodeModulesDir, pkg));
    }

    await this.symlinkPackage(join(globalModules, 'vitest', 'vitest.mjs'), join(binDir, 'vitest'), 'file');
  }

  /** Spawn the given shell command in sessionDir, streaming stdout/stderr to
   *  the client and emitting `execution_done` on exit. Shared by both plain
   *  code execution and Vitest test runs. */
  private spawnAndStream(
    client: Socket,
    sessionDir: string,
    shellCmd: string,
    execEnv: NodeJS.ProcessEnv,
  ) {
    const child = spawn('sh', ['-c', shellCmd], {
      cwd: sessionDir,
      env: execEnv,
    });

    this.sessions.set(client.id, { process: child, sessionDir });

    child.stdout.on('data', (data: Buffer) => {
      client.emit('terminal_output', data.toString());
    });

    child.stderr.on('data', (data: Buffer) => {
      client.emit('terminal_output', data.toString());
    });

    child.on('close', (code: number | null) => {
      client.emit('execution_done', { code: code ?? 0 });
      this.cleanupSession(client.id, sessionDir);
    });

    child.on('error', (err: Error) => {
      client.emit('terminal_output', `\x1b[31mError del proceso: ${err.message}\x1b[0m\r\n`);
      client.emit('execution_done', { code: 1 });
      this.cleanupSession(client.id, sessionDir);
    });
  }

  private killSession(clientId: string) {
    const session = this.sessions.get(clientId);
    if (!session) return;
    try { session.process.kill('SIGTERM'); } catch { /* already dead */ }
    this.sessions.delete(clientId);
    this.cleanupDir(session.sessionDir);
  }

  private cleanupSession(clientId: string, sessionDir: string) {
    this.sessions.delete(clientId);
    this.cleanupDir(sessionDir);
  }

  private async cleanupDir(dir: string) {
    try { await fs.rm(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}
