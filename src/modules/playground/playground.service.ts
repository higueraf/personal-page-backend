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
import { getVariantConfig, DartFieldType } from '../practice-api/practice-variants.config';

function dartType(type: DartFieldType): string {
  return type === 'string' ? 'String' : type === 'int' ? 'int' : type === 'double' ? 'double' : 'bool';
}

function tsType(type: DartFieldType): string {
  return type === 'string' ? 'string' : type === 'bool' ? 'boolean' : 'number';
}

function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

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
    if (language === 'nestjs') return this.buildNestExamFiles(version);

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
   * Andamiaje de Flutter: el proyecto arranca como una app "ToDo" COMPLETA y
   * funcional (arquitectura por capas: models/services/screens), contra una
   * API de referencia distinta a la de la variante asignada (`/todo-api/todos`,
   * modelo con `nombre` (String), `hecho` (bool), `duracion` (int) y
   * `presupuesto` (double), para cubrir los mismos tipos de dato que las
   * variantes reales). No hay ningún stub separado por pregunta —
   * el alumno debe DUPLICAR/ADAPTAR este mismo patrón (renombrando
   * archivos/clases, agregando los campos de su variante y apuntando al
   * endpoint de su propia API) para resolver el CRUD (Pregunta 1) y las 2
   * pantallas de cálculo (Preguntas 2 y 3), reemplazando los cálculos de
   * ejemplo (promedio de caracteres / buscador de texto) por los que pide su
   * propio enunciado.
   *
   * Un único archivo de enunciados (ENUNCIADO.md, no-.dart) documenta todo
   * esto — el bundler de preview del frontend solo toma archivos .dart, así
   * que este .md queda automáticamente fuera del preview compilado.
   */
  private buildFlutterExamFiles(version: ExamVersion) {
    const questions = [...(version.questions ?? [])].sort((a, b) => a.order - b.order);
    const totalPoints = questions.reduce((sum, q) => sum + (q.points ?? 0), 0);
    const typeSlug = slugify(version.theme_name);
    const variant = getVariantConfig(typeSlug);
    const fields = variant.fields;
    const apiBase = 'https://api.franciscohiguera.site/api';
    const endpoint = `${apiBase}/practice-api/${typeSlug}/${variant.resource}`;
    const todoEndpoint = `${apiBase}/todo-api/todos`;

    const sampleRecord = variant.seeds[0] ?? {};
    const sampleJson = JSON.stringify(sampleRecord, null, 2);

    const enunciado = [
      `# Examen Flutter — ${version.theme_name}`,
      '',
      `Puntaje total: ${totalPoints} pts`,
      '',
      '## Tu API (variante asignada)',
      '',
      `> \`GET/POST ${endpoint}\` y \`GET/PATCH/DELETE ${endpoint}/:id\`.`,
      '',
      `> Campos del recurso: ${fields.map((f) => `\`${f.key}\` (${dartType(f.type)})`).join(', ')}.`,
      '',
      '> Ejemplo de un registro real de tu API (formato JSON de la respuesta):',
      '>',
      '> ```json',
      ...sampleJson.split('\n').map((l) => `> ${l}`),
      '> ```',
      '',
      '## Punto de partida: app "ToDo" completa y funcional',
      '',
      '  El proyecto arranca con una app de ejemplo YA RESUELTA (tareas con `nombre` (String),',
      '  `hecho` (bool), `duracion` (int) y `presupuesto` (double)), contra otra API distinta a',
      '  la tuya, con esta estructura:',
      '',
      '  - `lib/models/todo.dart`: modelo de datos.',
      '  - `lib/services/todo_api_service.dart`: cliente HTTP (GET/POST/PATCH/DELETE).',
      '  - `lib/screens/todo_home_screen.dart`: pantalla principal (ícono + bienvenida + 3 botones).',
      '  - `lib/screens/todo_list_screen.dart` + `todo_form_screen.dart`: CRUD completo (listar/crear/editar/eliminar).',
      '  - `lib/screens/todo_stat1_screen.dart`: pantalla de cálculo de ejemplo (promedio de caracteres por tarea).',
      '  - `lib/screens/todo_stat2_screen.dart`: pantalla de cálculo de ejemplo (buscador de tareas por texto).',
      '',
      '  **Tu trabajo es DUPLICAR y ADAPTAR estos mismos archivos** (podés renombrar clases y',
      '  archivos con libertad — solo acordate de actualizar los `import` correspondientes en los',
      '  demás archivos que los usan) para armar:',
      '',
      '  1. **Pregunta 1** (CRUD): tu propio modelo (con los campos de tu variante), tu propio',
      '     servicio (apuntando al endpoint de arriba) y tus propias pantallas de lista + formulario.',
      '  2. **Pregunta 2** y **Pregunta 3**: tus propias pantallas de cálculo, siguiendo el mismo patrón',
      '     (fetch → calcular → mostrar) que ves en `todo_stat1_screen.dart`/`todo_stat2_screen.dart`,',
      '     pero calculando lo que pide cada enunciado de abajo (no el mismo cálculo del ejemplo).',
      '',
      '  Actualizá `lib/main.dart` para que la app arranque en tu propia pantalla principal cuando',
      '  termines (hoy apunta a `todo_home_screen.dart`, el ejemplo).',
      '',
      '## Preguntas',
      '',
      ...questions.map((q) => `### Pregunta ${q.order}: ${q.title} (${q.points} pts)\n\n${q.statement}\n`),
    ].join('\n');

    return [
      { name: 'ENUNCIADO.md', path: '/ENUNCIADO.md', content: enunciado, is_folder: false },
      { name: 'lib', path: '/lib', content: '', is_folder: true },
      { name: 'models', path: '/lib/models', content: '', is_folder: true },
      { name: 'services', path: '/lib/services', content: '', is_folder: true },
      { name: 'screens', path: '/lib/screens', content: '', is_folder: true },
      {
        name: 'todo.dart', path: '/lib/models/todo.dart', is_folder: false,
        content:
`/// Modelo del ejemplo de referencia — 4 campos con distintos tipos
/// (String/bool/int/double), a propósito, para que sirva de plantilla de
/// arquitectura por capas con la misma variedad de tipos que tu variante.
class Todo {
  final String? id;
  final String nombre;
  final bool hecho;
  final int duracion;
  final double presupuesto;

  Todo({
    this.id,
    required this.nombre,
    this.hecho = false,
    this.duracion = 0,
    this.presupuesto = 0,
  });

  factory Todo.fromJson(Map<String, dynamic> json) {
    return Todo(
      id: json['id'] as String?,
      nombre: json['nombre'] as String? ?? '',
      hecho: json['hecho'] as bool? ?? false,
      duracion: (json['duracion'] as num?)?.toInt() ?? 0,
      presupuesto: (json['presupuesto'] as num?)?.toDouble() ?? 0.0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'nombre': nombre,
      'hecho': hecho,
      'duracion': duracion,
      'presupuesto': presupuesto,
    };
  }
}
`,
      },
      {
        name: 'todo_api_service.dart', path: '/lib/services/todo_api_service.dart', is_folder: false,
        content:
`import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/todo.dart';

/// Cliente del ejemplo "ToDo" — apunta a una API distinta a la de tu
/// variante. Duplicá este archivo y cambiá \`baseUrl\` por la de tu variante
/// (ver ENUNCIADO.md) para resolver la Pregunta 1.
class TodoApiService {
  static const String baseUrl = '${todoEndpoint}';

  Future<List<Todo>> fetchTodos() async {
    final res = await http.get(Uri.parse(baseUrl));
    final List<dynamic> data = jsonDecode(res.body);
    return data.map((e) => Todo.fromJson(e)).toList();
  }

  Future<Todo> createTodo(Todo todo) async {
    final res = await http.post(
      Uri.parse(baseUrl),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(todo.toJson()),
    );
    return Todo.fromJson(jsonDecode(res.body));
  }

  Future<Todo> updateTodo(String id, Todo todo) async {
    final res = await http.patch(
      Uri.parse('\$baseUrl/\$id'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(todo.toJson()),
    );
    return Todo.fromJson(jsonDecode(res.body));
  }

  Future<void> deleteTodo(String id) async {
    await http.delete(Uri.parse('\$baseUrl/\$id'));
  }
}
`,
      },
      {
        name: 'todo_list_screen.dart', path: '/lib/screens/todo_list_screen.dart', is_folder: false,
        content:
`import 'package:flutter/material.dart';
import '../services/todo_api_service.dart';
import '../models/todo.dart';
import 'todo_form_screen.dart';

/// CRUD de ejemplo (ToDo) ya funcional. Duplicá esta pantalla + la de
/// \`todo_form_screen.dart\` y adaptalas (modelo, servicio y campos) para
/// resolver la Pregunta 1 de tu variante.
class TodoListScreen extends StatefulWidget {
  const TodoListScreen({super.key});

  @override
  State<TodoListScreen> createState() => _TodoListScreenState();
}

class _TodoListScreenState extends State<TodoListScreen> {
  final TodoApiService _api = TodoApiService();
  List<Todo> _todos = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final todos = await _api.fetchTodos();
      setState(() => _todos = todos);
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _delete(String id) async {
    await _api.deleteTodo(id);
    _load();
  }

  Future<void> _openForm([Todo? todo]) async {
    final saved = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => TodoFormScreen(todo: todo)),
    );
    if (saved == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ejemplo: Tareas')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _todos.length,
              itemBuilder: (context, i) {
                final todo = _todos[i];
                return ListTile(
                  title: Text(todo.nombre),
                  subtitle: Text(
                    '\${todo.duracion} min · \$\${todo.presupuesto.toStringAsFixed(2)} · \${todo.hecho ? "hecho" : "pendiente"}',
                  ),
                  onTap: () => _openForm(todo),
                  trailing: IconButton(
                    icon: const Icon(Icons.delete),
                    onPressed: () => _delete(todo.id!),
                  ),
                );
              },
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _openForm(),
        child: const Icon(Icons.add),
      ),
    );
  }
}
`,
      },
      {
        name: 'todo_form_screen.dart', path: '/lib/screens/todo_form_screen.dart', is_folder: false,
        content:
`import 'package:flutter/material.dart';
import '../services/todo_api_service.dart';
import '../models/todo.dart';

/// Ejemplo de referencia — formulario de creación/edición, ya funcional.
class TodoFormScreen extends StatefulWidget {
  final Todo? todo;

  const TodoFormScreen({super.key, this.todo});

  @override
  State<TodoFormScreen> createState() => _TodoFormScreenState();
}

class _TodoFormScreenState extends State<TodoFormScreen> {
  final TodoApiService _api = TodoApiService();
  late final TextEditingController _nombreCtrl;
  late final TextEditingController _duracionCtrl;
  late final TextEditingController _presupuestoCtrl;
  bool _hecho = false;

  @override
  void initState() {
    super.initState();
    _nombreCtrl = TextEditingController(text: widget.todo?.nombre ?? '');
    _duracionCtrl = TextEditingController(text: widget.todo?.duracion.toString() ?? '');
    _presupuestoCtrl = TextEditingController(text: widget.todo?.presupuesto.toString() ?? '');
    _hecho = widget.todo?.hecho ?? false;
  }

  @override
  void dispose() {
    _nombreCtrl.dispose();
    _duracionCtrl.dispose();
    _presupuestoCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final nombre = _nombreCtrl.text.trim();
    if (nombre.isEmpty) return;

    final todo = Todo(
      nombre: nombre,
      hecho: _hecho,
      duracion: int.tryParse(_duracionCtrl.text.trim()) ?? 0,
      presupuesto: double.tryParse(_presupuestoCtrl.text.trim()) ?? 0.0,
    );

    if (widget.todo == null) {
      await _api.createTodo(todo);
    } else {
      await _api.updateTodo(widget.todo!.id!, todo);
    }
    if (mounted) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.todo == null ? 'Nueva tarea' : 'Editar tarea')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            TextField(
              controller: _nombreCtrl,
              decoration: const InputDecoration(labelText: 'Nombre'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _duracionCtrl,
              decoration: const InputDecoration(labelText: 'Duración (minutos)'),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _presupuestoCtrl,
              decoration: const InputDecoration(labelText: 'Presupuesto'),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
            ),
            const SizedBox(height: 12),
            CheckboxListTile(
              title: const Text('Hecho'),
              value: _hecho,
              onChanged: (v) => setState(() => _hecho = v ?? false),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(onPressed: _save, child: const Text('Guardar')),
            ),
          ],
        ),
      ),
    );
  }
}
`,
      },
      {
        name: 'todo_home_screen.dart', path: '/lib/screens/todo_home_screen.dart', is_folder: false,
        content:
`import 'package:flutter/material.dart';
import 'todo_list_screen.dart';
import 'todo_stat1_screen.dart';
import 'todo_stat2_screen.dart';

/// Pantalla principal del ejemplo de referencia — misma estructura que la
/// pantalla principal de tu examen (ícono + bienvenida + 3 botones), para que
/// veas el mismo patrón aplicado de punta a punta.
class TodoHomeScreen extends StatelessWidget {
  const TodoHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ejemplo de referencia: Tareas')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.checklist, size: 96, color: Colors.green),
            const SizedBox(height: 16),
            Text(
              'Ejemplo completo: lista de tareas',
              style: Theme.of(context).textTheme.titleLarge,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const TodoListScreen()),
                  ),
                  child: const Text('CRUD de tareas'),
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const TodoStat1Screen()),
                  ),
                  child: const Text('Ejemplo de cálculo 1'),
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const TodoStat2Screen()),
                  ),
                  child: const Text('Ejemplo de cálculo 2'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
`,
      },
      {
        name: 'todo_stat1_screen.dart', path: '/lib/screens/todo_stat1_screen.dart', is_folder: false,
        content:
`import 'package:flutter/material.dart';
import '../services/todo_api_service.dart';
import '../models/todo.dart';

/// Ejemplo de referencia — pantalla de cálculo YA RESUELTA (distinta a las
/// Preguntas 2/3 de tu examen): promedio de caracteres en el nombre de las
/// tareas. Estudiá el patrón fetch → calcular → mostrar para tus propias
/// pantallas de Pregunta 2 y Pregunta 3.
class TodoStat1Screen extends StatefulWidget {
  const TodoStat1Screen({super.key});

  @override
  State<TodoStat1Screen> createState() => _TodoStat1ScreenState();
}

class _TodoStat1ScreenState extends State<TodoStat1Screen> {
  final TodoApiService _api = TodoApiService();
  List<Todo> _todos = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final todos = await _api.fetchTodos();
      setState(() => _todos = todos);
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final promedio = _todos.isEmpty
        ? 0.0
        : _todos.map((t) => t.nombre.length).reduce((a, b) => a + b) / _todos.length;

    return Scaffold(
      appBar: AppBar(title: const Text('Ejemplo de cálculo 1')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Promedio de caracteres por nombre de tarea:'),
                  const SizedBox(height: 8),
                  Text(
                    promedio.toStringAsFixed(1),
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                ],
              ),
            ),
    );
  }
}
`,
      },
      {
        name: 'todo_stat2_screen.dart', path: '/lib/screens/todo_stat2_screen.dart', is_folder: false,
        content:
`import 'package:flutter/material.dart';
import '../services/todo_api_service.dart';
import '../models/todo.dart';

/// Ejemplo de referencia — pantalla de cálculo YA RESUELTA (distinta a las
/// Preguntas 2/3 de tu examen): buscador de tareas por texto.
class TodoStat2Screen extends StatefulWidget {
  const TodoStat2Screen({super.key});

  @override
  State<TodoStat2Screen> createState() => _TodoStat2ScreenState();
}

class _TodoStat2ScreenState extends State<TodoStat2Screen> {
  final TodoApiService _api = TodoApiService();
  List<Todo> _todos = [];
  bool _loading = true;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final todos = await _api.fetchTodos();
      setState(() => _todos = todos);
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _todos
        .where((t) => t.nombre.toLowerCase().contains(_query.toLowerCase()))
        .toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Ejemplo de cálculo 2')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(
                    decoration: const InputDecoration(labelText: 'Buscar tarea por texto'),
                    onChanged: (value) => setState(() => _query = value),
                  ),
                  const SizedBox(height: 16),
                  Text('Resultados: \${filtered.length}'),
                  Expanded(
                    child: ListView.builder(
                      itemCount: filtered.length,
                      itemBuilder: (context, i) => ListTile(title: Text(filtered[i].nombre)),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
`,
      },
      {
        name: 'main.dart', path: '/lib/main.dart', is_folder: false,
        content:
`import 'package:flutter/material.dart';
import 'screens/todo_home_screen.dart';

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
      // Arranca en el ejemplo "ToDo" ya resuelto. Cambiá esto por tu propia
      // pantalla principal cuando termines de adaptar el patrón a tu variante
      // (ver ENUNCIADO.md).
      home: const TodoHomeScreen(),
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

  /**
   * Andamiaje de NestJS: el proyecto arranca con un módulo de referencia YA
   * RESUELTO (CRUD completo en memoria del recurso de la variante asignada,
   * ej. `productos`/`prendas`/`libros`), incluyendo sus tests (unitarios con
   * `@nestjs/testing` y de endpoints con `supertest`) como ejemplo del patrón
   * a seguir. El alumno debe replicar ese mismo patrón para completar el
   * servicio y el controlador de otros DOS recursos (`categorias` y
   * `movimientos`), que arrancan solo con la firma de sus métodos (sin
   * implementación) y sin tests — el alumno debe escribir también esos
   * archivos de test, siguiendo el mismo patrón que ve en el recurso resuelto.
   */
  private buildNestExamFiles(version: ExamVersion) {
    const questions = [...(version.questions ?? [])].sort((a, b) => a.order - b.order);
    const totalPoints = questions.reduce((sum, q) => sum + (q.points ?? 0), 0);
    const typeSlug = slugify(version.theme_name);
    const variant = getVariantConfig(typeSlug);
    const fields = variant.fields;
    const resource = variant.resource;
    const ClassName = cap(resource);
    const seeds = variant.seeds.length ? variant.seeds : [{}];
    const firstField = fields[0] ?? { key: 'nombre', type: 'string' as DartFieldType };
    const firstFieldNewValue = firstField.type === 'string' ? "'Actualizado'" : firstField.type === 'bool' ? 'true' : '999';

    const itemInterface =
      'export interface ' + ClassName + 'Item {\n' +
      '  id: string;\n' +
      fields.map((f) => '  ' + f.key + ': ' + tsType(f.type) + ';').join('\n') +
      '\n}\n';

    const seedItems = seeds
      .map((seed, i) => '  ' + JSON.stringify({ id: String(i + 1), ...seed }))
      .join(',\n');

    const sampleJson = JSON.stringify({ id: '1', ...seeds[0] }, null, 2);

    const enunciado = [
      `# Examen NestJS — ${version.theme_name}`,
      '',
      `Puntaje total: ${totalPoints} pts`,
      '',
      '## Tu recurso de referencia (variante asignada)',
      '',
      `> El módulo \`src/${resource}/\` YA VIENE RESUELTO como ejemplo: un CRUD completo`,
      `> del recurso \`${resource}\` (campos: ${fields.map((f) => `\`${f.key}\` (${tsType(f.type)})`).join(', ')}),`,
      '> con su servicio, su controlador y sus dos archivos de test (unitario y de endpoints).',
      '',
      '> Ejemplo de un registro de este recurso:',
      '>',
      '> ```json',
      ...sampleJson.split('\n').map((l) => `> ${l}`),
      '> ```',
      '',
      '## Estructura del proyecto',
      '',
      `  - \`src/main.ts\`: bootstrap de Nest (no expone puerto real durante el examen, solo confirma que compila).`,
      `  - \`src/app.module.ts\`: módulo raíz, importa los 3 módulos de recursos.`,
      `  - \`src/${resource}/${resource}.service.ts\`: servicio RESUELTO (arreglo en memoria + CRUD).`,
      `  - \`src/${resource}/${resource}.controller.ts\`: controlador RESUELTO (endpoints REST).`,
      `  - \`src/${resource}/${resource}.service.spec.ts\`: tests unitarios RESUELTOS (Jest + @nestjs/testing).`,
      `  - \`src/${resource}/${resource}.controller.spec.ts\`: tests de endpoints RESUELTOS (supertest, HTTP en memoria).`,
      '  - `src/categorias/`: servicio y controlador SIN IMPLEMENTAR (solo la firma de cada método).',
      '  - `src/movimientos/`: servicio y controlador SIN IMPLEMENTAR (solo la firma de cada método).',
      '',
      '## Tu trabajo',
      '',
      `  1. **Completar \`CategoriasService\` y \`CategoriasController\`** (recurso \`categorias\`: \`id\`, \`nombre\`,`,
      '     `descripcion`) con el mismo patrón de CRUD en memoria que ves resuelto en `' + resource + '.service.ts`' + '/`' + resource + '.controller.ts`' + ':',
      '     `findAll`, `findOne` (lanzando `NotFoundException` si no existe), `create`, `update` y `remove`,',
      '     expuestos como `GET /categorias`, `GET /categorias/:id`, `POST /categorias`, `PATCH /categorias/:id`',
      '     y `DELETE /categorias/:id`.',
      '  2. **Completar `MovimientosService` y `MovimientosController`** (recurso `movimientos`: `id`, `tipo`',
      '     (`\'entrada\'` o `\'salida\'`), `cantidad`, `referencia`, `fecha`) con el mismo patrón de CRUD.',
      '  3. **Escribir los 4 archivos de test que faltan** (no vienen dados, a diferencia de los de `' + resource + '`' + '):',
      '     - `src/categorias/categorias.service.spec.ts`: mínimo 5 tests — listar iniciales, crear (y verificar que',
      '       aumenta el conteo), encontrar por id, lanzar `NotFoundException` con un id inexistente, y actualizar/eliminar.',
      '     - `src/categorias/categorias.controller.spec.ts`: mínimo 3 tests con `supertest` — `GET /categorias`',
      '       (200 y arreglo), `POST /categorias` (201 y `id` definido), `GET /categorias/:id` con id inexistente (404).',
      '     - `src/movimientos/movimientos.service.spec.ts` y `src/movimientos/movimientos.controller.spec.ts`:',
      '       la misma cobertura mínima que arriba, pero para `movimientos`.',
      '     Todos deben seguir exactamente el mismo estilo/estructura que ' + '`' + resource + '.service.spec.ts`' + ' y ' + '`' + resource + '.controller.spec.ts`' + '.',
      '',
      '  Corré los tests con el botón "Ejecutar tests" (Jest) para verificar tu propio avance.',
      '',
      '## Preguntas',
      '',
      ...questions.map((q) => `### Pregunta ${q.order}: ${q.title} (${q.points} pts)\n\n${q.statement}\n`),
    ].join('\n');

    const samplePayload = JSON.stringify(seeds[0] ?? {});

    const resourceServiceSpec =
      "import { Test } from '@nestjs/testing';\n" +
      "import { NotFoundException } from '@nestjs/common';\n" +
      "import { " + ClassName + "Service } from './" + resource + ".service';\n\n" +
      "describe('" + ClassName + "Service', () => {\n" +
      "  let service: " + ClassName + "Service;\n\n" +
      "  beforeEach(async () => {\n" +
      "    const module = await Test.createTestingModule({\n" +
      "      providers: [" + ClassName + "Service],\n" +
      "    }).compile();\n" +
      "    service = module.get(" + ClassName + "Service);\n" +
      "  });\n\n" +
      "  it('debe listar los registros iniciales', () => {\n" +
      "    expect(service.findAll().length).toBeGreaterThan(0);\n" +
      "  });\n\n" +
      "  it('debe crear un nuevo registro', () => {\n" +
      "    const before = service.findAll().length;\n" +
      "    const created = service.create(" + samplePayload + ");\n" +
      "    expect(service.findAll().length).toBe(before + 1);\n" +
      "    expect(created.id).toBeDefined();\n" +
      "  });\n\n" +
      "  it('debe encontrar un registro por id', () => {\n" +
      "    const all = service.findAll();\n" +
      "    expect(service.findOne(all[0].id)).toEqual(all[0]);\n" +
      "  });\n\n" +
      "  it('debe lanzar NotFoundException si el id no existe', () => {\n" +
      "    expect(() => service.findOne('no-existe')).toThrow(NotFoundException);\n" +
      "  });\n\n" +
      "  it('debe actualizar un registro existente', () => {\n" +
      "    const all = service.findAll();\n" +
      "    const updated = service.update(all[0].id, { " + firstField.key + ": " + firstFieldNewValue + " });\n" +
      "    expect((updated as any)." + firstField.key + ").toBe(" + firstFieldNewValue + ");\n" +
      "  });\n\n" +
      "  it('debe eliminar un registro', () => {\n" +
      "    const all = service.findAll();\n" +
      "    const before = all.length;\n" +
      "    service.remove(all[0].id);\n" +
      "    expect(service.findAll().length).toBe(before - 1);\n" +
      "  });\n" +
      "});\n";

    const resourceControllerSpec =
      "import { Test } from '@nestjs/testing';\n" +
      "import { INestApplication } from '@nestjs/common';\n" +
      "import request from 'supertest';\n" +
      "import { " + ClassName + "Module } from './" + resource + ".module';\n\n" +
      "describe('" + ClassName + "Controller (e2e)', () => {\n" +
      "  let app: INestApplication;\n\n" +
      "  beforeAll(async () => {\n" +
      "    const moduleRef = await Test.createTestingModule({\n" +
      "      imports: [" + ClassName + "Module],\n" +
      "    }).compile();\n" +
      "    app = moduleRef.createNestApplication();\n" +
      "    await app.init();\n" +
      "  });\n\n" +
      "  afterAll(async () => {\n" +
      "    await app.close();\n" +
      "  });\n\n" +
      "  it('GET /" + resource + " debe devolver la lista', async () => {\n" +
      "    const res = await request(app.getHttpServer()).get('/" + resource + "');\n" +
      "    expect(res.status).toBe(200);\n" +
      "    expect(Array.isArray(res.body)).toBe(true);\n" +
      "  });\n\n" +
      "  it('POST /" + resource + " debe crear un nuevo registro', async () => {\n" +
      "    const res = await request(app.getHttpServer())\n" +
      "      .post('/" + resource + "')\n" +
      "      .send(" + samplePayload + ");\n" +
      "    expect([200, 201]).toContain(res.status);\n" +
      "    expect(res.body.id).toBeDefined();\n" +
      "  });\n\n" +
      "  it('GET /" + resource + "/:id debe devolver 404 si no existe', async () => {\n" +
      "    const res = await request(app.getHttpServer()).get('/" + resource + "/no-existe');\n" +
      "    expect(res.status).toBe(404);\n" +
      "  });\n" +
      "});\n";

    const resourceService =
      "import { Injectable, NotFoundException } from '@nestjs/common';\n\n" +
      itemInterface + '\n' +
      "@Injectable()\n" +
      "export class " + ClassName + "Service {\n" +
      "  private items: " + ClassName + "Item[] = [\n" +
      seedItems + ',\n' +
      "  ];\n" +
      "  private nextId = " + (seeds.length + 1) + ";\n\n" +
      "  findAll(): " + ClassName + "Item[] {\n" +
      "    return this.items;\n" +
      "  }\n\n" +
      "  findOne(id: string): " + ClassName + "Item {\n" +
      "    const item = this.items.find((i) => i.id === id);\n" +
      "    if (!item) throw new NotFoundException(`" + ClassName + " ${id} no encontrado`);\n" +
      "    return item;\n" +
      "  }\n\n" +
      "  create(data: Omit<" + ClassName + "Item, 'id'>): " + ClassName + "Item {\n" +
      "    const item: " + ClassName + "Item = { id: String(this.nextId++), ...data };\n" +
      "    this.items.push(item);\n" +
      "    return item;\n" +
      "  }\n\n" +
      "  update(id: string, data: Partial<Omit<" + ClassName + "Item, 'id'>>): " + ClassName + "Item {\n" +
      "    const item = this.findOne(id);\n" +
      "    Object.assign(item, data);\n" +
      "    return item;\n" +
      "  }\n\n" +
      "  remove(id: string): void {\n" +
      "    const index = this.items.findIndex((i) => i.id === id);\n" +
      "    if (index === -1) throw new NotFoundException(`" + ClassName + " ${id} no encontrado`);\n" +
      "    this.items.splice(index, 1);\n" +
      "  }\n" +
      "}\n";

    const resourceController =
      "import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';\n" +
      "import { " + ClassName + "Service, " + ClassName + "Item } from './" + resource + ".service';\n\n" +
      "@Controller('" + resource + "')\n" +
      "export class " + ClassName + "Controller {\n" +
      "  constructor(private readonly service: " + ClassName + "Service) {}\n\n" +
      "  @Get()\n" +
      "  findAll(): " + ClassName + "Item[] {\n" +
      "    return this.service.findAll();\n" +
      "  }\n\n" +
      "  @Get(':id')\n" +
      "  findOne(@Param('id') id: string): " + ClassName + "Item {\n" +
      "    return this.service.findOne(id);\n" +
      "  }\n\n" +
      "  @Post()\n" +
      "  create(@Body() data: Omit<" + ClassName + "Item, 'id'>): " + ClassName + "Item {\n" +
      "    return this.service.create(data);\n" +
      "  }\n\n" +
      "  @Patch(':id')\n" +
      "  update(@Param('id') id: string, @Body() data: Partial<Omit<" + ClassName + "Item, 'id'>>): " + ClassName + "Item {\n" +
      "    return this.service.update(id, data);\n" +
      "  }\n\n" +
      "  @Delete(':id')\n" +
      "  remove(@Param('id') id: string): void {\n" +
      "    this.service.remove(id);\n" +
      "  }\n" +
      "}\n";

    const resourceModule =
      "import { Module } from '@nestjs/common';\n" +
      "import { " + ClassName + "Controller } from './" + resource + ".controller';\n" +
      "import { " + ClassName + "Service } from './" + resource + ".service';\n\n" +
      "@Module({\n" +
      "  controllers: [" + ClassName + "Controller],\n" +
      "  providers: [" + ClassName + "Service],\n" +
      "  exports: [" + ClassName + "Service],\n" +
      "})\n" +
      "export class " + ClassName + "Module {}\n";

    /** Builds an unimplemented (student-authored) service+controller+module pair for a fixed, non-thematic resource. */
    const buildStub = (name: string, stubFields: Array<{ key: string; tsType: string }>) => {
      const Name = cap(name);
      const iface =
        'export interface ' + Name + 'Item {\n' +
        '  id: string;\n' +
        stubFields.map((f) => '  ' + f.key + ': ' + f.tsType + ';').join('\n') +
        '\n}\n';

      const service =
        "import { Injectable } from '@nestjs/common';\n\n" +
        iface + '\n' +
        "/**\n" +
        " * TODO (Alumno): implementar el CRUD completo de " + cap(name) + ", con el mismo patrón\n" +
        " * (arreglo en memoria + findAll/findOne/create/update/remove, lanzando\n" +
        " * NotFoundException cuando corresponda) que viste resuelto en\n" +
        " * `" + resource + ".service.ts`.\n" +
        " */\n" +
        "@Injectable()\n" +
        "export class " + Name + "Service {\n" +
        "  private items: " + Name + "Item[] = [];\n\n" +
        "  findAll(): " + Name + "Item[] {\n" +
        "    throw new Error('TODO: implementar findAll');\n" +
        "  }\n\n" +
        "  findOne(id: string): " + Name + "Item {\n" +
        "    throw new Error('TODO: implementar findOne');\n" +
        "  }\n\n" +
        "  create(data: Omit<" + Name + "Item, 'id'>): " + Name + "Item {\n" +
        "    throw new Error('TODO: implementar create');\n" +
        "  }\n\n" +
        "  update(id: string, data: Partial<Omit<" + Name + "Item, 'id'>>): " + Name + "Item {\n" +
        "    throw new Error('TODO: implementar update');\n" +
        "  }\n\n" +
        "  remove(id: string): void {\n" +
        "    throw new Error('TODO: implementar remove');\n" +
        "  }\n" +
        "}\n";

      const controller =
        "import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';\n" +
        "import { " + Name + "Service, " + Name + "Item } from './" + name + ".service';\n\n" +
        "/**\n" +
        " * TODO (Alumno): exponer los endpoints REST de " + cap(name) + " (GET, GET:id, POST,\n" +
        " * PATCH:id, DELETE:id), delegando en `" + Name + "Service`, con el mismo patrón que\n" +
        " * `" + resource + ".controller.ts`.\n" +
        " */\n" +
        "@Controller('" + name + "')\n" +
        "export class " + Name + "Controller {\n" +
        "  constructor(private readonly service: " + Name + "Service) {}\n\n" +
        "  // TODO: implementar los endpoints (ver " + resource + ".controller.ts como referencia)\n" +
        "}\n";

      const module =
        "import { Module } from '@nestjs/common';\n" +
        "import { " + Name + "Controller } from './" + name + ".controller';\n" +
        "import { " + Name + "Service } from './" + name + ".service';\n\n" +
        "@Module({\n" +
        "  controllers: [" + Name + "Controller],\n" +
        "  providers: [" + Name + "Service],\n" +
        "})\n" +
        "export class " + Name + "Module {}\n";

      return { service, controller, module, Name };
    };

    const categorias = buildStub('categorias', [
      { key: 'nombre', tsType: 'string' },
      { key: 'descripcion', tsType: 'string' },
    ]);
    const movimientos = buildStub('movimientos', [
      { key: 'tipo', tsType: "'entrada' | 'salida'" },
      { key: 'cantidad', tsType: 'number' },
      { key: 'referencia', tsType: 'string' },
      { key: 'fecha', tsType: 'string' },
    ]);

    const appModule =
      "import { Module } from '@nestjs/common';\n" +
      "import { " + ClassName + "Module } from './" + resource + "/" + resource + ".module';\n" +
      "import { CategoriasModule } from './categorias/categorias.module';\n" +
      "import { MovimientosModule } from './movimientos/movimientos.module';\n\n" +
      "@Module({\n" +
      "  imports: [" + ClassName + "Module, CategoriasModule, MovimientosModule],\n" +
      "})\n" +
      "export class AppModule {}\n";

    const mainTs =
      "import 'reflect-metadata';\n" +
      "import { NestFactory } from '@nestjs/core';\n" +
      "import { AppModule } from './app.module';\n\n" +
      "async function bootstrap() {\n" +
      "  const app = await NestFactory.create(AppModule);\n" +
      "  await app.listen(3000);\n" +
      "  console.log('Nest application is running (bootstrap OK)');\n" +
      "}\n" +
      "bootstrap();\n";

    return [
      { name: 'ENUNCIADO.md', path: '/ENUNCIADO.md', content: enunciado, is_folder: false },
      { name: 'src', path: '/src', content: '', is_folder: true },
      { name: 'main.ts', path: '/src/main.ts', content: mainTs, is_folder: false },
      { name: 'app.module.ts', path: '/src/app.module.ts', content: appModule, is_folder: false },

      { name: resource, path: `/src/${resource}`, content: '', is_folder: true },
      { name: `${resource}.service.ts`, path: `/src/${resource}/${resource}.service.ts`, content: resourceService, is_folder: false },
      { name: `${resource}.controller.ts`, path: `/src/${resource}/${resource}.controller.ts`, content: resourceController, is_folder: false },
      { name: `${resource}.module.ts`, path: `/src/${resource}/${resource}.module.ts`, content: resourceModule, is_folder: false },
      { name: `${resource}.service.spec.ts`, path: `/src/${resource}/${resource}.service.spec.ts`, content: resourceServiceSpec, is_folder: false },
      { name: `${resource}.controller.spec.ts`, path: `/src/${resource}/${resource}.controller.spec.ts`, content: resourceControllerSpec, is_folder: false },

      { name: 'categorias', path: '/src/categorias', content: '', is_folder: true },
      { name: 'categorias.service.ts', path: '/src/categorias/categorias.service.ts', content: categorias.service, is_folder: false },
      { name: 'categorias.controller.ts', path: '/src/categorias/categorias.controller.ts', content: categorias.controller, is_folder: false },
      { name: 'categorias.module.ts', path: '/src/categorias/categorias.module.ts', content: categorias.module, is_folder: false },

      { name: 'movimientos', path: '/src/movimientos', content: '', is_folder: true },
      { name: 'movimientos.service.ts', path: '/src/movimientos/movimientos.service.ts', content: movimientos.service, is_folder: false },
      { name: 'movimientos.controller.ts', path: '/src/movimientos/movimientos.controller.ts', content: movimientos.controller, is_folder: false },
      { name: 'movimientos.module.ts', path: '/src/movimientos/movimientos.module.ts', content: movimientos.module, is_folder: false },
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
      is_exam:          examData.is_exam ?? true,
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
