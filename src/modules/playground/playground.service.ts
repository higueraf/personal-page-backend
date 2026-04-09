import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlaygroundProject, ProjectStatus } from '../../entities/playground-project.entity';
import { PlaygroundFile } from '../../entities/playground-file.entity';
import { User } from '../../entities/user.entity';

@Injectable()
export class PlaygroundService {
  constructor(
    @InjectRepository(PlaygroundProject)
    private projectRepo: Repository<PlaygroundProject>,
    @InjectRepository(PlaygroundFile)
    private fileRepo: Repository<PlaygroundFile>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async findAllByUser(userId: string) {
    return this.projectRepo.find({
      where: { user_id: userId },
      order: { updated_at: 'DESC' },
    });
  }

  async findOne(id: string, userId: string) {
    const project = await this.projectRepo.findOne({
      where: { id },
      relations: ['files'],
    });

    if (!project) throw new NotFoundException('Project not found');
    
    // Check time constraints for exams
    if (project.is_exam) {
      const now = new Date();
      if (project.start_time && now < project.start_time) {
        throw new ForbiddenException('Este examen aún no ha comenzado.');
      }
      if (project.end_time && now > project.end_time) {
        throw new ForbiddenException('El tiempo de este examen ha expirado.');
      }
    }

    // Allow if owner or if admin (logic for admin can be added in controller)
    if (project.user_id !== userId) throw new ForbiddenException('Access denied');

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

  // Admin methods
  async getStudentsFromCourse(courseId: string) {
    const students = await this.userRepo.find({
      where: { study_course_id: courseId, user_type: 'student' as any, is_active: true },
    });
    return students.map(s => s.id);
  }

  async assignExam(
    teacherId: string,
    studentId: string,
    examData: Partial<PlaygroundProject> & { files?: { name: string; content?: string; path?: string }[] },
  ) {
    const { files, ...projectData } = examData as any;

    const project = this.projectRepo.create({
      ...projectData,
      user_id:         studentId,
      is_exam:         true,
      allow_copy_paste: examData.allow_copy_paste ?? false,
      status:          ProjectStatus.PENDING,
    });
    const saved = await this.projectRepo.save(project) as unknown as PlaygroundProject;
    const projectId: string = saved.id;

    // Save initial files if provided
    if (Array.isArray(files) && files.length > 0) {
      const fileEntities = files.map((f: any) =>
        this.fileRepo.create({
          project_id: projectId,
          name:       f.name,
          content:    f.content ?? '',
          is_folder:  f.is_folder ?? false,
          path:       f.path ?? `/${f.name}`,
        }),
      );
      await this.fileRepo.save(fileEntities);
    }

    return this.projectRepo.findOne({ where: { id: projectId }, relations: ['files'] });
  }

  async findAllAdminExams() {
    return this.projectRepo.find({
      where: { is_exam: true },
      order: { created_at: 'DESC' },
      relations: ['user'], // Fetch student info
    });
  }
}
