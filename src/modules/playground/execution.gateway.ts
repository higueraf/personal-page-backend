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
import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { JwtService } from '@nestjs/jwt';

interface RunningSession {
  process: ChildProcessWithoutNullStreams;
  sessionDir: string;
}

interface RuntimeConfig {
  directCommand: string;
  extension: string;
  compileCommand?: string;
}

const RUNTIMES: Record<string, RuntimeConfig> = {
  javascript: { directCommand: 'node',    extension: '.js' },
  typescript: { directCommand: 'tsx',     extension: '.ts' },
  python:     { directCommand: 'python3', extension: '.py' },
  kotlin:     { directCommand: 'kotlin',  extension: '.kt', compileCommand: 'kotlinc' },
  java:       { directCommand: 'java',    extension: '.java', compileCommand: 'javac' },
  dart:       { directCommand: 'dart',    extension: '.dart' },
};

@WebSocketGateway({
  cors: {
    origin: process.env.APP_ORIGINS?.split(',') ?? ['http://localhost:5173'],
    credentials: true,
  },
  namespace: '/execution',
})
export class ExecutionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly TEMP_DIR = '/tmp/playground';
  private readonly sessions = new Map<string, RunningSession>();

  constructor(private readonly jwtService: JwtService) {}

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
    @MessageBody() payload: { language: string; files: { name: string; content: string }[]; targetFile?: string },
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

      for (const file of validFiles) {
        const fileName = file.name.includes('.') ? file.name : file.name + runtime.extension;
        await fs.writeFile(join(sessionDir, fileName), file.content);
      }

      const mainFile =
        payload.targetFile
          ?? validFiles.find((f) => f.name.endsWith(runtime.extension))?.name
          ?? validFiles[0].name;

      const allFileNames = validFiles.map((f) =>
        f.name.includes('.') ? f.name : f.name + runtime.extension,
      );

      const shellCmd = this.buildShellCommand(lang, mainFile, allFileNames, runtime);

      const child = spawn('sh', ['-c', shellCmd], {
        cwd: sessionDir,
        env: { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '1' },
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
    } catch (err: any) {
      client.emit('terminal_output', `\x1b[31mError iniciando ejecución: ${err.message}\x1b[0m\r\n`);
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

  /** Build the shell command (single string passed to `sh -c`). For compiled
   *  languages (Kotlin, Java) the compile + run steps are chained with `&&`
   *  so the compilation output is streamed before the program starts.
   *  For Kotlin, all .kt files are compiled together so multi-file projects work. */
  private buildShellCommand(
    language: string,
    mainFile: string,
    allFileNames: string[],
    runtime: RuntimeConfig,
  ): string {
    if (language === 'kotlin') {
      // Compile ALL .kt files together into a single jar
      const ktFiles = allFileNames.filter((f) => f.endsWith('.kt'));
      const filesToCompile = ktFiles.length > 0 ? ktFiles : [mainFile];
      const jar = mainFile.replace('.kt', '.jar');
      const fileList = filesToCompile.map((f) => `"${f}"`).join(' ');
      // Derive entry class from active file: "calculadora.kt" → "CalculadoraKt"
      const baseName = mainFile.replace('.kt', '');
      const className = baseName
        .replace(/[-_](.)/g, (_, c: string) => c.toUpperCase())
        .replace(/^(.)/, (c: string) => c.toUpperCase())
        + 'Kt';
      return `kotlinc ${fileList} -include-runtime -d "${jar}" 2>&1 && kotlin -cp "${jar}" ${className}`;
    }
    if (language === 'java') {
      const cls = mainFile.replace('.java', '');
      return `javac "${mainFile}" && java "${cls}"`;
    }
    return `${runtime.directCommand} "${mainFile}"`;
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
