import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { PlaygroundProject, ProjectStatus } from '../../entities/playground-project.entity';
import { PlaygroundFile } from '../../entities/playground-file.entity';
import { User } from '../../entities/user.entity';
import { MailService } from '../mail/mail.service';

/** Fallback starter files when an exam is assigned without explicit files */
const DEFAULT_FILES: Record<string, { name: string; content: string; path: string }[]> = {
  python:     [{ name: 'main.py',   path: '/main.py',   content: 'print("Hello World!")\n' }],
  javascript: [{ name: 'main.js',   path: '/main.js',   content: 'console.log("Hello World!");\n' }],
  typescript: [{ name: 'main.ts',   path: '/main.ts',   content: 'const message: string = "Hello World!";\nconsole.log(message);\n' }],
  kotlin:     [{ name: 'main.kt',   path: '/main.kt',   content: 'fun main() {\n    println("Hello World!")\n}\n' }],
  java:       [{ name: 'Main.java', path: '/Main.java', content: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello World!");\n    }\n}\n' }],
  dart:       [{ name: 'main.dart', path: '/main.dart', content: 'void main() {\n  print("Hello World!");\n}\n' }],
};

@Injectable()
export class PlaygroundService {
  private readonly logger = new Logger(PlaygroundService.name);

  constructor(
    @InjectRepository(PlaygroundProject)
    private projectRepo: Repository<PlaygroundProject>,
    @InjectRepository(PlaygroundFile)
    private fileRepo: Repository<PlaygroundFile>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private mailService: MailService,
  ) {}

  async findAllByUser(userId: string) {
    return this.projectRepo.find({
      where: { user_id: userId },
      order: { updated_at: 'DESC' },
    });
  }

  async findOne(id: string, userId: string, userRole?: string) {
    const project = await this.projectRepo.findOne({
      where: { id },
      relations: ['files'],
    });

    if (!project) throw new NotFoundException('Project not found');

    const isPrivileged = ['admin', 'teacher'].includes(userRole?.toLowerCase() ?? '');

    // Check time constraints for exams (admin/teacher bypass)
    if (project.is_exam && !isPrivileged) {
      const now = new Date();
      if (project.start_time && now < project.start_time) {
        throw new ForbiddenException('Este examen aún no ha comenzado.');
      }
      if (project.end_time && now > project.end_time) {
        throw new ForbiddenException('El tiempo de este examen ha expirado.');
      }
    }

    // Allow if owner or admin/teacher
    if (project.user_id !== userId && !isPrivileged) {
      throw new ForbiddenException('Access denied');
    }

    return project;
  }

  async create(userId: string, data: any) {
    // Check limit of 10 projects
    const count = await this.projectRepo.count({ where: { user_id: userId, is_exam: false } });
    if (count >= 10 && !data.is_exam) {
      throw new ForbiddenException('Has alcanzado el límite de 10 proyectos.');
    }

    // Accept both `language` (new IDE) and `type` (legacy) fields
    const language = data.language ?? data.type ?? 'python';
    const type = data.type ?? data.language ?? 'web';

    const project = this.projectRepo.create({
      name: data.name,
      type,
      language,
      is_exam: data.is_exam ?? false,
      materia: data.materia,
      user_id: userId,
    });
    const saved = await this.projectRepo.save(project);

    // If the request provides files array, save them directly
    if (Array.isArray(data.files) && data.files.length > 0) {
      const fileEntities = data.files.map((f: any) =>
        this.fileRepo.create({
          project_id: saved.id,
          name: f.name,
          content: f.content ?? '',
          is_folder: f.is_folder ?? false,
          path: f.path ?? `/${f.name}`,
        }),
      );
      await this.fileRepo.save(fileEntities);
    }

    return this.findOne(saved.id, userId);
  }

  async updateFile(projectId: string, fileName: string, content: string, userId: string, isFolder: boolean = false, path: string = '') {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project || project.user_id !== userId) throw new ForbiddenException();

    let file = await this.fileRepo.findOne({ where: { project_id: projectId, name: fileName, path } });
    if (file) {
      file.content = content;
      file.is_folder = isFolder;
    } else {
      file = this.fileRepo.create({ project_id: projectId, name: fileName, content, is_folder: isFolder, path });
    }
    return this.fileRepo.save(file);
  }

  async deleteFile(projectId: string, fileId: string, userId: string) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project || project.user_id !== userId) throw new ForbiddenException();

    const file = await this.fileRepo.findOne({ where: { id: fileId, project_id: projectId } });
    if (!file) throw new NotFoundException('File not found');

    return this.fileRepo.remove(file);
  }

  async delete(id: string, userId: string) {
    const project = await this.findOne(id, userId);
    if (project.is_exam) {
      throw new ForbiddenException('No puedes eliminar un proyecto de examen.');
    }
    return this.projectRepo.remove(project);
  }
  
  async logCheat(projectId: string, userId: string, action: string, details?: string) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project || project.user_id !== userId) throw new ForbiddenException();

    const timestamp = new Date().toISOString();
    const currentLogs = Array.isArray(project.cheating_logs) ? project.cheating_logs : [];
    
    currentLogs.push({ timestamp, action, details });
    project.cheating_logs = currentLogs;
    
    await this.projectRepo.save(project);
    return { status: 'logged' };
  }

  async submitExam(id: string, userId: string) {
    const project = await this.projectRepo.findOne({ where: { id }, relations: ['files', 'user'] });
    if (!project || project.user_id !== userId) throw new ForbiddenException();
    if (!project.is_exam) throw new ForbiddenException('Este proyecto no es un examen.');

    project.status = ProjectStatus.SUBMITTED;
    await this.projectRepo.save(project);

    // Send ZIP email asynchronously — do not block the response
    this.sendExamZipEmail(project).catch(err =>
      this.logger.error(`ZIP email failed for project ${id}`, err?.message),
    );

    return { status: 'submitted' };
  }

  private async sendExamZipEmail(project: PlaygroundProject) {
    const user = project.user as User | undefined;
    if (!user?.email) return;

    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    for (const file of project.files ?? []) {
      if (!file.is_folder) {
        const filePath = (file.path ?? `/${file.name}`).replace(/^\//, '');
        zip.file(filePath || file.name, file.content ?? '');
      }
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const safeName = project.name.replace(/[^a-zA-Z0-9_\-]/g, '_');

    await this.mailService.send({
      to: user.email,
      subject: `Código entregado: ${project.name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
          <h2 style="color: #1d4ed8;">Examen entregado correctamente</h2>
          <p>Hola <strong>${user.first_name ?? ''} ${user.last_name ?? ''}</strong>,</p>
          <p>Tu examen <strong>${project.name}</strong>${project.materia ? ` (${project.materia})` : ''} ha sido entregado exitosamente.</p>
          <p>Adjunto encontrarás un archivo ZIP con todo tu código fuente como respaldo.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="font-size: 12px; color: #6b7280;">Este es un mensaje automático — no respondas a este correo.</p>
        </div>
      `,
      attachments: [
        { filename: `${safeName}.zip`, content: zipBuffer, contentType: 'application/zip' },
      ],
    });
  }

  // Admin methods
  async getStudentsFromCourse(courseId: string) {
    const students = await this.userRepo
      .createQueryBuilder('u')
      .innerJoin('u.study_courses', 'sc', 'sc.id = :courseId', { courseId })
      .where('u.user_type = :type', { type: 'student' })
      .andWhere('u.is_active = true')
      .getMany();
    return students.map(s => s.id);
  }

  async assignExam(
    teacherId: string,
    studentId: string,
    examData: Partial<PlaygroundProject> & { files?: { name: string; content?: string; path?: string }[]; exam_group_id?: string },
  ) {
    const { files, exam_group_id, ...projectData } = examData as any;

    const project = this.projectRepo.create({
      ...projectData,
      user_id:          studentId,
      is_exam:          true,
      allow_copy_paste: examData.allow_copy_paste ?? false,
      require_seb:      (examData as any).require_seb ?? false,
      status:           ProjectStatus.PENDING,
      exam_group_id:    exam_group_id ?? null,
    });
    const saved = await this.projectRepo.save(project) as unknown as PlaygroundProject;
    const projectId: string = saved.id;

    // Save initial files — use provided files or fall back to language defaults
    const resolvedFiles = (Array.isArray(files) && files.length > 0)
      ? files
      : (DEFAULT_FILES[projectData.language ?? 'python'] ?? DEFAULT_FILES.python);

    const fileEntities = resolvedFiles.map((f: any) =>
      this.fileRepo.create({
        project_id: projectId,
        name:       f.name,
        content:    f.content ?? '',
        is_folder:  f.is_folder ?? false,
        path:       f.path ?? `/${f.name}`,
      }),
    );
    await this.fileRepo.save(fileEntities);

    return this.projectRepo.findOne({ where: { id: projectId }, relations: ['files'] });
  }

  async findAllAdminExams() {
    return this.projectRepo.find({
      where: { is_exam: true },
      order: { created_at: 'DESC' },
      relations: ['user'],
    });
  }

  /** Returns one summary entry per exam batch (grouped by exam_group_id) */
  async findAdminExamGroups() {
    const exams = await this.projectRepo.find({
      where: { is_exam: true },
      order: { created_at: 'DESC' },
      relations: ['user'],
    });

    const map = new Map<string, PlaygroundProject[]>();
    for (const ex of exams) {
      const key = ex.exam_group_id ?? ex.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ex);
    }

    return Array.from(map.entries()).map(([group_id, projects]) => {
      const first = projects[0];
      return {
        group_id,
        name:            first.name,
        materia:         first.materia,
        language:        first.language,
        start_time:      first.start_time,
        end_time:        first.end_time,
        allow_copy_paste: first.allow_copy_paste,
        require_seb:      first.require_seb,
        created_at:      first.created_at,
        total_count:     projects.length,
        submitted_count: projects.filter(p => p.status === ProjectStatus.SUBMITTED || p.status === ProjectStatus.GRADED).length,
        cheating_count:  projects.filter(p => Array.isArray(p.cheating_logs) && p.cheating_logs.length > 0).length,
      };
    });
  }

  /** Returns all student projects belonging to an exam group */
  async findAdminExamsByGroup(groupId: string) {
    const projects = await this.projectRepo.find({
      where: { exam_group_id: groupId, is_exam: true },
      order: { created_at: 'ASC' },
      relations: ['user'],
    });
    // Legacy: group_id might be a project id (no exam_group_id set)
    if (projects.length === 0) {
      const single = await this.projectRepo.findOne({ where: { id: groupId, is_exam: true }, relations: ['user'] });
      if (single) return [single];
    }
    return projects;
  }

  /** Deletes all student projects in an exam group */
  async deleteAdminExamGroup(groupId: string) {
    const projects = await this.projectRepo.find({
      where: { exam_group_id: groupId, is_exam: true },
      relations: ['files'],
    });
    if (projects.length === 0) {
      const single = await this.projectRepo.findOne({ where: { id: groupId, is_exam: true }, relations: ['files'] });
      if (single) return this.projectRepo.remove([single]);
      throw new NotFoundException('Exam group not found');
    }
    return this.projectRepo.remove(projects);
  }

  /** Updates metadata on all student projects in an exam group */
  async updateAdminExamGroup(
    groupId: string,
    data: { name?: string; start_time?: Date | null; end_time?: Date | null; allow_copy_paste?: boolean; require_seb?: boolean },
  ) {
    const projects = await this.projectRepo.find({ where: { exam_group_id: groupId, is_exam: true } });
    if (projects.length === 0) {
      const single = await this.projectRepo.findOne({ where: { id: groupId, is_exam: true } });
      if (single) {
        Object.assign(single, data);
        return [await this.projectRepo.save(single)];
      }
      throw new NotFoundException('Exam group not found');
    }
    for (const p of projects) Object.assign(p, data);
    return this.projectRepo.save(projects);
  }

  /** Change status of a single exam project */
  async changeExamStatus(id: string, status: ProjectStatus) {
    const project = await this.projectRepo.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    if (!project.is_exam) throw new ForbiddenException('Solo se pueden cambiar status de proyectos de examen.');
    project.status = status;
    return this.projectRepo.save(project);
  }

  /** Change status of all projects in an exam group */
  async changeExamGroupStatus(groupId: string, status: ProjectStatus) {
    const projects = await this.projectRepo.find({ where: { exam_group_id: groupId, is_exam: true } });
    if (projects.length === 0) {
      const single = await this.projectRepo.findOne({ where: { id: groupId, is_exam: true } });
      if (single) { single.status = status; return [await this.projectRepo.save(single)]; }
      throw new NotFoundException('Exam group not found');
    }
    for (const p of projects) p.status = status;
    return this.projectRepo.save(projects);
  }

  async updateAdminExam(
    id: string,
    data: { name?: string; start_time?: Date | null; end_time?: Date | null; allow_copy_paste?: boolean },
  ) {
    const project = await this.projectRepo.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    if (!project.is_exam) throw new ForbiddenException('Solo se pueden editar proyectos de examen desde aquí.');
    Object.assign(project, data);
    return this.projectRepo.save(project);
  }

  async deleteAdminExam(id: string) {
    const project = await this.projectRepo.findOne({ where: { id }, relations: ['files'] });
    if (!project) throw new NotFoundException('Project not found');
    if (!project.is_exam) throw new ForbiddenException('Solo se pueden eliminar proyectos de examen desde aquí.');
    return this.projectRepo.remove(project);
  }

  async findAllAdminPlaygrounds() {
    return this.projectRepo.find({
      order: { created_at: 'DESC' },
      relations: ['user'], // Fetch student info
    });
  }
}
