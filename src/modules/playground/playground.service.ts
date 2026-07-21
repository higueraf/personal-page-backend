import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { PlaygroundProject, ProjectStatus } from '../../entities/playground-project.entity';
import { PlaygroundFile } from '../../entities/playground-file.entity';
import { PlaygroundTemplate } from '../../entities/playground-template.entity';
import { ExamVersion, ExamQuestion } from '../../entities/exam-version.entity';
import { User } from '../../entities/user.entity';
import { MailService } from '../mail/mail.service';

/** Slug simple para el "type" (namespace) de la API de práctica, derivado del theme_name de la variante. */
function slugify(text: string): string {
  return text
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function wrapStatement(text: string, width = 90): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > width) {
      lines.push(current.trim());
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines.map(l => ` * ${l}`).join('\n');
}

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
    @InjectRepository(PlaygroundTemplate)
    private templateRepo: Repository<PlaygroundTemplate>,
    @InjectRepository(ExamVersion)
    private examVersionRepo: Repository<ExamVersion>,
    private mailService: MailService,
  ) {}

  /** Builds blank exam files with only the question statement as a top comment, per the requested file mode. */
  private buildExamVersionFiles(version: ExamVersion, fileMode: 'single' | 'perQuestion', language?: string) {
    if (language === 'flutter') return this.buildFlutterExamFiles(version);

    const questions = [...(version.questions ?? [])].sort((a, b) => a.order - b.order);

    const block = (q: ExamQuestion) =>
      `/**\n * Ejercicio ${q.order}: ${q.title} (${q.points} pts)\n *\n${wrapStatement(q.statement)}\n */\n\n`;

    if (fileMode === 'single') {
      const content = questions
        .map((q, i) => (i > 0 ? `// ─────────────────────────────\n\n${block(q)}` : block(q)))
        .join('');
      return [{ name: 'examen.ts', path: '/examen.ts', content, is_folder: false }];
    }

    return questions.map((q) => ({
      name: `ejercicio-${q.order}.ts`,
      path: `/ejercicio-${q.order}.ts`,
      content: block(q),
      is_folder: false,
    }));
  }

  /**
   * Andamiaje fijo de Flutter (idéntico para las 4 variantes) + un único
   * archivo de enunciados (ENUNCIADO.md, no-.dart) para no repetirlos por
   * archivo — el bundler de preview del frontend solo toma archivos .dart,
   * así que este .md queda automáticamente fuera del preview compilado.
   */
  private buildFlutterExamFiles(version: ExamVersion) {
    const questions = [...(version.questions ?? [])].sort((a, b) => a.order - b.order);
    const totalPoints = questions.reduce((sum, q) => sum + (q.points ?? 0), 0);
    const typeSlug = slugify(version.theme_name);

    const enunciado = [
      `# Examen Flutter — ${version.theme_name}`,
      '',
      `Puntaje total: ${totalPoints} pts`,
      '',
      `> API de práctica: usá \`type=${typeSlug}\` en tus llamadas (ya viene configurado en \`lib/services/api_service.dart\`).`,
      '',
      ...questions.map((q) => `## Pregunta ${q.order}: ${q.title} (${q.points} pts)\n\n${q.statement}\n`),
    ].join('\n');

    return [
      { name: 'ENUNCIADO.md', path: '/ENUNCIADO.md', content: enunciado, is_folder: false },
      { name: 'lib', path: '/lib', content: '', is_folder: true },
      {
        name: 'models', path: '/lib/models', content: '', is_folder: true,
      },
      {
        name: 'services', path: '/lib/services', content: '', is_folder: true,
      },
      {
        name: 'item.dart', path: '/lib/models/item.dart', is_folder: false,
        content:
`class Item {
  final String? id;
  final String type;
  final String name;
  final String? description;
  final String? category;
  final double price;
  final int quantity;
  final bool active;

  Item({
    this.id,
    required this.type,
    required this.name,
    this.description,
    this.category,
    this.price = 0,
    this.quantity = 1,
    this.active = true,
  });

  factory Item.fromJson(Map<String, dynamic> json) {
    return Item(
      id: json['id'] as String?,
      type: json['type'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      category: json['category'] as String?,
      price: double.tryParse(json['price'].toString()) ?? 0,
      quantity: json['quantity'] as int? ?? 1,
      active: json['active'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'type': type,
      'name': name,
      'description': description,
      'category': category,
      'price': price,
      'quantity': quantity,
      'active': active,
    };
  }
}
`,
      },
      {
        name: 'api_service.dart', path: '/lib/services/api_service.dart', is_folder: false,
        content:
`import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/item.dart';

/// Cliente mínimo de la API de práctica — cambiá [type] por el indicado en ENUNCIADO.md.
class ApiService {
  static const String baseUrl = 'https://TU-BACKEND/api/practice-api/items';
  static const String type = '${typeSlug}';

  Future<List<Item>> fetchItems() async {
    final res = await http.get(Uri.parse('\$baseUrl?type=\$type'));
    final List<dynamic> data = jsonDecode(res.body);
    return data.map((e) => Item.fromJson(e)).toList();
  }

  Future<Item> createItem(Item item) async {
    final res = await http.post(
      Uri.parse(baseUrl),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({...item.toJson(), 'type': type}),
    );
    return Item.fromJson(jsonDecode(res.body));
  }

  Future<Item> updateItem(String id, Item item) async {
    final res = await http.patch(
      Uri.parse('\$baseUrl/\$id'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(item.toJson()),
    );
    return Item.fromJson(jsonDecode(res.body));
  }

  Future<void> deleteItem(String id) async {
    await http.delete(Uri.parse('\$baseUrl/\$id'));
  }
}
`,
      },
      {
        name: 'main.dart', path: '/lib/main.dart', is_folder: false,
        content:
`import 'package:flutter/material.dart';
import 'services/api_service.dart';
import 'models/item.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '${version.theme_name}',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
        useMaterial3: true,
      ),
      home: const HomePage(),
    );
  }
}

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final ApiService _api = ApiService();
  List<Item> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final items = await _api.fetchItems();
      setState(() => _items = items);
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('${version.theme_name}')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _items.length,
              itemBuilder: (context, i) {
                final item = _items[i];
                return ListTile(
                  title: Text(item.name),
                  subtitle: Text('\${item.category ?? ''} — \\\$\${item.price}'),
                );
              },
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // TODO: implementar la pantalla/lógica de creación (parte del examen)
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}
`,
      },
      {
        name: 'pubspec.yaml', path: '/pubspec.yaml', is_folder: false,
        content:
`name: flutter_examen
description: Examen de Flutter — CRUD contra API.

environment:
  sdk: '>=3.0.0 <4.0.0'
  flutter: '>=3.10.0'

dependencies:
  flutter:
    sdk: flutter
  http: ^1.2.0

flutter:
  uses-material-design: true
`,
      },
    ];
  }

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

  /**
   * Batch-upsert all files for a project.
   * Lookup priority: DB UUID (if provided) → name+path → create new.
   * This avoids URL-encoding issues with special chars in file names.
   */
  async saveAllFiles(
    projectId: string,
    files: { id?: string; name: string; content: string; path: string }[],
    userId: string,
  ) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project || project.user_id !== userId) throw new ForbiddenException();

    for (const f of files) {
      let file: PlaygroundFile | null = null;

      // Primary: find by DB UUID (works after renames since the record moves)
      if (f.id && !f.id.startsWith('local-')) {
        file = await this.fileRepo.findOne({ where: { id: f.id, project_id: projectId } });
      }

      // Fallback: find by name + path
      if (!file) {
        file = await this.fileRepo.findOne({ where: { project_id: projectId, name: f.name, path: f.path } });
      }

      if (file) {
        file.content = f.content;
        file.name    = f.name;
        file.path    = f.path;
      } else {
        file = this.fileRepo.create({
          project_id: projectId,
          name: f.name,
          content: f.content,
          is_folder: false,
          path: f.path,
        });
      }
      await this.fileRepo.save(file);
    }

    return { status: 'saved', count: files.length };
  }

  /** Rename a file or folder by its DB UUID. Updates child paths for folders. */
  async renameFile(projectId: string, fileId: string, newName: string, userId: string) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project || project.user_id !== userId) throw new ForbiddenException();

    const file = await this.fileRepo.findOne({ where: { id: fileId, project_id: projectId } });
    if (!file) throw new NotFoundException('File not found');

    const parentPath = file.path.substring(0, file.path.lastIndexOf('/') + 1);
    const oldPath = file.path;
    const newPath = `${parentPath}${newName}`;

    if (file.is_folder) {
      // Update all descendant paths
      const all = await this.fileRepo.find({ where: { project_id: projectId } });
      const oldPrefix = `${oldPath}/`;
      const newPrefix = `${newPath}/`;
      const toUpdate = all.filter(c => c.id !== fileId && c.path.startsWith(oldPrefix));
      for (const child of toUpdate) {
        child.path = newPrefix + child.path.slice(oldPrefix.length);
        await this.fileRepo.save(child);
      }
    }

    file.name = newName;
    file.path = newPath;
    return this.fileRepo.save(file);
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
    examData: Partial<PlaygroundProject> & {
      files?: { name: string; content?: string; path?: string }[];
      exam_group_id?: string;
      templateId?: string;
      examVersionId?: string;
      fileMode?: 'single' | 'perQuestion';
    },
  ) {
    const { files, exam_group_id, templateId, examVersionId, fileMode, ...projectData } = examData as any;

    const project = this.projectRepo.create({
      ...projectData,
      user_id:          studentId,
      is_exam:          true,
      allow_copy_paste: examData.allow_copy_paste ?? false,
      require_seb:      (examData as any).require_seb ?? false,
      status:           ProjectStatus.PENDING,
      exam_group_id:    exam_group_id ?? null,
      exam_version_id:  examVersionId ?? null,
    });
    const saved = await this.projectRepo.save(project) as unknown as PlaygroundProject;
    const projectId: string = saved.id;

    // Save initial files — priority: explicit files > exam version (variant) > template files > language defaults
    let resolvedFiles = files;
    if (!Array.isArray(resolvedFiles) || resolvedFiles.length === 0) {
      if (examVersionId) {
        const version = await this.examVersionRepo.findOne({
          where: { id: examVersionId },
          relations: ['examTemplate'],
        });
        if (version) {
          resolvedFiles = this.buildExamVersionFiles(version, fileMode ?? 'perQuestion', version.examTemplate?.language);
        }
      }
    }
    if (!Array.isArray(resolvedFiles) || resolvedFiles.length === 0) {
      if (templateId) {
        const template = await this.templateRepo.findOne({ where: { id: templateId } });
        resolvedFiles = template?.files;
      }
    }
    if (!Array.isArray(resolvedFiles) || resolvedFiles.length === 0) {
      resolvedFiles = DEFAULT_FILES[projectData.language ?? 'python'] ?? DEFAULT_FILES.python;
    }

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

  async gradeExam(id: string, grade: number, feedback?: string) {
    if (typeof grade !== 'number' || Number.isNaN(grade) || grade < 0 || grade > 10) {
      throw new ForbiddenException('La nota debe ser un número entre 0 y 10.');
    }
    const project = await this.projectRepo.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');

    project.grade = grade;
    project.feedback = feedback ?? project.feedback;
    project.status = ProjectStatus.GRADED;
    return this.projectRepo.save(project);
  }

  async buildGradingPrompt(id: string): Promise<{ prompt: string }> {
    const project = await this.projectRepo.findOne({ where: { id }, relations: ['files'] });
    if (!project) throw new NotFoundException('Project not found');

    let rubric = '';
    if (project.exam_version_id) {
      const version = await this.examVersionRepo.findOne({ where: { id: project.exam_version_id } });
      if (version) {
        const questions = [...(version.questions ?? [])].sort((a, b) => a.order - b.order);
        rubric = questions
          .map(
            (q) =>
              `Ejercicio ${q.order} — ${q.title} (${q.points} pts)\nEnunciado: ${q.statement}`,
          )
          .join('\n\n');
      }
    }

    const files = (project.files ?? [])
      .filter((f) => !f.is_folder)
      .map((f) => `--- Archivo: ${f.path} ---\n\`\`\`${project.language}\n${f.content ?? ''}\n\`\`\``)
      .join('\n\n');

    const prompt = [
      'Actuá como corrector de exámenes de programación. A continuación te doy la rúbrica del examen y el código que efectivamente escribió el alumno.',
      'Corregí cada ejercicio por separado indicando qué está bien, qué está mal o incompleto, y asigná el puntaje correspondiente (máximo indicado por ejercicio). Al final sumá el puntaje total sobre 10 y da una breve devolución general.',
      '',
      '=== RÚBRICA ===',
      rubric || '(No hay rúbrica asociada a este examen; evaluá el código de forma general.)',
      '',
      '=== CÓDIGO DEL ALUMNO ===',
      files || '(El alumno no tiene archivos.)',
    ].join('\n');

    return { prompt };
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
      relations: ['user', 'examVersion'],
    });
    // Legacy: group_id might be a project id (no exam_group_id set)
    if (projects.length === 0) {
      const single = await this.projectRepo.findOne({ where: { id: groupId, is_exam: true }, relations: ['user', 'examVersion'] });
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
