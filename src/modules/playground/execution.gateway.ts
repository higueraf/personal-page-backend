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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExecutionService } from './execution.service';
import { PlaygroundProject } from '../../entities/playground-project.entity';

interface RunningSession {
  process: ChildProcessWithoutNullStreams;
  sessionDir: string;
  /** Corta la ejecución si se pasa de `EXEC_TIMEOUT_MS`. Se limpia al terminar. */
  temporizador: NodeJS.Timeout;
}

/** Ejecución que llegó con el servidor lleno y espera turno (ver `MAX_CONCURRENT`). */
interface EjecucionEnCola {
  clientId: string;
  sessionDir: string;
  arrancar: () => void;
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

/** Same rationale as TSX_COMMAND above, for the NestJS "Ejecutar tests" (Jest) run:
 *  resolve the binary by absolute path from this backend's own node_modules
 *  instead of depending on a global `jest` install being present/on PATH. */
const LOCAL_JEST_BIN = join(process.cwd(), 'node_modules', '.bin', 'jest');
const JEST_COMMAND = existsSync(LOCAL_JEST_BIN) ? LOCAL_JEST_BIN : 'jest';

/** Same rationale as JEST_COMMAND above, for the React "Ejecutar tests" (Vitest) run:
 *  resolve the binary by absolute path from this backend's own node_modules
 *  instead of depending on a global `vitest` install being present/on PATH. */
const LOCAL_VITEST_BIN = join(process.cwd(), 'node_modules', '.bin', 'vitest');
const VITEST_COMMAND = existsSync(LOCAL_VITEST_BIN) ? LOCAL_VITEST_BIN : 'vitest';

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

/** Packages required by a React/Vitest run that are ALREADY dependencies of
 *  this very backend (personal-page-backend). Same rationale as
 *  NEST_LOCAL_PACKAGES below: this used to rely on a global npm install
 *  (`npm install -g vitest vite react ...`) on the host, which is fragile —
 *  a missing/mismatched global install produces the same kind of
 *  "not found" failure that once broke Jest runs. They're real
 *  devDependencies of this backend, so symlinking them from here makes
 *  resolution deterministic on any host. */
const REACT_LOCAL_PACKAGES = [
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
 *  `tsx`/Jest run resolves `@nestjs/*` (and its transitive deps) correctly.
 *
 *  `typescript`, `jest`, `ts-jest` and `supertest` live here too (this used to
 *  rely on a global `npm install -g jest ts-jest supertest typescript` on the
 *  host, which is fragile: whether that install nests matching versions, or
 *  even exists at all on a given VPS, is host-dependent — e.g. a missing
 *  global `jest` produces "./node_modules/.bin/jest: not found" for every
 *  "Ejecutar tests" run). They're real devDependencies of this backend, so
 *  symlinking them from here makes resolution deterministic on any host. */
const NEST_LOCAL_PACKAGES = [
  '@nestjs/common',
  '@nestjs/core',
  '@nestjs/testing',
  '@nestjs/platform-express',
  'reflect-metadata',
  'rxjs',
  'typescript',
  'jest',
  'ts-jest',
  'supertest',
];

/** tsconfig.json shared by NestJS "Ejecutar" (tsx) and "Ejecutar tests" (ts-jest) runs.
 *  - experimentalDecorators/emitDecoratorMetadata: required by Nest's decorators.
 *  - isolatedModules: must live here (not as a deprecated ts-jest option).
 *  `typescript` is always this backend's own pinned devDependency (symlinked via
 *  NEST_LOCAL_PACKAGES), so there's no more "some other, newer TypeScript might get
 *  resolved" case to guard against with `ignoreDeprecations`. */
const DECORATOR_TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2021",
    "module": "commonjs",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "isolatedModules": true,
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
  /** Archivo CDS de la JVM: acelera el arranque del compilador. Lo genera una build concreta de
   *  HotSpot, así que una actualización del paquete openjdk lo invalida; por eso se pasa con
   *  `-Xshare:auto`, que lo descarta en silencio en vez de impedir el arranque. Para regenerarlo
   *  en el servidor después de actualizar el JDK:
   *    kotlinc -J-XX:ArchiveClassesAtExit=/opt/kotlin-cds/kotlin.jsa <cualquier.kt> -d /tmp/x.jar
   */
  private readonly KOTLIN_CDS_ARCHIVE = '/opt/kotlin-cds/kotlin.jsa';
  private readonly READLINE_SYNC_SHIM = join(__dirname, 'readline-sync-shim.js');
  private readonly sessions = new Map<string, RunningSession>();

  /** Ejecuciones simultáneas permitidas en todo el servidor. Cada compilación de Kotlin levanta
   *  una JVM de varios cientos de MB; sin tope, un examen con 20 alumnos ejecutando a la vez
   *  comprometía más memoria que la que tiene la máquina y el servidor se hundía en swap —
   *  nadie terminaba, todos reintentaban y la cosa se realimentaba. Ajustable sin desplegar. */
  private readonly MAX_CONCURRENT = Number(process.env.PLAYGROUND_MAX_CONCURRENT ?? 2);

  /** Tope de vida de una ejecución. Generoso a propósito: los programas pueden quedarse
   *  legítimamente esperando `readLine()` del alumno, así que esto no es un límite de cómputo
   *  sino una red de seguridad contra procesos que ya no van a terminar nunca. */
  private readonly EXEC_TIMEOUT_MS = Number(process.env.PLAYGROUND_EXEC_TIMEOUT_MS ?? 10 * 60_000);

  private readonly cola: EjecucionEnCola[] = [];

  constructor(
    private readonly jwtService: JwtService,
    private readonly executionService: ExecutionService,
    @InjectRepository(PlaygroundProject)
    private readonly projectRepo: Repository<PlaygroundProject>,
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

  /** Blocks execution when the project was auto-locked after too many real
   *  security incidents (see `logCheat` in playground.service.ts). Returns
   *  `true` if execution should be blocked (and already emitted the error). */
  private async isBlockedBySecurityLock(client: Socket, projectId?: string): Promise<boolean> {
    if (!projectId) return false;
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (project?.security_locked) {
      client.emit(
        'terminal_output',
        `\x1b[31mEditor bloqueado por múltiples incidentes de seguridad. Contacta a tu profesor.\x1b[0m\r\n`,
      );
      client.emit('execution_done', { code: 1 });
      return true;
    }
    return false;
  }

  // ── start_execution ────────────────────────────────────────────────────────

  @SubscribeMessage('start_execution')
  async handleStartExecution(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { language: string; files: { name: string; path?: string; content: string }[]; targetFile?: string; projectId?: string },
  ) {
    if (await this.isBlockedBySecurityLock(client, payload?.projectId)) return;

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

      // A NestJS .spec.ts run through the plain "Ejecutar" (tsx) path has no
      // Jest globals (describe/it/expect) and always crashes. Defense in depth
      // in case a client ever sends one here (frontend already reroutes this
      // itself): fall back to the same Jest run as "Ejecutar tests".
      if (lang === 'nestjs' && /\.(spec|test)\.ts$/.test(targetEntry.name)) {
        await this.cleanupDir(sessionDir);
        await this.handleStartTestExecution(client, { files: payload.files, language: lang });
        return;
      }

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
    @MessageBody() payload: { files: { name: string; path?: string; content: string }[]; language?: string; projectId?: string },
  ) {
    if (await this.isBlockedBySecurityLock(client, payload?.projectId)) return;

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
        shellCmd = `${JEST_COMMAND} --config jest.config.js`;
      } else {
        await fs.writeFile(join(sessionDir, 'vite.config.ts'), VITE_TEST_CONFIG);
        await fs.writeFile(join(sessionDir, 'vitest.setup.ts'), VITEST_SETUP);
        shellCmd = `${VITEST_COMMAND} run --reporter=verbose`;
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

  /** Nombre de la clase JVM que kotlinc genera para un archivo .kt sin `package`:
   *  el nombre base del archivo con los caracteres que no valen en un identificador JVM
   *  reemplazados por "_", un "_" delante si empieza con dígito, la primera letra en
   *  mayúscula y el sufijo "Kt".
   *  "main.kt" → "MainKt", "ejercicio-1.kt" → "Ejercicio_1Kt", "my_util.kt" → "My_utilKt",
   *  "mi.archivo.kt" → "Mi_archivoKt", "1ejercicio.kt" → "_1ejercicioKt".
   *  Ojo: kotlinc NO convierte "my_util" a camelCase — deja el "_" tal cual. */
  private kotlinClassName(fileName: string): string {
    const base = fileName.replace(/^.*\//, '').replace(/\.kt$/, '');
    const identificador = base.replace(/[^A-Za-z0-9_]/g, '_');
    return (/^\d/.test(identificador) ? '_' + identificador : identificador)
      .replace(/^([a-z])/, (c: string) => c.toUpperCase())
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
    ktSources: { name: string; path?: string; content: string }[],
  ): Promise<string> {
    // Compile ONLY the target file — compiling all files together means that
    // a syntax error in any other file blocks every run, even unrelated ones.
    //
    // Los paths usan la convención de raíz virtual del proyecto ("/ejercicio-1.kt"): esa barra
    // inicial NO es la raíz del sistema de archivos, es relativa al directorio de la sesión.
    // kotlinc la toma como ruta absoluta y responde "source file or directory not found", así
    // que se normaliza igual que en `buildShellCommand`.
    const relFile   = mainFile.replace(/^\/+/, '');
    const className = this.kotlinClassName(relFile);
    const localJar  = relFile.replace(/\.kt$/, '.jar');

    // JVM flags forwarded to both kotlinc and kotlin via -J prefix.
    //
    // `-Xshare:auto` y no `:on`: el archivo CDS lo genera una build concreta de HotSpot, así que
    // cualquier actualización del paquete openjdk del servidor lo invalida. Con `:on` eso es un
    // error fatal ("The shared archive file was created by a different version or build of
    // HotSpot") y la JVM ni siquiera arranca: el alumno compila bien y el programa muere al
    // ejecutarse. Con `:auto` la JVM lo descarta en silencio —sin una línea en stderr— y corre
    // sin compartir clases, que a lo sumo cuesta ~0.1 s de arranque.
    const cdsFlags = existsSync(this.KOTLIN_CDS_ARCHIVE)
      ? `-J-Xshare:auto -J-XX:SharedArchiveFile=${this.KOTLIN_CDS_ARCHIVE}`
      : '';
    const runFlags  = [`-J-XX:TieredStopAtLevel=1`, `-J-Xss512k`, cdsFlags].filter(Boolean).join(' ');
    // El wrapper de kotlinc arranca por defecto con -Xms128M -Xmx512M. Para estos ejercicios
    // sobra con mucho menos, y lo que importa es el heap COMPROMETIDO: con varias compilaciones
    // a la vez, 128 MB iniciales cada una agotaban la RAM de la máquina antes de empezar.
    // Verificado compilando los ejercicios del examen con este tope.
    // El CDS también en la compilación, que es el paso caro: arrancar el compilador domina los
    // ~5 s de un kotlinc. Medido en el VPS sobre 5 vueltas alternadas: mediana 4.85 s sin archivo
    // y 3.82 s con él (-21%). El paso de ejecución ya costaba 0.25 s, así que ahí aportaba poco.
    const compFlags = ['-J-XX:TieredStopAtLevel=1', '-J-Xms32m', '-J-Xmx256m', cdsFlags]
      .filter(Boolean).join(' ');

    // Guarantee the cache dir exists (gets wiped on reboot since it's in /tmp)
    await fs.mkdir(this.KOTLIN_CACHE_DIR, { recursive: true }).catch(() => {});

    // Cache key: target file name + content only.
    // Failed compiles never produce a cached JAR because the cp only runs
    // after a successful (&&-chained) kotlinc.
    //
    // El contenido es parte imprescindible de la clave: la búsqueda se hace contra el path
    // normalizado (y el nombre como respaldo) porque `mainFile` llega con la barra inicial y
    // `name` no. Si no se encuentra la fuente se corre SIN caché: con la clave calculada sobre
    // un contenido vacío, dos alumnos con distinto "ejercicio-1.kt" compartirían entrada y el
    // segundo ejecutaría el JAR del primero.
    const targetSource =
      ktSources.find((f) => (f.path ?? f.name).replace(/^\/+/, '') === relFile)
      ?? ktSources.find((f) => f.name === relFile);

    const compilarYCorrer = (guardarEnCache?: string) =>
      `kotlinc ${compFlags} "./${relFile}" -d "${localJar}" 2>&1 && ` +
      // El cp va con `|| true` para que un fallo de escritura en caché (permisos, disco
      // lleno, directorio ausente) nunca impida correr el programa.
      (guardarEnCache ? `(cp "${localJar}" "${guardarEnCache}" 2>/dev/null || true) && ` : '') +
      `kotlin ${runFlags} -cp "${localJar}" ${className}`;

    if (!targetSource) return compilarYCorrer();

    const hash = createHash('sha256');
    hash.update(relFile + '\0' + targetSource.content);
    const cacheKey  = hash.digest('hex');
    const cachedJar = join(this.KOTLIN_CACHE_DIR, `${cacheKey}.jar`);

    try {
      await fs.access(cachedJar); // throws if not found
      // Cache HIT — skip compilation entirely
      return `kotlin ${runFlags} -cp "${cachedJar}" ${className}`;
    } catch {
      return compilarYCorrer(cachedJar);
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
      return dirname(require.resolve(join(pkg, 'package.json')));
    } catch {
      // Some packages (e.g. reflect-metadata) declare an "exports" map that
      // doesn't expose "./package.json" as a subpath, so the lookup above
      // throws ERR_PACKAGE_PATH_NOT_EXPORTED even though the package itself
      // resolves fine. Fall back to resolving its main entry file and
      // walking up to the nearest ancestor directory that has a package.json.
      try {
        let dir = dirname(require.resolve(pkg));
        while (dir !== dirname(dir)) {
          if (existsSync(join(dir, 'package.json'))) return dir;
          dir = dirname(dir);
        }
        return null;
      } catch {
        return null;
      }
    }
  }

  /**
   * Symlink the packages a test run needs into the session's node_modules so
   * the runner's own resolver finds them via standard node_modules lookup
   * (NODE_PATH is not reliably honored by Vite/Vitest/Jest).
   *
   *  - React (Vitest): @vitejs/plugin-react, react, testing-library, etc. all
   *                     straight from THIS backend's own node_modules (real
   *                     dependencies of this app — see REACT_LOCAL_PACKAGES).
   *  - NestJS (Jest):   @nestjs/*, jest, ts-jest, supertest, etc. all straight
   *                     from THIS backend's own node_modules (real
   *                     dependencies of this app — see NEST_LOCAL_PACKAGES).
   *                     Node resolves each symlink's transitive requires
   *                     (e.g. ts-jest → jest-util) via the real path, so no
   *                     extra global install or manual linking is needed.
   */
  private async linkTestModules(sessionDir: string, language: string): Promise<void> {
    const nodeModulesDir = join(sessionDir, 'node_modules');
    await fs.mkdir(nodeModulesDir, { recursive: true });

    if (language === 'nestjs') {
      for (const pkg of NEST_LOCAL_PACKAGES) {
        const dir = this.resolveLocalPackageDir(pkg);
        if (dir) {
          await this.symlinkPackage(dir, join(nodeModulesDir, pkg));
        }
      }
      return;
    }

    // React / Vitest (default)
    for (const pkg of REACT_LOCAL_PACKAGES) {
      const dir = this.resolveLocalPackageDir(pkg);
      if (dir) {
        await this.symlinkPackage(dir, join(nodeModulesDir, pkg));
      }
    }
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
    // `detached: true` hace que `sh` arranque como líder de su propio grupo de procesos
    // (setsid). Es indispensable para poder matarlo de verdad: `sh -c "python3 archivo.py"`
    // NO reemplaza su propio proceso por el de python3 (no hay exec-optimization acá) — python3
    // corre como hijo de `sh`, con el mismo grupo. Sin `detached`, `killSession` solo mataba a
    // `sh` y dejaba a python3 (o cualquier intérprete) corriendo huérfano en el servidor,
    // todavía dueño de los pipes de stdout/stderr — por eso el evento `close` nunca llegaba a
    // disparar `execution_done` y tanto "Ejecutar" como "Detener" se quedaban colgados para
    // siempre (verificado: un `python3` bloqueado en `input()` sobrevivía al kill del padre).
    const arrancar = () => this.lanzarProceso(client, sessionDir, shellCmd, execEnv);

    if (this.sessions.size >= this.MAX_CONCURRENT) {
      this.cola.push({ clientId: client.id, sessionDir, arrancar });
      client.emit(
        'terminal_output',
        `\x1b[33m⏳ Servidor ocupado — tu ejecución está en cola (puesto ${this.cola.length}). ` +
          `Arranca sola en cuanto se libere un turno.\x1b[0m\r\n`,
      );
      return;
    }
    arrancar();
  }

  /** Lanza de verdad el proceso, ya con turno asignado. */
  private lanzarProceso(
    client: Socket,
    sessionDir: string,
    shellCmd: string,
    execEnv: NodeJS.ProcessEnv,
  ) {
    const child = spawn('sh', ['-c', shellCmd], {
      cwd: sessionDir,
      env: execEnv,
      detached: true,
    });

    const temporizador = setTimeout(() => {
      client.emit(
        'terminal_output',
        `\r\n\x1b[31m⏱ Ejecución detenida: superó el límite de ` +
          `${Math.round(this.EXEC_TIMEOUT_MS / 60000)} minutos.\x1b[0m\r\n`,
      );
      // Mata el grupo entero; el `close` que provoca emite el `execution_done` y libera el turno.
      try { if (child.pid) process.kill(-child.pid, 'SIGKILL'); } catch { /* ya murió */ }
    }, this.EXEC_TIMEOUT_MS);

    this.sessions.set(client.id, { process: child, sessionDir, temporizador });

    child.stdout.on('data', (data: Buffer) => {
      client.emit('terminal_output', data.toString());
    });

    child.stderr.on('data', (data: Buffer) => {
      client.emit('terminal_output', data.toString());
    });

    child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
      // Un proceso muerto por señal (timeout, Detener) llega con code=null: reportarlo como 0
      // le pintaba al alumno un "✔ terminado con código 0" en verde justo detrás del aviso
      // rojo de que se lo cortamos.
      client.emit('execution_done', { code: code ?? (signal ? 1 : 0) });
      this.cleanupSession(client.id, sessionDir);
    });

    child.on('error', (err: Error) => {
      client.emit('terminal_output', `\x1b[31mError del proceso: ${err.message}\x1b[0m\r\n`);
      client.emit('execution_done', { code: 1 });
      this.cleanupSession(client.id, sessionDir);
    });
  }

  /** Arranca las que esperan turno, hasta llenar los cupos. Las de clientes que ya se fueron
   *  (o que cancelaron) se descartan limpiando su directorio temporal. */
  private atenderCola() {
    while (this.cola.length > 0 && this.sessions.size < this.MAX_CONCURRENT) {
      const siguiente = this.cola.shift();
      if (!siguiente) return;
      siguiente.arrancar();
    }
  }

  /** Saca de la cola lo que estuviera esperando para este cliente (se desconectó, pulsó Detener
   *  o lanzó otra ejecución) y borra su directorio temporal. */
  private sacarDeLaCola(clientId: string) {
    for (let i = this.cola.length - 1; i >= 0; i--) {
      if (this.cola[i].clientId === clientId) {
        this.cleanupDir(this.cola[i].sessionDir);
        this.cola.splice(i, 1);
      }
    }
  }

  /** Mata el grupo de procesos completo (PID negativo = señal a todo el grupo, ver el
   *  comentario en `spawnAndStream`), no solo el `sh` que Node ve como hijo directo —
   *  si no, el intérprete real (python3, node, etc.) sobrevive huérfano. */
  private killSession(clientId: string) {
    // Puede estar esperando turno en vez de corriendo: en ese caso no hay proceso que matar,
    // pero sí hay que sacarla de la cola para que no arranque después de que el alumno se fue.
    this.sacarDeLaCola(clientId);

    const session = this.sessions.get(clientId);
    if (!session) return;
    clearTimeout(session.temporizador);
    const pid = session.process.pid;
    try {
      if (pid) process.kill(-pid, 'SIGTERM');
      else session.process.kill('SIGTERM');
    } catch {
      try { session.process.kill('SIGTERM'); } catch { /* already dead */ }
    }
    this.sessions.delete(clientId);
    this.cleanupDir(session.sessionDir);
    this.atenderCola();
  }

  private cleanupSession(clientId: string, sessionDir: string) {
    const session = this.sessions.get(clientId);
    if (session) clearTimeout(session.temporizador);
    this.sessions.delete(clientId);
    this.cleanupDir(sessionDir);
    this.atenderCola();
  }

  private async cleanupDir(dir: string) {
    try { await fs.rm(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}
