import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ExecutionService {
  private readonly TEMP_DIR = '/tmp/playground';

  constructor() {
    // Asegurar que el directorio temporal exista
    this.ensureTempDir();
  }

  private async ensureTempDir() {
    try {
      await fs.mkdir(this.TEMP_DIR, { recursive: true });
    } catch (error) {
      console.warn('Temp dir creation warning:', error.message);
    }
  }

  // Configuración de lenguajes: Docker image + fallback directo
  private readonly RUNTIMES: Record<string, {
    image: string;
    command: string;
    extension: string;
    timeout: number;
    compileCommand?: string;
    directCommand?: string; // fallback when Docker is unavailable
  }> = {
    javascript: {
      image: 'node:18-alpine',
      command: 'node',
      directCommand: 'node',
      extension: '.js',
      timeout: 5000,
    },
    typescript: {
      image: 'node:18-alpine',
      // tsx is compatible with all modern TS versions; ts-node breaks on
      // Node 20+ with certain tsconfig.json module settings (TS5109).
      command: 'npx tsx',      // for Docker (no global install inside container)
      directCommand: 'tsx',   // global install on host: npm i -g tsx
      extension: '.ts',
      timeout: 10000,
    },
    python: {
      image: 'python:3.11-alpine',
      command: 'python3',
      directCommand: 'python3',
      extension: '.py',
      timeout: 5000,
    },
    java: {
      image: 'openjdk:17-alpine',
      command: 'java',
      directCommand: 'java',
      extension: '.java',
      timeout: 8000,
      compileCommand: 'javac',
    },
    kotlin: {
      image: 'zenika/kotlin:latest',
      command: 'kotlin',
      directCommand: 'kotlin',
      extension: '.kt',
      timeout: 30000,   // más tiempo: la imagen de Kotlin es más pesada
      compileCommand: 'kotlinc',
    },
    dart: {
      image: 'dart:stable-sdk',
      command: 'dart',
      directCommand: 'dart',
      extension: '.dart',
      timeout: 8000,
    },
  };

  async execute(language: string, files: { name: string; content: string }[]) {
    const lang = language.toLowerCase();
    const runtime = this.RUNTIMES[lang];

    if (!runtime) {
      throw new InternalServerErrorException(
        `Lenguaje "${language}" no soportado. Disponibles: ${Object.keys(this.RUNTIMES).join(', ')}`
      );
    }

    // Filter out empty or non-code files (CSS/HTML that aren't the main entry)
    const validFiles = files.filter(f => f.name.includes('.') && f.content.trim() !== '');
    if (validFiles.length === 0) {
      throw new InternalServerErrorException('No hay archivos con contenido para ejecutar.');
    }

    const sessionId = uuidv4();
    const sessionDir = join(this.TEMP_DIR, sessionId);
    const fileNames: string[] = [];

    try {
      await fs.mkdir(sessionDir, { recursive: true });

      for (const file of validFiles) {
        const fileName = file.name.includes('.') ? file.name : file.name + runtime.extension;
        await fs.writeFile(join(sessionDir, fileName), file.content);
        fileNames.push(fileName);
      }

      // ── Execution strategy ────────────────────────────────────────────────
      // 1. If PREFER_DIRECT env var is set, skip Docker entirely
      // 2. Otherwise try Docker first; if Docker itself fails (image pull
      //    error, daemon issue, etc.) fall back to direct execution
      // 3. For languages without a directCommand (Kotlin/Java), Docker is
      //    required — show a helpful error if it's unavailable.

      const preferDirect = process.env.PREFER_DIRECT_EXECUTION === 'true';

      if (!preferDirect) {
        const dockerAvailable = await this.checkDockerAvailability();

        if (dockerAvailable) {
          const dockerResult = await this.executeWithDocker(sessionDir, fileNames, runtime, lang);

          // If Docker itself failed (not just user-code error), try direct fallback.
          // Distinguishing signals: Docker infrastructure errors appear in stderr
          // or produce no stdout at all with a non-zero code.
          const isDockerInfraError = this.isDockerInfraError(dockerResult);

          if (isDockerInfraError && runtime.directCommand) {
            console.info(`[Playground] Docker falló al ejecutar "${lang}" (infra error), usando ejecución directa.`);
            return await this.executeDirectly(sessionDir, fileNames, runtime, lang);
          }

          return dockerResult;
        }
      }

      // Docker not available (or PREFER_DIRECT=true) — try direct execution
      if (runtime.directCommand) {
        console.info(`[Playground] Ejecutando "${lang}" directamente (sin Docker).`);
        return await this.executeDirectly(sessionDir, fileNames, runtime, lang);
      }

      // No fallback available (Kotlin, Java need Docker / JVM)
      return {
        stdout: '',
        stderr: `Docker no está disponible en el servidor y "${language}" requiere Docker o JVM para ejecutarse.\n\nSoluciones:\n  • Instala Docker: https://docs.docker.com/get-docker/\n  • Inicia el daemon: sudo systemctl start docker\n  • En el servidor: establece PREFER_DIRECT_EXECUTION=true si tienes el runtime instalado`,
        output: '',
        code: 1,
        signal: 'error',
      };

    } catch (error) {
      console.error('Execution Error:', { language, sessionId, error: error.message });
      throw new InternalServerErrorException(`Error en ejecución: ${error.message}`);
    } finally {
      this.cleanup(sessionDir);
    }
  }

  /** Run interpreter directly on the host (no Docker) */
  private async executeDirectly(
    sessionDir: string,
    fileNames: string[],
    runtime: any,
    language: string,
  ): Promise<any> {
    // Find the best entry file: prefer the language-native extension
    const ext = runtime.extension;
    const mainFile = fileNames.find(f => f.endsWith(ext)) ?? fileNames[0];
    const mainFilePath = join(sessionDir, mainFile);
    
    let command = '';
    
    if (runtime.compileCommand) {
      if (language === 'java') {
        const className = mainFile.replace('.java', '');
        command = `cd "${sessionDir}" && ${runtime.compileCommand} "${mainFile}" && ${runtime.directCommand} "${className}"`;
      } else if (language === 'kotlin') {
        // Compile ALL .kt files together so multi-file projects work
        const ktFiles = fileNames.filter(f => f.endsWith('.kt'));
        const filesToCompile = ktFiles.length > 0 ? ktFiles : [mainFile];
        const jarName = mainFile.replace('.kt', '.jar');
        const fileList = filesToCompile.map(f => `"${f}"`).join(' ');
        command = `cd "${sessionDir}" && ${runtime.compileCommand} ${fileList} -include-runtime -d "${jarName}" 2>&1 && ${runtime.directCommand} -cp "${jarName}" MainKt`;
      }
    } else {
      command = `cd "${sessionDir}" && ${runtime.directCommand} "${mainFile}"`;
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve({
          stdout: '',
          stderr: 'Timeout: la ejecución tardó demasiado (>10s)',
          output: '',
          code: 124,
          signal: 'timeout',
        });
      }, runtime.timeout);

      exec(command, { maxBuffer: 1024 * 1024, timeout: runtime.timeout }, (error, stdout, stderr) => {
        clearTimeout(timer);
        if (error) {
          resolve({
            stdout: stdout || '',
            stderr: stderr || error.message,
            output: stdout || '',
            code: error.code ?? 1,
            signal: 'error',
          });
        } else {
          resolve({
            stdout: stdout || '',
            stderr: stderr || '',
            output: stdout || '',
            code: 0,
            signal: 'success',
          });
        }
      });
    });
  }

  private async executeWithDocker(sessionDir: string, fileNames: string[], runtime: any, language: string): Promise<any> {
    const mainFile = fileNames[0];
    const dockerCmd = this.buildDockerCommand(sessionDir, mainFile, runtime, language);

    // Give extra time for potential image pull on first run
    const effectiveTimeout = runtime.timeout + 30_000; // +30 s for image download

    return new Promise((resolve) => {
      exec(dockerCmd, {
        maxBuffer: 1024 * 1024, // 1 MB buffer
        timeout: effectiveTimeout, // ← milliseconds (no / 1000 division)
      }, (error, stdout, stderr) => {
        if (error) {
          resolve({
            stdout: stdout || '',
            stderr: stderr || error.message,
            output: stdout || '',
            code: typeof error.code === 'number' ? error.code : 1,
            signal: error.signal ?? 'error',
          });
        } else {
          resolve({
            stdout: stdout || '',
            stderr: stderr || '',
            output: stdout || '',
            code: 0,
            signal: 'success',
          });
        }
      });
    });
  }

  /** Returns true when the Docker result indicates a Docker infrastructure
   *  error (image not found, daemon issue, timeout) rather than a user-code error. */
  private isDockerInfraError(result: any): boolean {
    if (result.code === 0) return false;
    const stderr: string = (result.stderr ?? '').toLowerCase();
    return (
      stderr.includes('unable to find image') ||
      stderr.includes('pull access denied') ||
      stderr.includes('cannot connect to the docker daemon') ||
      stderr.includes('error response from daemon') ||
      stderr.includes('no such image') ||
      result.signal === 'SIGTERM' || // exec timeout killed it
      // Empty stderr + code 1 with no stdout is almost always a Docker infra error
      (result.code === 1 && !result.stdout && !stderr)
    );
  }

  private buildDockerCommand(sessionDir: string, mainFile: string, runtime: any, language: string): string {
    const containerName = `playground-${Date.now()}`;
    
    let command = `docker run --rm --name ${containerName} -v "${sessionDir}:/app" -w /app ${runtime.image}`;

    // Lenguajes que necesitan compilación
    if (runtime.compileCommand) {
      if (language === 'java') {
        // Java: compilar y ejecutar
        const className = mainFile.replace('.java', '');
        command += ` sh -c "${runtime.compileCommand} ${mainFile} && ${runtime.command} ${className}"`;
      } else if (language === 'kotlin') {
        // Kotlin: compilar y ejecutar
        command += ` sh -c "${runtime.compileCommand} ${mainFile} -include-runtime -d ${mainFile.replace('.kt', '.jar')} && ${runtime.command} -cp ${mainFile.replace('.kt', '.jar')} MainKt"`;
      }
    } else {
      // Lenguajes interpretados - ejecutar solo archivos de código, no CSS/HTML
      const codeExtensions = ['.js', '.ts', '.py', '.dart'];
      if (codeExtensions.some(ext => mainFile.endsWith(ext))) {
        command += ` ${runtime.command} ${mainFile}`;
      } else {
        // Para archivos no ejecutables (CSS, HTML), mostrar mensaje
        command += ` sh -c "echo 'Este tipo de archivo no se puede ejecutar directamente. Use un archivo de código principal.'"`;
      }
    }

    return command;
  }

  private async cleanup(sessionDir: string) {
    try {
      await fs.rm(sessionDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
    }
  }

  async getRuntimes() {
    return Object.keys(this.RUNTIMES).map(lang => ({
      language: lang,
      version: '1.0',
      aliases: [lang],
      runtime: this.RUNTIMES[lang]
    }));
  }

  /** Checks if Docker daemon is actually running (not just if binary exists) */
  async checkDockerAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      // `docker info` fails if daemon is down; `docker --version` only checks binary
      exec('docker info --format "{{.ServerVersion}}"', { timeout: 3000 }, (error) => {
        resolve(!error);
      });
    });
  }
}
