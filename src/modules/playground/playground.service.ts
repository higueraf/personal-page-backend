import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
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

  /** Explicación general de la rúbrica (60/20/20), insertada una vez en cada ENUNCIADO.md. */
  private static readonly RUBRIC_EXPLICATION = `## Rúbrica de evaluación

Cada pregunta se califica con estos 3 criterios, aplicados como porcentaje exacto de su puntaje:

- **Funcional (60%):** el código corre sin errores y se puede usar/navegar en el preview.
- **Lógica implementada (20%):** los cálculos y las reglas de negocio (incluyendo el manejo de
  errores de negocio, ej. mensajes de conflicto) dan el resultado correcto.
- **Codificación (20%):** nombres y organización según lo pedido (ej. renombrado de
  archivos/funciones), separación en componentes, estilo, y que se siga el patrón solicitado en
  el enunciado.
`;

  /** Desglose numérico (60/20/20 exacto, sin redondear) del puntaje de una pregunta. */
  private buildRubricBreakdown(points: number): string {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const fmt = (n: number) => {
      const r = round2(n);
      return Number.isInteger(r) ? `${r}` : `${r}`.replace(/0+$/, '').replace(/\.$/, '');
    };
    const funcional = fmt(points * 0.6);
    const logica = fmt(points * 0.2);
    const codificacion = fmt(points * 0.2);
    return `${funcional} funcional / ${logica} lógica / ${codificacion} codificación`;
  }

  /** Builds blank exam files with only the question statement as a top comment, per the requested file mode. */
  private buildExamVersionFiles(version: ExamVersion, fileMode: 'single' | 'perQuestion', language?: string) {
    // Dispatch is purely by ExamTemplate.language — no name-string matching. Each React variant
    // (CRUD-only vs. Vitest-testing vs. Cypress vs. Native) has its OWN distinct language value so
    // there's no ambiguity, even if two templates happen to share similar/overlapping names.
    if (language === 'flutter') return this.buildFlutterExamFiles(version);
    if (language === 'nestjs') return this.buildNestExamFiles(version);
    if (language === 'react') return this.buildReactExamFiles(version);
    if (language === 'react-crud') return this.buildReactCrudExamFiles(version);
    if (language === 'react-cypress') return this.buildReactCypressExamFiles(version);
    if (language === 'react-native') return this.buildReactNativeExamFiles(version);
    if (language === 'html') return this.buildHtmlDomExamFiles(version);
    if (language === 'html-array') return this.buildHtmlArrayExamFiles(version);

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
      PlaygroundService.RUBRIC_EXPLICATION,
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
      ...questions.map((q) => `### Pregunta ${q.order}: ${q.title} (${q.points} pts — ${this.buildRubricBreakdown(q.points)})\n\n${q.statement}\n`),
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
                    '\${todo.duracion} min · \${todo.presupuesto.toStringAsFixed(2)} · \${todo.hecho ? "hecho" : "pendiente"}',
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
      body: SingleChildScrollView(
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
      PlaygroundService.RUBRIC_EXPLICATION,
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
      '  - `src/categorias/`: servicio y controlador **YA IMPLEMENTADOS** (CRUD completo + una regla de',
      '    negocio y un endpoint adicionales). Sin archivos de test.',
      '  - `src/movimientos/`: servicio y controlador **YA IMPLEMENTADOS** (CRUD completo + una regla de',
      '    negocio y un endpoint adicionales). Sin archivos de test.',
      '',
      '## Tu trabajo',
      '',
      '  Categorías y Movimientos ya vienen completos: **no tenés que programar el CRUD**, solo escribir',
      '  los 4 archivos de test que faltan, siguiendo el mismo estilo que `' + resource + '.service.spec.ts`' +
        ' y `' + resource + '.controller.spec.ts`' + '. Ojo: cada módulo tiene una regla y un endpoint que',
      '  NO existen en el módulo de referencia — copiar los tests de `' + resource + '`' + ' cambiando nombres',
      '  de variables no te va a alcanzar, tenés que agregar un caso de prueba distinto para cada una de esas',
      '  partes. Abajo de cada archivo te explicamos paso a paso qué tenés que hacer en ese caso adicional.',
      '',
      `  1. **\`src/categorias/categorias.service.spec.ts\`** (mínimo 6 tests): los 5 básicos de siempre`,
      '     (listar iniciales, crear, encontrar por id, `NotFoundException` con id inexistente, actualizar/eliminar)',
      '     **más** un test para el caso adicional:',
      '     - Creá una categoría (por ejemplo con `nombre: "Ropa"`).',
      '     - Intentá crear otra categoría con ese mismo `nombre`, pero escrito con otra combinación de',
      '       mayúsculas/minúsculas (por ejemplo `"ROPA"` o `"ropa"`).',
      '     - Verificá que esa segunda creación lanza `ConflictException` (con `expect(() => ...).toThrow(...)`,',
      '       o `await expect(...).rejects.toThrow(...)` si el método es async).',
      '  2. **`src/categorias/categorias.controller.spec.ts`** (mínimo 4 tests con `supertest`): los 3 básicos',
      '     de siempre (`GET` lista 200, `POST` crea 201 con `id`, `GET /:id` inexistente 404) **más** un test',
      '     para el caso adicional:',
      '     - Creá 2 o 3 categorías con nombres distintos (podés usar los datos iniciales del recurso).',
      '     - Hacé `GET /categorias/buscar?nombre=<texto parcial>` con `supertest`.',
      '     - Verificá con `expect(response.body)` que la respuesta (200) solo incluye las categorías cuyo',
      '       nombre contiene ese texto, y que la búsqueda funciona sin distinguir mayúsculas/minúsculas.',
      '  3. **`src/movimientos/movimientos.service.spec.ts`** (mínimo 6 tests): los 5 básicos de siempre',
      '     **más** un test para el caso adicional:',
      '     - Intentá crear un movimiento con `cantidad: 0` (probá también con un valor negativo).',
      '     - Verificá que se lanza `BadRequestException` en ambos casos.',
      '  4. **`src/movimientos/movimientos.controller.spec.ts`** (mínimo 4 tests con `supertest`): los 3',
      '     básicos de siempre **más** un test para el caso adicional:',
      '     - Creá con `supertest` varios movimientos, mezclando algunos de entrada y otros de salida.',
      '     - Hacé `GET /movimientos/resumen`.',
      '     - Verificá que `totalEntradas`, `totalSalidas` y `balance` de la respuesta coinciden con el',
      '       cálculo esperado a partir de los movimientos que vos mismo creaste en ese test.',
      '',
      '  Corré los tests con el botón "Ejecutar tests" (Jest) para verificar tu propio avance.',
      '',
      '## Preguntas',
      '',
      ...questions.map((q) => `### Pregunta ${q.order}: ${q.title} (${q.points} pts — ${this.buildRubricBreakdown(q.points)})\n\n${q.statement}\n`),
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

    /** Categorías: CRUD completo YA IMPLEMENTADO + una regla/endpoint que el módulo de
     *  referencia no tiene (unicidad de `nombre` + búsqueda), para que el alumno no pueda
     *  aprobar solo copiando los tests de `resource` y renombrando variables. Sin `.spec.ts`:
     *  el alumno debe escribirlos, incluyendo casos para esta parte extra. */
    const categorias = {
      Name: 'Categorias',
      service:
        "import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';\n\n" +
        "export interface CategoriasItem {\n" +
        "  id: string;\n" +
        "  nombre: string;\n" +
        "  descripcion: string;\n" +
        "}\n\n" +
        "@Injectable()\n" +
        "export class CategoriasService {\n" +
        "  private items: CategoriasItem[] = [];\n" +
        "  private nextId = 1;\n\n" +
        "  findAll(): CategoriasItem[] {\n" +
        "    return this.items;\n" +
        "  }\n\n" +
        "  findOne(id: string): CategoriasItem {\n" +
        "    const item = this.items.find((i) => i.id === id);\n" +
        "    if (!item) throw new NotFoundException(`Categoria ${id} no encontrada`);\n" +
        "    return item;\n" +
        "  }\n\n" +
        "  /** Regla extra (no está en el módulo de referencia): busca por coincidencia parcial de nombre. */\n" +
        "  search(nombre: string): CategoriasItem[] {\n" +
        "    const needle = nombre.toLowerCase();\n" +
        "    return this.items.filter((i) => i.nombre.toLowerCase().includes(needle));\n" +
        "  }\n\n" +
        "  create(data: Omit<CategoriasItem, 'id'>): CategoriasItem {\n" +
        "    this.assertNombreUnico(data.nombre);\n" +
        "    const item: CategoriasItem = { id: String(this.nextId++), ...data };\n" +
        "    this.items.push(item);\n" +
        "    return item;\n" +
        "  }\n\n" +
        "  update(id: string, data: Partial<Omit<CategoriasItem, 'id'>>): CategoriasItem {\n" +
        "    const item = this.findOne(id);\n" +
        "    if (data.nombre) this.assertNombreUnico(data.nombre, id);\n" +
        "    Object.assign(item, data);\n" +
        "    return item;\n" +
        "  }\n\n" +
        "  remove(id: string): void {\n" +
        "    const index = this.items.findIndex((i) => i.id === id);\n" +
        "    if (index === -1) throw new NotFoundException(`Categoria ${id} no encontrada`);\n" +
        "    this.items.splice(index, 1);\n" +
        "  }\n\n" +
        "  /** Regla extra (no está en el módulo de referencia): no se permiten dos categorías con el mismo nombre. */\n" +
        "  private assertNombreUnico(nombre: string, ignoreId?: string): void {\n" +
        "    const duplicada = this.items.some(\n" +
        "      (i) => i.id !== ignoreId && i.nombre.toLowerCase() === nombre.toLowerCase(),\n" +
        "    );\n" +
        "    if (duplicada) throw new ConflictException(`Ya existe una categoría llamada \"${nombre}\"`);\n" +
        "  }\n" +
        "}\n",
      controller:
        "import { Controller, Get, Post, Patch, Delete, Param, Query, Body } from '@nestjs/common';\n" +
        "import { CategoriasService, CategoriasItem } from './categorias.service';\n\n" +
        "@Controller('categorias')\n" +
        "export class CategoriasController {\n" +
        "  constructor(private readonly service: CategoriasService) {}\n\n" +
        "  // Ruta extra (no está en el módulo de referencia). Va ANTES de ':id' para no chocar con esa ruta.\n" +
        "  @Get('buscar')\n" +
        "  search(@Query('nombre') nombre: string): CategoriasItem[] {\n" +
        "    return this.service.search(nombre ?? '');\n" +
        "  }\n\n" +
        "  @Get()\n" +
        "  findAll(): CategoriasItem[] {\n" +
        "    return this.service.findAll();\n" +
        "  }\n\n" +
        "  @Get(':id')\n" +
        "  findOne(@Param('id') id: string): CategoriasItem {\n" +
        "    return this.service.findOne(id);\n" +
        "  }\n\n" +
        "  @Post()\n" +
        "  create(@Body() data: Omit<CategoriasItem, 'id'>): CategoriasItem {\n" +
        "    return this.service.create(data);\n" +
        "  }\n\n" +
        "  @Patch(':id')\n" +
        "  update(@Param('id') id: string, @Body() data: Partial<Omit<CategoriasItem, 'id'>>): CategoriasItem {\n" +
        "    return this.service.update(id, data);\n" +
        "  }\n\n" +
        "  @Delete(':id')\n" +
        "  remove(@Param('id') id: string): void {\n" +
        "    this.service.remove(id);\n" +
        "  }\n" +
        "}\n",
      module:
        "import { Module } from '@nestjs/common';\n" +
        "import { CategoriasController } from './categorias.controller';\n" +
        "import { CategoriasService } from './categorias.service';\n\n" +
        "@Module({\n" +
        "  controllers: [CategoriasController],\n" +
        "  providers: [CategoriasService],\n" +
        "  exports: [CategoriasService],\n" +
        "})\n" +
        "export class CategoriasModule {}\n",
    };

    /** Movimientos: CRUD completo YA IMPLEMENTADO + una regla/endpoint distintos a los de
     *  Categorías (validación de cantidad + resumen agregado), también ausentes del módulo
     *  de referencia. Sin `.spec.ts`. */
    const movimientos = {
      Name: 'Movimientos',
      service:
        "import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';\n\n" +
        "export interface MovimientosItem {\n" +
        "  id: string;\n" +
        "  tipo: 'entrada' | 'salida';\n" +
        "  cantidad: number;\n" +
        "  referencia: string;\n" +
        "  fecha: string;\n" +
        "}\n\n" +
        "@Injectable()\n" +
        "export class MovimientosService {\n" +
        "  private items: MovimientosItem[] = [];\n" +
        "  private nextId = 1;\n\n" +
        "  findAll(): MovimientosItem[] {\n" +
        "    return this.items;\n" +
        "  }\n\n" +
        "  findOne(id: string): MovimientosItem {\n" +
        "    const item = this.items.find((i) => i.id === id);\n" +
        "    if (!item) throw new NotFoundException(`Movimiento ${id} no encontrado`);\n" +
        "    return item;\n" +
        "  }\n\n" +
        "  /** Regla extra (no está en el módulo de referencia): totales de entradas/salidas y balance. */\n" +
        "  resumen(): { totalEntradas: number; totalSalidas: number; balance: number } {\n" +
        "    const totalEntradas = this.items\n" +
        "      .filter((i) => i.tipo === 'entrada')\n" +
        "      .reduce((sum, i) => sum + i.cantidad, 0);\n" +
        "    const totalSalidas = this.items\n" +
        "      .filter((i) => i.tipo === 'salida')\n" +
        "      .reduce((sum, i) => sum + i.cantidad, 0);\n" +
        "    return { totalEntradas, totalSalidas, balance: totalEntradas - totalSalidas };\n" +
        "  }\n\n" +
        "  create(data: Omit<MovimientosItem, 'id'>): MovimientosItem {\n" +
        "    this.assertCantidadValida(data.cantidad);\n" +
        "    const item: MovimientosItem = { id: String(this.nextId++), ...data };\n" +
        "    this.items.push(item);\n" +
        "    return item;\n" +
        "  }\n\n" +
        "  update(id: string, data: Partial<Omit<MovimientosItem, 'id'>>): MovimientosItem {\n" +
        "    const item = this.findOne(id);\n" +
        "    if (data.cantidad !== undefined) this.assertCantidadValida(data.cantidad);\n" +
        "    Object.assign(item, data);\n" +
        "    return item;\n" +
        "  }\n\n" +
        "  remove(id: string): void {\n" +
        "    const index = this.items.findIndex((i) => i.id === id);\n" +
        "    if (index === -1) throw new NotFoundException(`Movimiento ${id} no encontrado`);\n" +
        "    this.items.splice(index, 1);\n" +
        "  }\n\n" +
        "  /** Regla extra (no está en el módulo de referencia): la cantidad debe ser mayor a 0. */\n" +
        "  private assertCantidadValida(cantidad: number): void {\n" +
        "    if (cantidad <= 0) throw new BadRequestException('La cantidad debe ser mayor a 0');\n" +
        "  }\n" +
        "}\n",
      controller:
        "import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';\n" +
        "import { MovimientosService, MovimientosItem } from './movimientos.service';\n\n" +
        "@Controller('movimientos')\n" +
        "export class MovimientosController {\n" +
        "  constructor(private readonly service: MovimientosService) {}\n\n" +
        "  // Ruta extra (no está en el módulo de referencia). Va ANTES de ':id' para no chocar con esa ruta.\n" +
        "  @Get('resumen')\n" +
        "  resumen() {\n" +
        "    return this.service.resumen();\n" +
        "  }\n\n" +
        "  @Get()\n" +
        "  findAll(): MovimientosItem[] {\n" +
        "    return this.service.findAll();\n" +
        "  }\n\n" +
        "  @Get(':id')\n" +
        "  findOne(@Param('id') id: string): MovimientosItem {\n" +
        "    return this.service.findOne(id);\n" +
        "  }\n\n" +
        "  @Post()\n" +
        "  create(@Body() data: Omit<MovimientosItem, 'id'>): MovimientosItem {\n" +
        "    return this.service.create(data);\n" +
        "  }\n\n" +
        "  @Patch(':id')\n" +
        "  update(@Param('id') id: string, @Body() data: Partial<Omit<MovimientosItem, 'id'>>): MovimientosItem {\n" +
        "    return this.service.update(id, data);\n" +
        "  }\n\n" +
        "  @Delete(':id')\n" +
        "  remove(@Param('id') id: string): void {\n" +
        "    this.service.remove(id);\n" +
        "  }\n" +
        "}\n",
      module:
        "import { Module } from '@nestjs/common';\n" +
        "import { MovimientosController } from './movimientos.controller';\n" +
        "import { MovimientosService } from './movimientos.service';\n\n" +
        "@Module({\n" +
        "  controllers: [MovimientosController],\n" +
        "  providers: [MovimientosService],\n" +
        "  exports: [MovimientosService],\n" +
        "})\n" +
        "export class MovimientosModule {}\n",
    };

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

  
  private buildReactCrudExamFiles(version: ExamVersion) {
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
      `# Examen React — ${version.theme_name}`,
      '',
      `Puntaje total: ${totalPoints} pts`,
      '',
      PlaygroundService.RUBRIC_EXPLICATION,
      '',
      '## Tu API (variante asignada)',
      '',
      `> \`GET/POST ${endpoint}\` y \`GET/PATCH/DELETE ${endpoint}/:id\`.`,
      '',
      `> Campos del recurso: ${fields.map((f) => `\`${f.key}\` (${tsType(f.type)})`).join(', ')}.`,
      '',
      '> Ejemplo de un registro real de tu API (formato JSON de la respuesta):',
      '>',
      '> ```json',
      ...sampleJson.split('\n').map((l) => `> ${l}`),
      '> ```',
      '',
      '## Punto de partida: app "ToDo" completa y funcional',
      '',
      `  El proyecto arranca con una app de ejemplo YA RESUELTA (tareas con \`nombre\` (string),`,
      '  `hecho` (boolean), `duracion` (number) y `presupuesto` (number)), contra otra API distinta a',
      `  la tuya (\`${todoEndpoint}\`), organizada en carpetas por responsabilidad:`,
      '',
      '  - `src/api/todoApi.ts`: interfaz `Todo` + funciones que hacen fetch (GET/POST/PATCH/DELETE).',
      '  - `src/components/Menu.tsx`: menú de navegación superior (los enlaces a cada página).',
      '  - `src/components/TodoForm.tsx`: formulario de alta/edición (sin lógica de datos).',
      '  - `src/components/TodoList.tsx`: lista con acciones de editar/eliminar (sin lógica de datos).',
      '  - `src/pages/Referencia.tsx`: página de CRUD completo (listar/crear/editar/eliminar), arma el',
      '    estado y usa `TodoForm`/`TodoList` para la interfaz.',
      '  - `src/pages/ReferenciaPromedio.tsx`: página de cálculo de ejemplo (promedio de duración).',
      '  - `src/pages/ReferenciaBusqueda.tsx`: página de cálculo de ejemplo (buscador de tareas por texto).',
      '  - `src/router/AppRouter.tsx`: switch de rutas (qué página mostrar) + renderiza el `Menu`.',
      '  - `src/App.tsx`: solo importa los estilos y renderiza `<AppRouter />`.',
      '',
      '  **Tu trabajo es DUPLICAR y ADAPTAR este mismo patrón de carpetas** (podés renombrar archivos y',
      '  componentes con libertad — solo acordate de actualizar los `import` correspondientes) para armar:',
      '',
      '  1. **Pregunta 1** (CRUD): tu propia función de API dentro de `src/api/` (con los campos de tu',
      '     variante, apuntando al endpoint de arriba), tu propio formulario y lista separados en sus',
      '     propios componentes dentro de `src/components/` (igual que `TodoForm.tsx`/`TodoList.tsx`), y',
      '     tu propia página de CRUD dentro de `src/pages/` que los combine (te recomendamos nombrarla',
      '     `Pregunta1.tsx`, función `Pregunta1Page`, o el nombre de tu recurso si preferís).',
      '  2. **Pregunta 2** y **Pregunta 3**: tus propias páginas de cálculo dentro de `src/pages/`',
      '     (te recomendamos `Pregunta2.tsx`/`Pregunta3.tsx`), siguiendo el mismo patrón (fetch →',
      '     calcular → renderizar) que ves en `ReferenciaPromedio.tsx`/`ReferenciaBusqueda.tsx`,',
      '     pero calculando lo que pide cada enunciado de abajo (no el mismo cálculo del ejemplo).',
      '',
      '  Agregá tus páginas nuevas al switch de `src/router/AppRouter.tsx` y sus enlaces al menú en',
      '  `src/components/Menu.tsx`.',
      '',
      '## Preguntas',
      '',
      ...questions.map((q) => `### Pregunta ${q.order}: ${q.title} (${q.points} pts — ${this.buildRubricBreakdown(q.points)})\n\n${q.statement}\n`),
    ].join('\n');

    const hashRouterTsx = [
      "import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';",
      '',
      '/** Router mínimo basado en el hash de la URL (#/ruta), sin dependencias externas. */',
      'function normalize(hash: string) {',
      "  const path = hash.replace(/^#/, '');",
      "  return path === '' ? '/' : path;",
      '}',
      '',
      'export function useHashPath(): string {',
      '  const [path, setPath] = useState(() => normalize(window.location.hash));',
      '',
      '  useEffect(() => {',
      '    function onHashChange() {',
      '      setPath(normalize(window.location.hash));',
      '    }',
      "    window.addEventListener('hashchange', onHashChange);",
      "    return () => window.removeEventListener('hashchange', onHashChange);",
      '  }, []);',
      '',
      '  return path;',
      '}',
      '',
      'interface LinkProps {',
      '  to: string;',
      '  className?: string;',
      '  children: ReactNode;',
      '}',
      '',
      'export function Link({ to, className, children }: LinkProps) {',
      '  // Nota: algunos navegadores no disparan "hashchange" para navegación por hash',
      '  // dentro de iframes en sandbox (como el preview de este Playground), así que',
      '  // actualizamos el hash y disparamos el evento manualmente para no depender de eso.',
      '  function handleClick(e: MouseEvent<HTMLAnchorElement>) {',
      '    e.preventDefault();',
      '    if (window.location.hash !== `#${to}`) {',
      '      window.location.hash = to;',
      '    }',
      "    window.dispatchEvent(new HashChangeEvent('hashchange'));",
      '  }',
      '',
      '  return (',
      '    <a href={`#${to}`} className={className} onClick={handleClick}>',
      '      {children}',
      '    </a>',
      '  );',
      '}',
      '',
    ].join('\n');

    const stylesCss = [
      ':root {',
      '  --bg: #f4f5fb;',
      '  --surface: #ffffff;',
      '  --border: #e2e4f3;',
      '  --text: #1e1b3a;',
      '  --text-muted: #6b7280;',
      '  --primary: #4f46e5;',
      '  --primary-dark: #4338ca;',
      '  --radius: 12px;',
      '  --shadow: 0 1px 3px rgba(30, 27, 58, 0.08), 0 1px 2px rgba(30, 27, 58, 0.06);',
      '}',
      '',
      '* { box-sizing: border-box; }',
      '',
      'body {',
      '  margin: 0;',
      "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
      '  background: var(--bg);',
      '  color: var(--text);',
      '}',
      '',
      '.app-shell { min-height: 100vh; display: flex; flex-direction: column; }',
      '',
      '.navbar {',
      '  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;',
      '  gap: 12px; padding: 14px 24px; background: linear-gradient(135deg, #312e81, #4f46e5);',
      '  color: #fff; box-shadow: var(--shadow);',
      '}',
      '.brand { font-weight: 700; font-size: 1.05rem; letter-spacing: 0.02em; }',
      '.nav-links { display: flex; gap: 6px; flex-wrap: wrap; }',
      '.nav-link {',
      '  color: rgba(255, 255, 255, 0.85); text-decoration: none; padding: 8px 14px;',
      '  border-radius: 999px; font-size: 0.85rem; font-weight: 500;',
      '  transition: background 0.15s ease, color 0.15s ease;',
      '}',
      '.nav-link:hover { background: rgba(255, 255, 255, 0.12); color: #fff; }',
      '.nav-link.active { background: #fff; color: var(--primary-dark); }',
      '',
      '.content { flex: 1; padding: 24px; max-width: 720px; margin: 0 auto; width: 100%; }',
      '.page-title { margin: 0 0 16px; font-size: 1.4rem; }',
      '.card {',
      '  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);',
      '  box-shadow: var(--shadow); padding: 18px 20px; margin-bottom: 16px;',
      '}',
      '.field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }',
      '.field label { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); }',
      '.field input { padding: 9px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 0.9rem; }',
      '.toggle-row { flex-direction: row; align-items: center; gap: 8px; }',
      '.btn {',
      '  border: none; background: var(--primary); color: #fff; padding: 9px 18px; border-radius: 8px;',
      '  font-size: 0.85rem; font-weight: 600; cursor: pointer; margin-right: 8px;',
      '}',
      '.btn:hover { background: var(--primary-dark); }',
      '.list { list-style: none; padding: 0; margin: 12px 0 0; display: flex; flex-direction: column; gap: 8px; }',
      '.list li { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; }',
      '',
    ].join('\n');

    const todoApiTs = [
      'export interface Todo {',
      '  id: string;',
      '  nombre: string;',
      '  hecho: boolean;',
      '  duracion: number;',
      '  presupuesto: number;',
      '}',
      '',
      `const API_URL = '${todoEndpoint}';`,
      '',
      'export async function fetchTodos(): Promise<Todo[]> {',
      '  const res = await fetch(API_URL);',
      '  return res.json();',
      '}',
      '',
      "export async function createTodo(data: Omit<Todo, 'id'>): Promise<Todo> {",
      '  const res = await fetch(API_URL, {',
      "    method: 'POST',",
      "    headers: { 'Content-Type': 'application/json' },",
      '    body: JSON.stringify(data),',
      '  });',
      '  return res.json();',
      '}',
      '',
      "export async function updateTodo(id: string, data: Partial<Omit<Todo, 'id'>>): Promise<Todo> {",
      '  const res = await fetch(`${API_URL}/${id}`, {',
      "    method: 'PATCH',",
      "    headers: { 'Content-Type': 'application/json' },",
      '    body: JSON.stringify(data),',
      '  });',
      '  return res.json();',
      '}',
      '',
      'export async function deleteTodo(id: string): Promise<void> {',
      "  await fetch(`${API_URL}/${id}`, { method: 'DELETE' });",
      '}',
      '',
    ].join('\n');

    const todoFormTsx = [
      "import type { FormEvent } from 'react';",
      '',
      'interface TodoFormValue {',
      '  nombre: string;',
      '  hecho: boolean;',
      '  duracion: number;',
      '  presupuesto: number;',
      '}',
      '',
      '/** Formulario de alta/edición de una tarea (usado por `pages/Referencia.tsx`). */',
      'export function TodoForm({',
      '  form, setForm, editingId, onSubmit, onCancel,',
      '}: {',
      '  form: TodoFormValue;',
      '  setForm: (v: TodoFormValue) => void;',
      '  editingId: string | null;',
      '  onSubmit: (e: FormEvent) => void;',
      '  onCancel: () => void;',
      '}) {',
      '  return (',
      '    <form className="card" onSubmit={onSubmit}>',
      '      <div className="field">',
      '        <label htmlFor="nombre">Nombre</label>',
      '        <input id="nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />',
      '      </div>',
      '      <div className="field">',
      '        <label htmlFor="duracion">Duración (min)</label>',
      '        <input id="duracion" type="number" value={form.duracion} onChange={(e) => setForm({ ...form, duracion: Number(e.target.value) })} />',
      '      </div>',
      '      <div className="field">',
      '        <label htmlFor="presupuesto">Presupuesto</label>',
      '        <input id="presupuesto" type="number" value={form.presupuesto} onChange={(e) => setForm({ ...form, presupuesto: Number(e.target.value) })} />',
      '      </div>',
      '      <div className="field toggle-row">',
      '        <label htmlFor="hecho">Hecho</label>',
      '        <input id="hecho" type="checkbox" checked={form.hecho} onChange={(e) => setForm({ ...form, hecho: e.target.checked })} />',
      '      </div>',
      '      <button className="btn" type="submit">{editingId ? \'Guardar cambios\' : \'Agregar tarea\'}</button>',
      '      {editingId && <button className="btn" type="button" onClick={onCancel}>Cancelar edición</button>}',
      '    </form>',
      '  );',
      '}',
      '',
    ].join('\n');

    const todoListTsx = [
      "import type { Todo } from '../api/todoApi';",
      '',
      '/** Lista de tareas con acciones de editar/eliminar (usada por `pages/Referencia.tsx`). */',
      'export function TodoList({',
      '  todos, onEdit, onDelete,',
      '}: {',
      '  todos: Todo[]; onEdit: (todo: Todo) => void; onDelete: (id: string) => void;',
      '}) {',
      '  return (',
      '    <ul className="list" data-testid="lista-tareas">',
      '      {todos.map((todo) => (',
      '        <li key={todo.id}>',
      '          <strong>{todo.nombre}</strong> — {todo.duracion} min · {todo.presupuesto} · {todo.hecho ? \'hecho\' : \'pendiente\'}',
      '          <button className="btn" onClick={() => onEdit(todo)}>Editar</button>',
      '          <button className="btn" onClick={() => onDelete(todo.id)}>Eliminar</button>',
      '        </li>',
      '      ))}',
      '    </ul>',
      '  );',
      '}',
      '',
    ].join('\n');

    const menuTsx = [
      "import { Link } from '../router/hashRouter';",
      '',
      'const NAV_ITEMS = [',
      "  { to: '/', label: 'Inicio' },",
      "  { to: '/tareas', label: 'Tareas (CRUD Ref)' },",
      "  { to: '/promedio', label: 'Cálculo 1 (Ref)' },",
      "  { to: '/busqueda', label: 'Cálculo 2 (Ref)' },",
      '  // TODO: agregá acá el/los enlace(s) a tus propias páginas (Pregunta 1/2/3).',
      '];',
      '',
      '/** Menú de navegación superior. */',
      'export function Menu({ path }: { path: string }) {',
      '  return (',
      '    <header className="navbar">',
      '      <span className="brand">Base React — Examen</span>',
      '      <nav className="nav-links">',
      '        {NAV_ITEMS.map((item) => (',
      '          <Link key={item.to} to={item.to} className={`nav-link ${path === item.to ? \'active\' : \'\'}`}>',
      '            {item.label}',
      '          </Link>',
      '        ))}',
      '      </nav>',
      '    </header>',
      '  );',
      '}',
      '',
    ].join('\n');

    const homePageTsx = [
      'export function HomePage() {',
      '  return (',
      '    <div className="page">',
      '      <h2 className="page-title">Base React — Referencia ToDo</h2>',
      '      <div className="card">',
      '        <p>',
      '          Usá el menú de arriba para navegar. Este proyecto es un CRUD completo y funcional',
      '          contra una API real (<code>/todo-api/todos</code>), pensado como punto de partida',
      '          para armar el mismo patrón (carpetas `api/`, `components/`, `pages/`, `router/`) contra',
      '          otra API (tu examen asignado).',
      '        </p>',
      '        <p>',
      '          <b>Instrucciones:</b> DUPLICÁ estas páginas y componentes, y adaptalas para tu variante.',
      '          Luego actualizá <code>src/router/AppRouter.tsx</code> (switch de rutas) y',
      '          <code>src/components/Menu.tsx</code> (enlaces) para agregar tus propias pantallas.',
      '        </p>',
      '      </div>',
      '    </div>',
      '  );',
      '}',
      '',
    ].join('\n');

    const referenciaPageTsx = [
      "import { useEffect, useState, type FormEvent } from 'react';",
      "import { Todo, fetchTodos, createTodo, updateTodo, deleteTodo } from '../api/todoApi';",
      "import { TodoForm } from '../components/TodoForm';",
      "import { TodoList } from '../components/TodoList';",
      '',
      "const EMPTY = { nombre: '', hecho: false, duracion: 0, presupuesto: 0 };",
      '',
      'export function ReferenciaPage() {',
      '  const [todos, setTodos] = useState<Todo[]>([]);',
      '  const [loading, setLoading] = useState(true);',
      '  const [editingId, setEditingId] = useState<string | null>(null);',
      '  const [form, setForm] = useState(EMPTY);',
      '',
      '  function load() {',
      '    setLoading(true);',
      '    fetchTodos().then(setTodos).finally(() => setLoading(false));',
      '  }',
      '',
      '  useEffect(() => {',
      '    load();',
      '  }, []);',
      '',
      '  function startCreate() {',
      '    setEditingId(null);',
      '    setForm(EMPTY);',
      '  }',
      '',
      '  function startEdit(todo: Todo) {',
      '    setEditingId(todo.id);',
      '    setForm({ nombre: todo.nombre, hecho: todo.hecho, duracion: todo.duracion, presupuesto: todo.presupuesto });',
      '  }',
      '',
      '  async function handleSubmit(e: FormEvent) {',
      '    e.preventDefault();',
      "    if (form.nombre.trim() === '') return;",
      '    if (editingId) {',
      '      await updateTodo(editingId, form);',
      '    } else {',
      '      await createTodo(form);',
      '    }',
      '    setEditingId(null);',
      '    setForm(EMPTY);',
      '    load();',
      '  }',
      '',
      '  async function handleDelete(id: string) {',
      '    await deleteTodo(id);',
      '    load();',
      '  }',
      '',
      '  return (',
      '    <div className="page">',
      '      <h2 className="page-title">Tareas (CRUD contra /todo-api/todos)</h2>',
      '      <TodoForm form={form} setForm={setForm} editingId={editingId} onSubmit={handleSubmit} onCancel={startCreate} />',
      '      {loading ? <p>Cargando...</p> : <TodoList todos={todos} onEdit={startEdit} onDelete={handleDelete} />}',
      '    </div>',
      '  );',
      '}',
      '',
    ].join('\n');

    const referenciaPromedioPageTsx = [
      "import { useEffect, useState } from 'react';",
      "import { Todo, fetchTodos } from '../api/todoApi';",
      '',
      '/** Ejercicio de lógica de ejemplo: promedio de duración de las tareas. */',
      'export function ReferenciaPromedioPage() {',
      '  const [todos, setTodos] = useState<Todo[]>([]);',
      '  const [loading, setLoading] = useState(true);',
      '',
      '  useEffect(() => {',
      '    fetchTodos().then(setTodos).finally(() => setLoading(false));',
      '  }, []);',
      '',
      '  const promedio = todos.length',
      '    ? todos.reduce((sum, t) => sum + t.duracion, 0) / todos.length',
      '    : 0;',
      '',
      '  return (',
      '    <div className="page">',
      '      <h2 className="page-title">Ejercicio de lógica: promedio de duración</h2>',
      '      <div className="card">',
      '        {loading ? <p>Cargando...</p> : (',
      '          <p data-testid="promedio-duracion">Promedio de duración: {promedio.toFixed(1)} min ({todos.length} tareas)</p>',
      '        )}',
      '      </div>',
      '    </div>',
      '  );',
      '}',
      '',
    ].join('\n');

    const referenciaBusquedaPageTsx = [
      "import { useEffect, useState } from 'react';",
      "import { Todo, fetchTodos } from '../api/todoApi';",
      '',
      '/** Ejercicio de lógica de ejemplo: búsqueda de tareas por nombre. */',
      'export function ReferenciaBusquedaPage() {',
      '  const [todos, setTodos] = useState<Todo[]>([]);',
      "  const [filtro, setFiltro] = useState('');",
      '  const [loading, setLoading] = useState(true);',
      '',
      '  useEffect(() => {',
      '    fetchTodos().then(setTodos).finally(() => setLoading(false));',
      '  }, []);',
      '',
      '  const resultados = todos.filter((t) => t.nombre.toLowerCase().includes(filtro.toLowerCase()));',
      '',
      '  return (',
      '    <div className="page">',
      '      <h2 className="page-title">Ejercicio de lógica: búsqueda de tareas</h2>',
      '      <div className="card">',
      '        <div className="field">',
      '          <label htmlFor="filtro">Buscar</label>',
      '          <input id="filtro" value={filtro} onChange={(e) => setFiltro(e.target.value)} />',
      '        </div>',
      '        {loading ? <p>Cargando...</p> : (',
      '          <>',
      '            <p data-testid="contador-resultados">{resultados.length} resultado(s)</p>',
      '            <ul className="list">',
      '              {resultados.map((t) => <li key={t.id}>{t.nombre}</li>)}',
      '            </ul>',
      '          </>',
      '        )}',
      '      </div>',
      '    </div>',
      '  );',
      '}',
      '',
    ].join('\n');

    const appRouterTsx = [
      "import { useHashPath } from './hashRouter';",
      "import { Menu } from '../components/Menu';",
      "import { HomePage } from '../pages/Home';",
      "import { ReferenciaPage } from '../pages/Referencia';",
      "import { ReferenciaPromedioPage } from '../pages/ReferenciaPromedio';",
      "import { ReferenciaBusquedaPage } from '../pages/ReferenciaBusqueda';",
      '// TODO: importá acá tus propias páginas (Pregunta 1/2/3) a medida que las crees.',
      '',
      '/** Switch de rutas: decide qué página mostrar según el hash de la URL. */',
      'export function AppRouter() {',
      '  const path = useHashPath();',
      '',
      '  let content;',
      '  switch (path) {',
      "    case '/tareas':",
      '      content = <ReferenciaPage />;',
      '      break;',
      "    case '/promedio':",
      '      content = <ReferenciaPromedioPage />;',
      '      break;',
      "    case '/busqueda':",
      '      content = <ReferenciaBusquedaPage />;',
      '      break;',
      '    // TODO: agregá acá un `case` por cada página nueva que crees.',
      '    default:',
      '      content = <HomePage />;',
      '  }',
      '',
      '  return (',
      '    <div className="app-shell">',
      '      <Menu path={path} />',
      '      <main className="content">{content}</main>',
      '    </div>',
      '  );',
      '}',
      '',
    ].join('\n');

    const appTsx = [
      "import './styles.css';",
      "import { AppRouter } from './router/AppRouter';",
      '',
      'export function App() {',
      '  return <AppRouter />;',
      '}',
      '',
    ].join('\n');

    const mainTsx = [
      "import React from 'react';",
      "import ReactDOM from 'react-dom/client';",
      "import { App } from './App';",
      '',
      "ReactDOM.createRoot(document.getElementById('root')!).render(",
      '  <React.StrictMode>',
      '    <App />',
      '  </React.StrictMode>,',
      ');',
      '',
    ].join('\n');

    return [
      { name: 'ENUNCIADO.md', path: '/ENUNCIADO.md', is_folder: false, content: enunciado },
      { name: 'src', path: '/src', is_folder: true, content: '' },
      { name: 'main.tsx', path: '/src/main.tsx', is_folder: false, content: mainTsx },
      { name: 'App.tsx', path: '/src/App.tsx', is_folder: false, content: appTsx },
      { name: 'styles.css', path: '/src/styles.css', is_folder: false, content: stylesCss },
      { name: 'api', path: '/src/api', is_folder: true, content: '' },
      { name: 'todoApi.ts', path: '/src/api/todoApi.ts', is_folder: false, content: todoApiTs },
      { name: 'components', path: '/src/components', is_folder: true, content: '' },
      { name: 'Menu.tsx', path: '/src/components/Menu.tsx', is_folder: false, content: menuTsx },
      { name: 'TodoForm.tsx', path: '/src/components/TodoForm.tsx', is_folder: false, content: todoFormTsx },
      { name: 'TodoList.tsx', path: '/src/components/TodoList.tsx', is_folder: false, content: todoListTsx },
      { name: 'router', path: '/src/router', is_folder: true, content: '' },
      { name: 'hashRouter.tsx', path: '/src/router/hashRouter.tsx', is_folder: false, content: hashRouterTsx },
      { name: 'AppRouter.tsx', path: '/src/router/AppRouter.tsx', is_folder: false, content: appRouterTsx },
      { name: 'pages', path: '/src/pages', is_folder: true, content: '' },
      { name: 'Home.tsx', path: '/src/pages/Home.tsx', is_folder: false, content: homePageTsx },
      { name: 'Referencia.tsx', path: '/src/pages/Referencia.tsx', is_folder: false, content: referenciaPageTsx },
      { name: 'ReferenciaPromedio.tsx', path: '/src/pages/ReferenciaPromedio.tsx', is_folder: false, content: referenciaPromedioPageTsx },
      { name: 'ReferenciaBusqueda.tsx', path: '/src/pages/ReferenciaBusqueda.tsx', is_folder: false, content: referenciaBusquedaPageTsx },
    ];
  }

  private buildReactExamFiles(version: ExamVersion) {
    const questions = [...(version.questions ?? [])].sort((a, b) => a.order - b.order);
    const totalPoints = questions.reduce((sum, q) => sum + (q.points ?? 0), 0);
    const typeSlug = slugify(version.theme_name);
    const variant = getVariantConfig(typeSlug);
    const fields = variant.fields;
    const resource = variant.resource;
    const ClassName = cap(resource);
    const apiBase = 'https://api.franciscohiguera.site/api';
    const endpoint = `${apiBase}/practice-api/${typeSlug}/${resource}`;
    const seeds = variant.seeds.length ? variant.seeds : [{}];
    const textFields = fields.filter((f) => f.type !== 'bool');
    const [f0, f1] = textFields.length ? textFields : fields;

    const fieldValueJsx = (f: { key: string; type: DartFieldType }) =>
      f.type === 'bool' ? `{item.${f.key} ? 'Sí' : 'No'}` : `{item.${f.key}}`;

    const boolField = fields.find((f) => f.type === 'bool') ?? fields[fields.length - 1];

    const itemInterface = [
      `export interface ${ClassName}Item {`,
      `  id: string;`,
      ...fields.map((f) => `  ${f.key}: ${tsType(f.type)};`),
      `}`,
    ].join('\n');

    const seedItems = seeds
      .map((seed, i) => '  ' + JSON.stringify({ id: String(i + 1), ...seed }))
      .join(',\n');

    const sampleJson = JSON.stringify({ id: '1', ...seeds[0] }, null, 2);
    const sampleItem = JSON.stringify({ id: '1', ...seeds[0] });

    const enunciado = [
      `# Examen React — ${version.theme_name}`,
      '',
      `Puntaje total: ${totalPoints} pts`,
      '',
      PlaygroundService.RUBRIC_EXPLICATION,
      '',
      '## Tu recurso de referencia (variante asignada)',
      '',
      `> \`src/components/${ClassName}Card.tsx\` y \`src/pages/${ClassName}ListaPage.tsx\` YA VIENEN RESUELTOS`,
      `> como ejemplo: un componente que muestra un registro de \`${resource}\` (campos:`,
      `> ${fields.map((f) => `\`${f.key}\` (${tsType(f.type)})`).join(', ')}) y una página que consulta tu API`,
      `> real (\`GET ${endpoint}\`) con \`fetch\` y lista los registros que devuelve. \`src/components/Acordeon.tsx\``,
      '> también viene resuelto (componente genérico, sin relación con la API). Las tres piezas traen su',
      '> archivo de test (Vitest + Testing Library) como guía de estilo.',
      '',
      '> Ejemplo de un registro de este recurso:',
      '>',
      '> ```json',
      ...sampleJson.split('\n').map((l) => `> ${l}`),
      '> ```',
      '',
      '## Estructura del proyecto',
      '',
      '  - `src/main.tsx`, `src/App.tsx`, `src/router.tsx` y `src/styles.css`: arman el menú de navegación',
      '    (arriba) y las rutas de las secciones del examen. No necesitás tocarlos.',
      `  - \`src/components/${ClassName}Card.tsx\` y \`src/pages/${ClassName}ListaPage.tsx\`: RESUELTOS (lista de`,
      '    referencia), con sus tests como guía de estilo.',
      '  - `src/components/Acordeon.tsx`: RESUELTO (contenido colapsable), con su test como guía de estilo.',
      `  - \`src/pages/${ClassName}ListaFiltradaPage.tsx\`: **YA IMPLEMENTADA** (2da página de lista: filtra`,
      `    los registros por \`${boolField.key}\` y muestra un contador, usando \`${ClassName}Badge\`). Sin test.`,
      `  - \`src/components/${ClassName}Badge.tsx\`: **YA IMPLEMENTADO** (badge de estado según \`${boolField.key}\`).`,
      '    Sin test.',
      '  - `src/components/ContadorPasos.tsx`: **YA IMPLEMENTADO** (contador que suma/resta de a pasos, sin',
      '    límite superior). Sin test.',
      '  - `src/pages/RegistroPage.tsx`: **YA IMPLEMENTADA** (formulario con validación, sin API). Sin test.',
      '  - `src/pages/BusquedaPage.tsx`: **YA IMPLEMENTADA** (filtro de lista + contador, sin API). Sin test.',
      '',
      '## Tu trabajo',
      '',
      '  Todas las piezas de abajo ya vienen completas: **no tenés que programarlas**, solo escribir los 3',
      `  archivos de test que faltan, siguiendo el mismo estilo que \`${ClassName}Card.test.tsx\`,`,
      `  \`${ClassName}ListaPage.test.tsx\` y \`Acordeon.test.tsx\`. Entre los 3 archivos tenés que sumar`,
      '  **al menos 10 tests en total** (no importa cómo los repartís, mientras cada uno cubra los casos',
      '  pedidos abajo).',
      '  Ojo: cada pieza tiene un comportamiento que NO está en la pieza de referencia — copiar esos tests',
      '  cambiando nombres de variables no te va a alcanzar, tenés que agregar casos de prueba distintos.',
      '',
      `  1. **\`src/pages/${ClassName}ListaFiltradaPage.test.tsx\`** (mínimo 4 tests): mockeá \`fetch\` y`,
      `     verificá que se llama al endpoint correcto; que solo se listan (\`data-testid="lista-filtrada-${resource}"\`)`,
      `     los registros con \`${boolField.key}\` en \`true\`; que el contador (\`data-testid="${resource}-filtrados-count"\`)`,
      '     muestra la cantidad correcta de resultados filtrados; y que si ningún registro cumple la condición',
      '     la lista queda vacía y el contador muestra 0.',
      `  2. **\`src/components/${ClassName}Badge.test.tsx\`** (mínimo 3 tests): con un item con \`${boolField.key}: true\``,
      `     el badge (\`data-testid="${resource}-badge"\`) muestra el texto correspondiente a "Sí"; con`,
      `     \`${boolField.key}: false\` muestra el texto correspondiente a "No"; y el badge cambia de clase CSS`,
      '     según el estado (`badge-on` / `badge-off`).',
      '  3. **`src/components/ContadorPasos.test.tsx`** (mínimo 3 tests): valor inicial en 0; el botón',
      '     `aria-label="Sumar paso"` incrementa el valor mostrado en `data-testid="valor-pasos"` según el',
      '     `paso` configurado (no siempre +1); el botón `aria-label="Restar paso"` no baja el valor de 0',
      '     (se deshabilita en 0).',
      '',
      '  Corré los tests con el botón "Ejecutar tests" (Vitest) para verificar tu propio avance.',
      '',
      '## Preguntas',
      '',
      ...questions.map((q) => `### Pregunta ${q.order}: ${q.title} (${q.points} pts — ${this.buildRubricBreakdown(q.points)})\n\n${q.statement}\n`),
    ].join('\n');

    const cardTsx = [
      itemInterface,
      '',
      `interface ${ClassName}CardProps {`,
      `  item: ${ClassName}Item;`,
      `}`,
      '',
      `export function ${ClassName}Card({ item }: ${ClassName}CardProps) {`,
      `  return (`,
      `    <dl className="card resource-card" data-testid="${resource}-card">`,
      ...fields.flatMap((f) => [
        `      <dt>${f.label}</dt>`,
        `      <dd>${fieldValueJsx(f)}</dd>`,
      ]),
      `    </dl>`,
      `  );`,
      `}`,
      '',
    ].join('\n');

    const cardTest = [
      `import { render, screen } from '@testing-library/react';`,
      `import { ${ClassName}Card } from './${ClassName}Card';`,
      '',
      `const item = ${sampleItem};`,
      '',
      `describe('${ClassName}Card', () => {`,
      `  it('debe mostrar los datos del registro', () => {`,
      `    render(<${ClassName}Card item={item} />);`,
      `    expect(screen.getByTestId('${resource}-card')).toBeInTheDocument();`,
      `    expect(screen.getByText(String(item.${f0.key}))).toBeInTheDocument();`,
      `    expect(screen.getByText(String(item.${f1.key}))).toBeInTheDocument();`,
      `  });`,
      `});`,
      '',
    ].join('\n');

    const listaPageTsx = [
      `import { useEffect, useState } from 'react';`,
      `import { ${ClassName}Card } from '../components/${ClassName}Card';`,
      `import type { ${ClassName}Item } from '../components/${ClassName}Card';`,
      '',
      `/** API real de tu variante — el mismo endpoint que consumen las apps Flutter/React Native. */`,
      `const API_URL = '${endpoint}';`,
      '',
      `export function ${ClassName}ListaPage() {`,
      `  const [items, setItems] = useState<${ClassName}Item[]>([]);`,
      `  const [loading, setLoading] = useState(true);`,
      '',
      `  useEffect(() => {`,
      `    fetch(API_URL)`,
      `      .then((res) => res.json())`,
      `      .then((data) => setItems(data))`,
      `      .finally(() => setLoading(false));`,
      `  }, []);`,
      '',
      `  return (`,
      `    <div className="page">`,
      `      <h2 className="page-title">Lista de ${resource}</h2>`,
      `      {loading ? (`,
      `        <p>Cargando...</p>`,
      `      ) : (`,
      `        <div className="card-grid" data-testid="lista-${resource}">`,
      `          {items.map((item) => (`,
      `            <${ClassName}Card key={item.id} item={item} />`,
      `          ))}`,
      `        </div>`,
      `      )}`,
      `    </div>`,
      `  );`,
      `}`,
      '',
    ].join('\n');

    const listaPageTest = [
      `import { render, screen, waitFor } from '@testing-library/react';`,
      `import { ${ClassName}ListaPage } from './${ClassName}ListaPage';`,
      `import type { ${ClassName}Item } from '../components/${ClassName}Card';`,
      '',
      `// Mockeamos \`fetch\` para no depender de la red durante los tests.`,
      `const mockItems: ${ClassName}Item[] = [`,
      seedItems,
      `];`,
      '',
      `beforeEach(() => {`,
      `  global.fetch = vi.fn().mockResolvedValue({`,
      `    json: () => Promise.resolve(mockItems),`,
      `  } as Response);`,
      `});`,
      '',
      `describe('${ClassName}ListaPage', () => {`,
      `  it('debe consultar la API y renderizar un card por cada registro', async () => {`,
      `    render(<${ClassName}ListaPage />);`,
      `    await waitFor(() => {`,
      `      expect(screen.getAllByTestId('${resource}-card').length).toBe(${seeds.length});`,
      `    });`,
      `    expect(global.fetch).toHaveBeenCalledWith('${endpoint}');`,
      `  });`,
      `});`,
      '',
    ].join('\n');

    const badgeTsx = [
      `import type { ${ClassName}Item } from './${ClassName}Card';`,
      '',
      `interface ${ClassName}BadgeProps {`,
      `  item: ${ClassName}Item;`,
      `}`,
      '',
      `/** Muestra un estado derivado de "${boolField.key}" (sin test todavía — lo escribís vos). */`,
      `export function ${ClassName}Badge({ item }: ${ClassName}BadgeProps) {`,
      `  const activo = Boolean(item.${boolField.key});`,
      '',
      `  return (`,
      `    <span`,
      `      className={\`badge \${activo ? 'badge-on' : 'badge-off'}\`}`,
      `      data-testid="${resource}-badge"`,
      `    >`,
      `      ${boolField.label}: {activo ? 'Sí' : 'No'}`,
      `    </span>`,
      `  );`,
      `}`,
      '',
    ].join('\n');

    const listaFiltradaPageTsx = [
      `import { useEffect, useState } from 'react';`,
      `import { ${ClassName}Badge } from '../components/${ClassName}Badge';`,
      `import type { ${ClassName}Item } from '../components/${ClassName}Card';`,
      '',
      `/** API real de tu variante — el mismo endpoint que consumen las apps Flutter/React Native. */`,
      `const API_URL = '${endpoint}';`,
      '',
      `/** 2da página de lista: a diferencia de ${ClassName}ListaPage, esta filtra por "${boolField.key}"`,
      ` *  y muestra un contador de resultados. Sin test todavía — lo escribís vos. */`,
      `export function ${ClassName}ListaFiltradaPage() {`,
      `  const [items, setItems] = useState<${ClassName}Item[]>([]);`,
      `  const [loading, setLoading] = useState(true);`,
      '',
      `  useEffect(() => {`,
      `    fetch(API_URL)`,
      `      .then((res) => res.json())`,
      `      .then((data) => setItems(data))`,
      `      .finally(() => setLoading(false));`,
      `  }, []);`,
      '',
      `  const filtrados = items.filter((item) => Boolean(item.${boolField.key}));`,
      '',
      `  return (`,
      `    <div className="page">`,
      `      <h2 className="page-title">${ClassName} — ${boolField.label}</h2>`,
      `      {loading ? (`,
      `        <p>Cargando...</p>`,
      `      ) : (`,
      `        <>`,
      `          <p data-testid="${resource}-filtrados-count">{filtrados.length} resultado(s)</p>`,
      `          <ul className="list" data-testid="lista-filtrada-${resource}">`,
      `            {filtrados.map((item) => (`,
      `              <li key={item.id}>`,
      `                <span>${fieldValueJsx(f0)}</span>`,
      `                <${ClassName}Badge item={item} />`,
      `              </li>`,
      `            ))}`,
      `          </ul>`,
      `        </>`,
      `      )}`,
      `    </div>`,
      `  );`,
      `}`,
      '',
    ].join('\n');

    const registroPageTsx = [
      `import { useState, type FormEvent } from 'react';`,
      '',
      `interface Contacto {`,
      `  id: number;`,
      `  nombre: string;`,
      `  edad: number;`,
      `}`,
      '',
      `export function RegistroPage() {`,
      `  const [nombre, setNombre] = useState('');`,
      `  const [edad, setEdad] = useState('');`,
      `  const [error, setError] = useState('');`,
      `  const [contactos, setContactos] = useState<Contacto[]>([]);`,
      '',
      `  function handleSubmit(e: FormEvent) {`,
      `    e.preventDefault();`,
      `    const edadNum = Number(edad);`,
      `    if (nombre.trim() === '' || !Number.isFinite(edadNum) || edadNum <= 0) {`,
      `      setError('Nombre y edad (mayor a 0) son obligatorios');`,
      `      return;`,
      `    }`,
      `    setError('');`,
      `    setContactos((prev) => [...prev, { id: prev.length + 1, nombre: nombre.trim(), edad: edadNum }]);`,
      `    setNombre('');`,
      `    setEdad('');`,
      `  }`,
      '',
      `  return (`,
      `    <div className="page">`,
      `      <h2 className="page-title">Registro de contactos</h2>`,
      `      <form className="card" onSubmit={handleSubmit}>`,
      `        <div className="field">`,
      `          <label htmlFor="nombre">Nombre</label>`,
      `          <input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />`,
      `        </div>`,
      `        <div className="field">`,
      `          <label htmlFor="edad">Edad</label>`,
      `          <input id="edad" value={edad} onChange={(e) => setEdad(e.target.value)} />`,
      `        </div>`,
      `        <button className="btn" type="submit">Agregar</button>`,
      `        {error && <p role="alert" className="alert">{error}</p>}`,
      `      </form>`,
      `      <ul className="list" data-testid="lista-contactos">`,
      `        {contactos.map((c) => (`,
      `          <li key={c.id}>{c.nombre} ({c.edad})</li>`,
      `        ))}`,
      `      </ul>`,
      `    </div>`,
      `  );`,
      `}`,
      '',
    ].join('\n');

    const busquedaPageTsx = [
      `import { useState } from 'react';`,
      '',
      `interface Producto {`,
      `  id: number;`,
      `  nombre: string;`,
      `}`,
      '',
      `const PRODUCTOS: Producto[] = [`,
      `  { id: 1, nombre: 'Teclado mecánico' },`,
      `  { id: 2, nombre: 'Mouse inalámbrico' },`,
      `  { id: 3, nombre: 'Monitor 24 pulgadas' },`,
      `  { id: 4, nombre: 'Silla ergonómica' },`,
      `];`,
      '',
      `export function BusquedaPage() {`,
      `  const [filtro, setFiltro] = useState('');`,
      `  const resultados = PRODUCTOS.filter((p) =>`,
      `    p.nombre.toLowerCase().includes(filtro.toLowerCase()),`,
      `  );`,
      '',
      `  return (`,
      `    <div className="page">`,
      `      <h2 className="page-title">Búsqueda de productos</h2>`,
      `      <div className="card">`,
      `        <div className="field">`,
      `          <label htmlFor="filtro">Filtro</label>`,
      `          <input id="filtro" value={filtro} onChange={(e) => setFiltro(e.target.value)} />`,
      `        </div>`,
      `        <p data-testid="contador-resultados">{resultados.length} resultado(s)</p>`,
      `        <ul className="list">`,
      `          {resultados.map((p) => (`,
      `            <li key={p.id}>{p.nombre}</li>`,
      `          ))}`,
      `        </ul>`,
      `      </div>`,
      `    </div>`,
      `  );`,
      `}`,
      '',
    ].join('\n');

    const acordeonTsx = [
      `import { useState } from 'react';`,
      '',
      `interface AcordeonProps {`,
      `  titulo?: string;`,
      `}`,
      '',
      `/** Contenido colapsable — genérico, sin relación con la API de tu variante. */`,
      `export function Acordeon({ titulo = 'Ver detalles' }: AcordeonProps) {`,
      `  const [abierto, setAbierto] = useState(false);`,
      '',
      `  return (`,
      `    <div className="card acordeon">`,
      `      <button className="btn acordeon-toggle" onClick={() => setAbierto((v) => !v)}>`,
      `        {abierto ? 'Ocultar' : titulo}`,
      `      </button>`,
      `      {abierto && (`,
      `        <div className="acordeon-contenido" data-testid="acordeon-contenido">`,
      `          Este contenido solo se muestra cuando el acordeón está abierto.`,
      `        </div>`,
      `      )}`,
      `    </div>`,
      `  );`,
      `}`,
      '',
    ].join('\n');

    const acordeonTest = [
      `import { render, screen, fireEvent } from '@testing-library/react';`,
      `import { Acordeon } from './Acordeon';`,
      '',
      `describe('Acordeon', () => {`,
      `  it('oculta el contenido inicialmente y lo muestra/oculta al hacer click', () => {`,
      `    render(<Acordeon />);`,
      `    expect(screen.queryByTestId('acordeon-contenido')).not.toBeInTheDocument();`,
      '',
      `    fireEvent.click(screen.getByRole('button'));`,
      `    expect(screen.getByTestId('acordeon-contenido')).toBeInTheDocument();`,
      '',
      `    fireEvent.click(screen.getByRole('button'));`,
      `    expect(screen.queryByTestId('acordeon-contenido')).not.toBeInTheDocument();`,
      `  });`,
      `});`,
      '',
    ].join('\n');

    const contadorPasosTsx = [
      `import { useState } from 'react';`,
      '',
      `interface ContadorPasosProps {`,
      `  paso?: number;`,
      `}`,
      '',
      `/** Contador genérico que suma/resta de a "paso" (sin límite superior). Sin test todavía — lo`,
      ` *  escribís vos. */`,
      `export function ContadorPasos({ paso = 1 }: ContadorPasosProps) {`,
      `  const [valor, setValor] = useState(0);`,
      '',
      `  return (`,
      `    <div className="card counter-row">`,
      `      <button`,
      `        className="btn"`,
      `        aria-label="Restar paso"`,
      `        onClick={() => setValor((v) => Math.max(0, v - paso))}`,
      `        disabled={valor <= 0}`,
      `      >`,
      `        -{paso}`,
      `      </button>`,
      `      <span className="counter-value" data-testid="valor-pasos">{valor}</span>`,
      `      <button className="btn" aria-label="Sumar paso" onClick={() => setValor((v) => v + paso)}>`,
      `        +{paso}`,
      `      </button>`,
      `    </div>`,
      `  );`,
      `}`,
      '',
    ].join('\n');

    const routerTsx = [
      `import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';`,
      '',
      `/** Router mínimo basado en el hash de la URL (#/ruta), sin dependencias externas. */`,
      `function normalize(hash: string) {`,
      `  const path = hash.replace(/^#/, '');`,
      `  return path === '' ? '/' : path;`,
      `}`,
      '',
      `export function useHashPath(): string {`,
      `  const [path, setPath] = useState(() => normalize(window.location.hash));`,
      '',
      `  useEffect(() => {`,
      `    function onHashChange() {`,
      `      setPath(normalize(window.location.hash));`,
      `    }`,
      `    window.addEventListener('hashchange', onHashChange);`,
      `    return () => window.removeEventListener('hashchange', onHashChange);`,
      `  }, []);`,
      '',
      `  return path;`,
      `}`,
      '',
      `interface LinkProps {`,
      `  to: string;`,
      `  className?: string;`,
      `  children: ReactNode;`,
      `}`,
      '',
      `export function Link({ to, className, children }: LinkProps) {`,
      `  // Nota: algunos navegadores no disparan "hashchange" para navegación por hash`,
      `  // dentro de iframes en sandbox (como el preview de este Playground), así que`,
      `  // actualizamos el hash y disparamos el evento manualmente para no depender de eso.`,
      `  function handleClick(e: MouseEvent<HTMLAnchorElement>) {`,
      `    e.preventDefault();`,
      `    if (window.location.hash !== \`#\${to}\`) {`,
      `      window.location.hash = to;`,
      `    }`,
      `    window.dispatchEvent(new HashChangeEvent('hashchange'));`,
      `  }`,
      '',
      `  return (`,
      `    <a href={\`#\${to}\`} className={className} onClick={handleClick}>`,
      `      {children}`,
      `    </a>`,
      `  );`,
      `}`,
      '',
    ].join('\n');

    const stylesCss = [
      `:root {`,
      `  --bg: #f4f5fb;`,
      `  --surface: #ffffff;`,
      `  --border: #e2e4f3;`,
      `  --text: #1e1b3a;`,
      `  --text-muted: #6b7280;`,
      `  --primary: #4f46e5;`,
      `  --primary-dark: #4338ca;`,
      `  --danger: #dc2626;`,
      `  --danger-bg: #fee2e2;`,
      `  --success: #16a34a;`,
      `  --success-bg: #dcfce7;`,
      `  --radius: 12px;`,
      `  --shadow: 0 1px 3px rgba(30, 27, 58, 0.08), 0 1px 2px rgba(30, 27, 58, 0.06);`,
      `}`,
      '',
      `* { box-sizing: border-box; }`,
      '',
      `body {`,
      `  margin: 0;`,
      `  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;`,
      `  background: var(--bg);`,
      `  color: var(--text);`,
      `}`,
      '',
      `.app-shell { min-height: 100vh; display: flex; flex-direction: column; }`,
      '',
      `.navbar {`,
      `  display: flex;`,
      `  align-items: center;`,
      `  justify-content: space-between;`,
      `  flex-wrap: wrap;`,
      `  gap: 12px;`,
      `  padding: 14px 24px;`,
      `  background: linear-gradient(135deg, #312e81, #4f46e5);`,
      `  color: #fff;`,
      `  box-shadow: var(--shadow);`,
      `}`,
      '',
      `.brand { font-weight: 700; font-size: 1.05rem; letter-spacing: 0.02em; }`,
      '',
      `.nav-links { display: flex; gap: 6px; flex-wrap: wrap; }`,
      '',
      `.nav-link {`,
      `  color: rgba(255, 255, 255, 0.85);`,
      `  text-decoration: none;`,
      `  padding: 8px 14px;`,
      `  border-radius: 999px;`,
      `  font-size: 0.85rem;`,
      `  font-weight: 500;`,
      `  transition: background 0.15s ease, color 0.15s ease;`,
      `}`,
      '',
      `.nav-link:hover { background: rgba(255, 255, 255, 0.12); color: #fff; }`,
      '',
      `.nav-link.active { background: #fff; color: var(--primary-dark); }`,
      '',
      `.content { flex: 1; padding: 24px; max-width: 960px; margin: 0 auto; width: 100%; }`,
      '',
      `.page-title { margin: 0 0 16px; font-size: 1.4rem; }`,
      '',
      `.card {`,
      `  background: var(--surface);`,
      `  border: 1px solid var(--border);`,
      `  border-radius: var(--radius);`,
      `  box-shadow: var(--shadow);`,
      `  padding: 18px 20px;`,
      `  margin-bottom: 16px;`,
      `}`,
      '',
      `.card-grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }`,
      '',
      `.resource-card dt { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); margin-top: 10px; }`,
      `.resource-card dt:first-child { margin-top: 0; }`,
      `.resource-card dd { margin: 2px 0 0; font-weight: 600; }`,
      '',
      `.field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }`,
      `.field label { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); }`,
      `.field input { padding: 9px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 0.9rem; }`,
      `.field input:focus { outline: 2px solid var(--primary); outline-offset: 1px; }`,
      '',
      `.btn {`,
      `  border: none;`,
      `  background: var(--primary);`,
      `  color: #fff;`,
      `  padding: 9px 18px;`,
      `  border-radius: 8px;`,
      `  font-size: 0.85rem;`,
      `  font-weight: 600;`,
      `  cursor: pointer;`,
      `  transition: background 0.15s ease;`,
      `}`,
      `.btn:hover { background: var(--primary-dark); }`,
      `.btn:disabled { background: #c7c9e6; cursor: not-allowed; }`,
      '',
      `.alert {`,
      `  background: var(--danger-bg);`,
      `  color: var(--danger);`,
      `  padding: 10px 14px;`,
      `  border-radius: 8px;`,
      `  font-size: 0.85rem;`,
      `  margin: 10px 0 0;`,
      `}`,
      '',
      `.list { list-style: none; padding: 0; margin: 12px 0 0; display: flex; flex-direction: column; gap: 8px; }`,
      `.list li { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }`,
      '',
      `.counter-row { display: flex; align-items: center; gap: 14px; }`,
      `.counter-value { font-size: 1.4rem; font-weight: 700; min-width: 2ch; text-align: center; }`,
      '',
      `.toggle-row { display: flex; align-items: center; gap: 10px; }`,
      '',
      `.badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 0.78rem; font-weight: 600; }`,
      `.badge-on { background: var(--success-bg); color: var(--success); }`,
      `.badge-off { background: var(--danger-bg); color: var(--danger); }`,
      '',
      `.acordeon-toggle { margin-bottom: 0; }`,
      `.acordeon-contenido { margin-top: 12px; color: var(--text-muted); font-size: 0.9rem; }`,
      '',
    ].join('\n');

    const appTsx = [
      `import './styles.css';`,
      `import { useHashPath, Link } from './router';`,
      `import { ${ClassName}ListaPage } from './pages/${ClassName}ListaPage';`,
      `import { ${ClassName}ListaFiltradaPage } from './pages/${ClassName}ListaFiltradaPage';`,
      `import { RegistroPage } from './pages/RegistroPage';`,
      `import { BusquedaPage } from './pages/BusquedaPage';`,
      `import { Acordeon } from './components/Acordeon';`,
      `import { ContadorPasos } from './components/ContadorPasos';`,
      '',
      `const NAV_ITEMS = [`,
      `  { to: '/', label: 'Inicio' },`,
      `  { to: '/lista', label: '${ClassName}' },`,
      `  { to: '/lista-filtrada', label: '${ClassName} (filtrados)' },`,
      `  { to: '/registro', label: 'Registro' },`,
      `  { to: '/busqueda', label: 'Búsqueda' },`,
      `  { to: '/componentes', label: 'Componentes' },`,
      `];`,
      '',
      `function HomePage() {`,
      `  return (`,
      `    <div className="page">`,
      `      <h2 className="page-title">Examen React — ${version.theme_name}</h2>`,
      `      <div className="card">`,
      `        <p>Usá el menú de arriba para navegar entre las secciones del examen.</p>`,
      `      </div>`,
      `    </div>`,
      `  );`,
      `}`,
      '',
      `function ComponentesPage() {`,
      `  return (`,
      `    <div className="page">`,
      `      <h2 className="page-title">Componentes</h2>`,
      `      <h3>Acordeón (resuelto, con test)</h3>`,
      `      <Acordeon />`,
      `      <h3>Contador de a pasos (sin test todavía)</h3>`,
      `      <ContadorPasos paso={2} />`,
      `    </div>`,
      `  );`,
      `}`,
      '',
      `export function App() {`,
      `  const path = useHashPath();`,
      '',
      `  let content;`,
      `  switch (path) {`,
      `    case '/lista':`,
      `      content = <${ClassName}ListaPage />;`,
      `      break;`,
      `    case '/lista-filtrada':`,
      `      content = <${ClassName}ListaFiltradaPage />;`,
      `      break;`,
      `    case '/registro':`,
      `      content = <RegistroPage />;`,
      `      break;`,
      `    case '/busqueda':`,
      `      content = <BusquedaPage />;`,
      `      break;`,
      `    case '/componentes':`,
      `      content = <ComponentesPage />;`,
      `      break;`,
      `    default:`,
      `      content = <HomePage />;`,
      `  }`,
      '',
      `  return (`,
      `    <div className="app-shell">`,
      `      <header className="navbar">`,
      `        <span className="brand">Examen React</span>`,
      `        <nav className="nav-links">`,
      `          {NAV_ITEMS.map((item) => (`,
      `            <Link`,
      `              key={item.to}`,
      `              to={item.to}`,
      `              className={\`nav-link \${path === item.to ? 'active' : ''}\`}`,
      `            >`,
      `              {item.label}`,
      `            </Link>`,
      `          ))}`,
      `        </nav>`,
      `      </header>`,
      `      <main className="content">{content}</main>`,
      `    </div>`,
      `  );`,
      `}`,
      '',
    ].join('\n');

    const mainTsx = [
      `import React from 'react';`,
      `import ReactDOM from 'react-dom/client';`,
      `import { App } from './App';`,
      '',
      `ReactDOM.createRoot(document.getElementById('root')!).render(`,
      `  <React.StrictMode>`,
      `    <App />`,
      `  </React.StrictMode>,`,
      `);`,
      '',
    ].join('\n');

    return [
      { name: 'ENUNCIADO.md', path: '/ENUNCIADO.md', content: enunciado, is_folder: false },
      { name: 'src', path: '/src', content: '', is_folder: true },
      { name: 'main.tsx', path: '/src/main.tsx', content: mainTsx, is_folder: false },
      { name: 'App.tsx', path: '/src/App.tsx', content: appTsx, is_folder: false },
      { name: 'router.tsx', path: '/src/router.tsx', content: routerTsx, is_folder: false },
      { name: 'styles.css', path: '/src/styles.css', content: stylesCss, is_folder: false },

      { name: 'components', path: '/src/components', content: '', is_folder: true },
      { name: `${ClassName}Card.tsx`, path: `/src/components/${ClassName}Card.tsx`, content: cardTsx, is_folder: false },
      { name: `${ClassName}Card.test.tsx`, path: `/src/components/${ClassName}Card.test.tsx`, content: cardTest, is_folder: false },
      { name: 'Acordeon.tsx', path: '/src/components/Acordeon.tsx', content: acordeonTsx, is_folder: false },
      { name: 'Acordeon.test.tsx', path: '/src/components/Acordeon.test.tsx', content: acordeonTest, is_folder: false },
      { name: `${ClassName}Badge.tsx`, path: `/src/components/${ClassName}Badge.tsx`, content: badgeTsx, is_folder: false },
      { name: 'ContadorPasos.tsx', path: '/src/components/ContadorPasos.tsx', content: contadorPasosTsx, is_folder: false },

      { name: 'pages', path: '/src/pages', content: '', is_folder: true },
      { name: `${ClassName}ListaPage.tsx`, path: `/src/pages/${ClassName}ListaPage.tsx`, content: listaPageTsx, is_folder: false },
      { name: `${ClassName}ListaPage.test.tsx`, path: `/src/pages/${ClassName}ListaPage.test.tsx`, content: listaPageTest, is_folder: false },
      { name: `${ClassName}ListaFiltradaPage.tsx`, path: `/src/pages/${ClassName}ListaFiltradaPage.tsx`, content: listaFiltradaPageTsx, is_folder: false },
      { name: 'RegistroPage.tsx', path: '/src/pages/RegistroPage.tsx', content: registroPageTsx, is_folder: false },
      { name: 'BusquedaPage.tsx', path: '/src/pages/BusquedaPage.tsx', content: busquedaPageTsx, is_folder: false },
    ];
  }

  /**
   * Variante Cypress del examen de React: mismo proyecto base (componentes/páginas, router,
   * estilos) que `buildReactExamFiles`, pero en vez de Vitest + Testing Library se evalúa con
   * specs E2E de Cypress. El playground NO ejecuta Cypress en vivo (no hay navegador real ni
   * servidor de desarrollo persistente en el sandbox de ejecución de este backend) — por eso
   * el proyecto incluye `package.json`/`vite.config.ts`/`index.html`/`cypress.config.ts` para
   * que se corra LOCALMENTE (`npm install`, `npm run dev` + `npm run cy:run`). La corrección
   * es manual, igual que React Native/Flutter.
   */
  private buildReactCypressExamFiles(version: ExamVersion) {
    const questions = [...(version.questions ?? [])].sort((a, b) => a.order - b.order);
    const totalPoints = questions.reduce((sum, q) => sum + (q.points ?? 0), 0);
    const typeSlug = slugify(version.theme_name);
    const variant = getVariantConfig(typeSlug);
    const fields = variant.fields;
    const resource = variant.resource;
    const ClassName = cap(resource);
    const apiBase = 'https://api.franciscohiguera.site/api';
    const endpoint = `${apiBase}/practice-api/${typeSlug}/${resource}`;
    const seeds = variant.seeds.length ? variant.seeds : [{}];
    const textFields = fields.filter((f) => f.type !== 'bool');
    const [f0] = textFields.length ? textFields : fields;

    const fieldValueJsx = (f: { key: string; type: DartFieldType }) =>
      f.type === 'bool' ? `{item.${f.key} ? 'Sí' : 'No'}` : `{item.${f.key}}`;

    const itemInterface = [
      `export interface ${ClassName}Item {`,
      `  id: string;`,
      ...fields.map((f) => `  ${f.key}: ${tsType(f.type)};`),
      `}`,
    ].join('\n');

    const sampleJson = JSON.stringify({ id: '1', ...seeds[0] }, null, 2);

    const enunciado = [
      `# Examen React + Cypress — ${version.theme_name}`,
      '',
      `Puntaje total: ${totalPoints} pts`,
      '',
      PlaygroundService.RUBRIC_EXPLICATION,
      '',
      '## Tu recurso de referencia (variante asignada)',
      '',
      `> \`src/components/${ClassName}Card.tsx\` y \`src/pages/${ClassName}ListaPage.tsx\` YA VIENEN`,
      `> RESUELTOS como ejemplo: un componente que muestra un registro de \`${resource}\``,
      `> (campos: ${fields.map((f) => `\`${f.key}\` (${tsType(f.type)})`).join(', ')}) y una página que`,
      `> consulta tu API real (\`GET ${endpoint}\`) con \`fetch\` y lista los registros que devuelve,`,
      `> con un spec de Cypress (\`cypress/e2e/${resource}-lista.cy.ts\`) como guía de estilo.`,
      '',
      '> Ejemplo de un registro de este recurso:',
      '>',
      '> ```json',
      ...sampleJson.split('\n').map((l) => `> ${l}`),
      '> ```',
      '',
      '## Cómo correr este proyecto localmente',
      '',
      '  Este examen se evalúa con Cypress (specs E2E contra un navegador real), algo que este',
      '  playground no puede ejecutar en vivo (no hay servidor persistente ni navegador real en',
      '  el sandbox de ejecución). Para correr los tests:',
      '',
      '  1. `npm install` (instala React, Vite y Cypress — la primera vez Cypress también',
      '     descarga su binario de navegador, necesita conexión a internet).',
      '  2. `npm run dev` (dejá este proceso corriendo — sirve la app en `http://localhost:5173`).',
      '  3. En otra terminal: `npm run cy:open` (modo interactivo) o `npm run cy:run` (modo',
      '     headless, ideal para corrección).',
      '',
      '  El botón "Ejecutar tests" del playground no aplica a este examen: la corrección es',
      '  manual (tu profesor corre `npm run cy:run` localmente sobre tu proyecto).',
      '',
      '## Estructura del proyecto',
      '',
      '  - `src/main.tsx`, `src/App.tsx`, `src/router.tsx` y `src/styles.css`: arman el menú de',
      '    navegación (arriba) y las rutas de las 5 secciones del examen. No necesitás tocarlos.',
      `  - \`src/components/${ClassName}Card.tsx\` y \`src/pages/${ClassName}ListaPage.tsx\`: RESUELTOS,`,
      `    con \`cypress/e2e/${resource}-lista.cy.ts\` como guía de estilo.`,
      '  - `src/pages/RegistroPage.tsx`: **YA IMPLEMENTADA** (formulario con validación). Sin spec.',
      '  - `src/pages/BusquedaPage.tsx`: **YA IMPLEMENTADA** (filtro de lista + contador). Sin spec.',
      '  - `src/components/ContadorLimite.tsx`: **YA IMPLEMENTADO** (contador con límites). Sin spec.',
      '  - `src/components/ToggleControl.tsx`: **YA IMPLEMENTADO** (checkbox que habilita/deshabilita otro campo). Sin spec.',
      '  - `cypress/e2e/${resource}-lista.cy.ts`: RESUELTO, guía de estilo para tus specs.',
      '  - `cypress/support/`: soporte estándar de Cypress. No necesitás tocarlo.',
      '',
      '## Tu trabajo',
      '',
      '  Las 4 piezas de abajo ya vienen completas: **no tenés que programarlas**, solo escribir',
      `  los specs E2E que faltan en \`cypress/e2e/\`, siguiendo el mismo estilo que`,
      `  \`${resource}-lista.cy.ts\`. Ojo: cada pieza tiene un comportamiento que NO está en la`,
      '  pieza de referencia — copiar ese spec cambiando selectores no te va a alcanzar, tenés',
      '  que agregar casos de prueba distintos.',
      '',
      '  1. **`cypress/e2e/registro.cy.ts`** (mínimo 3 tests, navegando a `/#/registro`): la lista',
      '     de contactos (`data-testid="lista-contactos"`) inicia vacía; al completar nombre y',
      '     edad válidos y enviar el formulario, el contacto se agrega a la lista y el formulario',
      '     se limpia; al enviar con nombre vacío o edad inválida (no numérica o menor/igual a 0)',
      '     se muestra un elemento con `role="alert"` y NO se agrega nada.',
      '  2. **`cypress/e2e/busqueda.cy.ts`** (mínimo 3 tests, navegando a `/#/busqueda`): al',
      '     renderizar se muestran los 4 productos iniciales; al escribir un texto en el input',
      '     `#filtro` la lista se filtra (sin distinguir mayúsculas/minúsculas) y',
      '     `data-testid="contador-resultados"` refleja la cantidad correcta; si el filtro no',
      '     coincide con ningún producto se muestra "0 resultado(s)".',
      '  3. **`cypress/e2e/contador-limite.cy.ts`** (mínimo 4 tests, navegando a',
      '     `/#/componentes`): valor inicial correcto; el botón `aria-label="Sumar"` incrementa',
      '     el valor mostrado en `data-testid="valor-contador"`; el valor no baja del mínimo (el',
      '     botón `aria-label="Restar"` se deshabilita en el mínimo); el valor no sube del',
      '     máximo (el botón `aria-label="Sumar"` se deshabilita en el máximo).',
      '  4. **`cypress/e2e/toggle-control.cy.ts`** (mínimo 3 tests, navegando a',
      '     `/#/componentes`): el input `aria-label="Campo editable"` empieza deshabilitado; al',
      '     marcar el checkbox `#habilitar` el campo se habilita; al desmarcarlo el campo vuelve',
      '     a deshabilitarse.',
      '',
      '## Preguntas',
      '',
      ...questions.map((q) => `### Pregunta ${q.order}: ${q.title} (${q.points} pts — ${this.buildRubricBreakdown(q.points)})\n\n${q.statement}\n`),
    ].join('\n');

    const cardTsx = [
      itemInterface,
      '',
      `interface ${ClassName}CardProps {`,
      `  item: ${ClassName}Item;`,
      `}`,
      '',
      `export function ${ClassName}Card({ item }: ${ClassName}CardProps) {`,
      `  return (`,
      `    <dl className="card resource-card" data-testid="${resource}-card">`,
      ...fields.flatMap((f) => [
        `      <dt>${f.label}</dt>`,
        `      <dd>${fieldValueJsx(f)}</dd>`,
      ]),
      `    </dl>`,
      `  );`,
      `}`,
      '',
    ].join('\n');

    const listaPageTsx = [
      `import { useEffect, useState } from 'react';`,
      `import { ${ClassName}Card } from '../components/${ClassName}Card';`,
      `import type { ${ClassName}Item } from '../components/${ClassName}Card';`,
      '',
      `/** API real de tu variante — el mismo endpoint que consumen las apps Flutter/React Native. */`,
      `const API_URL = '${endpoint}';`,
      '',
      `export function ${ClassName}ListaPage() {`,
      `  const [items, setItems] = useState<${ClassName}Item[]>([]);`,
      `  const [loading, setLoading] = useState(true);`,
      '',
      `  useEffect(() => {`,
      `    fetch(API_URL)`,
      `      .then((res) => res.json())`,
      `      .then((data) => setItems(data))`,
      `      .finally(() => setLoading(false));`,
      `  }, []);`,
      '',
      `  return (`,
      `    <div className="page">`,
      `      <h2 className="page-title">Lista de ${resource}</h2>`,
      `      {loading ? (`,
      `        <p>Cargando...</p>`,
      `      ) : (`,
      `        <div className="card-grid" data-testid="lista-${resource}">`,
      `          {items.map((item) => (`,
      `            <${ClassName}Card key={item.id} item={item} />`,
      `          ))}`,
      `        </div>`,
      `      )}`,
      `    </div>`,
      `  );`,
      `}`,
      '',
    ].join('\n');

    const registroPageTsx = [
      `import { useState, type FormEvent } from 'react';`,
      '',
      `interface Contacto {`,
      `  id: number;`,
      `  nombre: string;`,
      `  edad: number;`,
      `}`,
      '',
      `export function RegistroPage() {`,
      `  const [nombre, setNombre] = useState('');`,
      `  const [edad, setEdad] = useState('');`,
      `  const [error, setError] = useState('');`,
      `  const [contactos, setContactos] = useState<Contacto[]>([]);`,
      '',
      `  function handleSubmit(e: FormEvent) {`,
      `    e.preventDefault();`,
      `    const edadNum = Number(edad);`,
      `    if (nombre.trim() === '' || !Number.isFinite(edadNum) || edadNum <= 0) {`,
      `      setError('Nombre y edad (mayor a 0) son obligatorios');`,
      `      return;`,
      `    }`,
      `    setError('');`,
      `    setContactos((prev) => [...prev, { id: prev.length + 1, nombre: nombre.trim(), edad: edadNum }]);`,
      `    setNombre('');`,
      `    setEdad('');`,
      `  }`,
      '',
      `  return (`,
      `    <div className="page">`,
      `      <h2 className="page-title">Registro de contactos</h2>`,
      `      <form className="card" onSubmit={handleSubmit}>`,
      `        <div className="field">`,
      `          <label htmlFor="nombre">Nombre</label>`,
      `          <input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />`,
      `        </div>`,
      `        <div className="field">`,
      `          <label htmlFor="edad">Edad</label>`,
      `          <input id="edad" value={edad} onChange={(e) => setEdad(e.target.value)} />`,
      `        </div>`,
      `        <button className="btn" type="submit">Agregar</button>`,
      `        {error && <p role="alert" className="alert">{error}</p>}`,
      `      </form>`,
      `      <ul className="list" data-testid="lista-contactos">`,
      `        {contactos.map((c) => (`,
      `          <li key={c.id}>{c.nombre} ({c.edad})</li>`,
      `        ))}`,
      `      </ul>`,
      `    </div>`,
      `  );`,
      `}`,
      '',
    ].join('\n');

    const busquedaPageTsx = [
      `import { useState } from 'react';`,
      '',
      `interface Producto {`,
      `  id: number;`,
      `  nombre: string;`,
      `}`,
      '',
      `const PRODUCTOS: Producto[] = [`,
      `  { id: 1, nombre: 'Teclado mecánico' },`,
      `  { id: 2, nombre: 'Mouse inalámbrico' },`,
      `  { id: 3, nombre: 'Monitor 24 pulgadas' },`,
      `  { id: 4, nombre: 'Silla ergonómica' },`,
      `];`,
      '',
      `export function BusquedaPage() {`,
      `  const [filtro, setFiltro] = useState('');`,
      `  const resultados = PRODUCTOS.filter((p) =>`,
      `    p.nombre.toLowerCase().includes(filtro.toLowerCase()),`,
      `  );`,
      '',
      `  return (`,
      `    <div className="page">`,
      `      <h2 className="page-title">Búsqueda de productos</h2>`,
      `      <div className="card">`,
      `        <div className="field">`,
      `          <label htmlFor="filtro">Filtro</label>`,
      `          <input id="filtro" value={filtro} onChange={(e) => setFiltro(e.target.value)} />`,
      `        </div>`,
      `        <p data-testid="contador-resultados">{resultados.length} resultado(s)</p>`,
      `        <ul className="list">`,
      `          {resultados.map((p) => (`,
      `            <li key={p.id}>{p.nombre}</li>`,
      `          ))}`,
      `        </ul>`,
      `      </div>`,
      `    </div>`,
      `  );`,
      `}`,
      '',
    ].join('\n');

    const contadorLimiteTsx = [
      `import { useState } from 'react';`,
      '',
      `interface ContadorLimiteProps {`,
      `  min?: number;`,
      `  max?: number;`,
      `}`,
      '',
      `export function ContadorLimite({ min = 0, max = 10 }: ContadorLimiteProps) {`,
      `  const [valor, setValor] = useState(min);`,
      '',
      `  return (`,
      `    <div className="card counter-row">`,
      `      <button className="btn" aria-label="Restar" onClick={() => setValor((v) => Math.max(min, v - 1))} disabled={valor <= min}>`,
      `        -`,
      `      </button>`,
      `      <span className="counter-value" data-testid="valor-contador">{valor}</span>`,
      `      <button className="btn" aria-label="Sumar" onClick={() => setValor((v) => Math.min(max, v + 1))} disabled={valor >= max}>`,
      `        +`,
      `      </button>`,
      `    </div>`,
      `  );`,
      `}`,
      '',
    ].join('\n');

    const toggleControlTsx = [
      `import { useState } from 'react';`,
      '',
      `export function ToggleControl() {`,
      `  const [habilitado, setHabilitado] = useState(false);`,
      '',
      `  return (`,
      `    <div className="card toggle-row">`,
      `      <label htmlFor="habilitar">Habilitar campo</label>`,
      `      <input`,
      `        id="habilitar"`,
      `        type="checkbox"`,
      `        checked={habilitado}`,
      `        onChange={(e) => setHabilitado(e.target.checked)}`,
      `      />`,
      `      <input className="field" aria-label="Campo editable" disabled={!habilitado} />`,
      `    </div>`,
      `  );`,
      `}`,
      '',
    ].join('\n');

    const routerTsx = [
      `import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';`,
      '',
      `/** Router mínimo basado en el hash de la URL (#/ruta), sin dependencias externas. */`,
      `function normalize(hash: string) {`,
      `  const path = hash.replace(/^#/, '');`,
      `  return path === '' ? '/' : path;`,
      `}`,
      '',
      `export function useHashPath(): string {`,
      `  const [path, setPath] = useState(() => normalize(window.location.hash));`,
      '',
      `  useEffect(() => {`,
      `    function onHashChange() {`,
      `      setPath(normalize(window.location.hash));`,
      `    }`,
      `    window.addEventListener('hashchange', onHashChange);`,
      `    return () => window.removeEventListener('hashchange', onHashChange);`,
      `  }, []);`,
      '',
      `  return path;`,
      `}`,
      '',
      `interface LinkProps {`,
      `  to: string;`,
      `  className?: string;`,
      `  children: ReactNode;`,
      `}`,
      '',
      `export function Link({ to, className, children }: LinkProps) {`,
      `  // Nota: algunos navegadores no disparan "hashchange" para navegación por hash`,
      `  // dentro de iframes en sandbox (como el preview de este Playground), así que`,
      `  // actualizamos el hash y disparamos el evento manualmente para no depender de eso.`,
      `  function handleClick(e: MouseEvent<HTMLAnchorElement>) {`,
      `    e.preventDefault();`,
      `    if (window.location.hash !== \`#\${to}\`) {`,
      `      window.location.hash = to;`,
      `    }`,
      `    window.dispatchEvent(new HashChangeEvent('hashchange'));`,
      `  }`,
      '',
      `  return (`,
      `    <a href={\`#\${to}\`} className={className} onClick={handleClick}>`,
      `      {children}`,
      `    </a>`,
      `  );`,
      `}`,
      '',
    ].join('\n');

    const stylesCss = [
      `:root {`,
      `  --bg: #f4f5fb;`,
      `  --surface: #ffffff;`,
      `  --border: #e2e4f3;`,
      `  --text: #1e1b3a;`,
      `  --text-muted: #6b7280;`,
      `  --primary: #4f46e5;`,
      `  --primary-dark: #4338ca;`,
      `  --danger: #dc2626;`,
      `  --danger-bg: #fee2e2;`,
      `  --radius: 12px;`,
      `  --shadow: 0 1px 3px rgba(30, 27, 58, 0.08), 0 1px 2px rgba(30, 27, 58, 0.06);`,
      `}`,
      '',
      `* { box-sizing: border-box; }`,
      '',
      `body {`,
      `  margin: 0;`,
      `  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;`,
      `  background: var(--bg);`,
      `  color: var(--text);`,
      `}`,
      '',
      `.app-shell { min-height: 100vh; display: flex; flex-direction: column; }`,
      '',
      `.navbar {`,
      `  display: flex;`,
      `  align-items: center;`,
      `  justify-content: space-between;`,
      `  flex-wrap: wrap;`,
      `  gap: 12px;`,
      `  padding: 14px 24px;`,
      `  background: linear-gradient(135deg, #312e81, #4f46e5);`,
      `  color: #fff;`,
      `  box-shadow: var(--shadow);`,
      `}`,
      '',
      `.brand { font-weight: 700; font-size: 1.05rem; letter-spacing: 0.02em; }`,
      '',
      `.nav-links { display: flex; gap: 6px; flex-wrap: wrap; }`,
      '',
      `.nav-link {`,
      `  color: rgba(255, 255, 255, 0.85);`,
      `  text-decoration: none;`,
      `  padding: 8px 14px;`,
      `  border-radius: 999px;`,
      `  font-size: 0.85rem;`,
      `  font-weight: 500;`,
      `  transition: background 0.15s ease, color 0.15s ease;`,
      `}`,
      '',
      `.nav-link:hover { background: rgba(255, 255, 255, 0.12); color: #fff; }`,
      '',
      `.nav-link.active { background: #fff; color: var(--primary-dark); }`,
      '',
      `.content { flex: 1; padding: 24px; max-width: 960px; margin: 0 auto; width: 100%; }`,
      '',
      `.page-title { margin: 0 0 16px; font-size: 1.4rem; }`,
      '',
      `.card {`,
      `  background: var(--surface);`,
      `  border: 1px solid var(--border);`,
      `  border-radius: var(--radius);`,
      `  box-shadow: var(--shadow);`,
      `  padding: 18px 20px;`,
      `  margin-bottom: 16px;`,
      `}`,
      '',
      `.card-grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }`,
      '',
      `.resource-card dt { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); margin-top: 10px; }`,
      `.resource-card dt:first-child { margin-top: 0; }`,
      `.resource-card dd { margin: 2px 0 0; font-weight: 600; }`,
      '',
      `.field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }`,
      `.field label { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); }`,
      `.field input { padding: 9px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 0.9rem; }`,
      `.field input:focus { outline: 2px solid var(--primary); outline-offset: 1px; }`,
      '',
      `.btn {`,
      `  border: none;`,
      `  background: var(--primary);`,
      `  color: #fff;`,
      `  padding: 9px 18px;`,
      `  border-radius: 8px;`,
      `  font-size: 0.85rem;`,
      `  font-weight: 600;`,
      `  cursor: pointer;`,
      `  transition: background 0.15s ease;`,
      `}`,
      `.btn:hover { background: var(--primary-dark); }`,
      `.btn:disabled { background: #c7c9e6; cursor: not-allowed; }`,
      '',
      `.alert {`,
      `  background: var(--danger-bg);`,
      `  color: var(--danger);`,
      `  padding: 10px 14px;`,
      `  border-radius: 8px;`,
      `  font-size: 0.85rem;`,
      `  margin: 10px 0 0;`,
      `}`,
      '',
      `.list { list-style: none; padding: 0; margin: 12px 0 0; display: flex; flex-direction: column; gap: 8px; }`,
      `.list li { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; }`,
      '',
      `.counter-row { display: flex; align-items: center; gap: 14px; }`,
      `.counter-value { font-size: 1.4rem; font-weight: 700; min-width: 2ch; text-align: center; }`,
      '',
      `.toggle-row { display: flex; align-items: center; gap: 10px; }`,
      '',
    ].join('\n');

    const appTsx = [
      `import './styles.css';`,
      `import { useHashPath, Link } from './router';`,
      `import { ${ClassName}ListaPage } from './pages/${ClassName}ListaPage';`,
      `import { RegistroPage } from './pages/RegistroPage';`,
      `import { BusquedaPage } from './pages/BusquedaPage';`,
      `import { ContadorLimite } from './components/ContadorLimite';`,
      `import { ToggleControl } from './components/ToggleControl';`,
      '',
      `const NAV_ITEMS = [`,
      `  { to: '/', label: 'Inicio' },`,
      `  { to: '/lista', label: '${ClassName}' },`,
      `  { to: '/registro', label: 'Registro' },`,
      `  { to: '/busqueda', label: 'Búsqueda' },`,
      `  { to: '/componentes', label: 'Componentes' },`,
      `];`,
      '',
      `function HomePage() {`,
      `  return (`,
      `    <div className="page">`,
      `      <h2 className="page-title">Examen React + Cypress — ${version.theme_name}</h2>`,
      `      <div className="card">`,
      `        <p>Usá el menú de arriba para navegar entre las secciones del examen.</p>`,
      `      </div>`,
      `    </div>`,
      `  );`,
      `}`,
      '',
      `function ComponentesPage() {`,
      `  return (`,
      `    <div className="page">`,
      `      <h2 className="page-title">Componentes</h2>`,
      `      <h3>Contador con límites</h3>`,
      `      <ContadorLimite />`,
      `      <h3>Toggle de habilitación</h3>`,
      `      <ToggleControl />`,
      `    </div>`,
      `  );`,
      `}`,
      '',
      `export function App() {`,
      `  const path = useHashPath();`,
      '',
      `  let content;`,
      `  switch (path) {`,
      `    case '/lista':`,
      `      content = <${ClassName}ListaPage />;`,
      `      break;`,
      `    case '/registro':`,
      `      content = <RegistroPage />;`,
      `      break;`,
      `    case '/busqueda':`,
      `      content = <BusquedaPage />;`,
      `      break;`,
      `    case '/componentes':`,
      `      content = <ComponentesPage />;`,
      `      break;`,
      `    default:`,
      `      content = <HomePage />;`,
      `  }`,
      '',
      `  return (`,
      `    <div className="app-shell">`,
      `      <header className="navbar">`,
      `        <span className="brand">Examen React + Cypress</span>`,
      `        <nav className="nav-links">`,
      `          {NAV_ITEMS.map((item) => (`,
      `            <Link`,
      `              key={item.to}`,
      `              to={item.to}`,
      `              className={\`nav-link \${path === item.to ? 'active' : ''}\`}`,
      `            >`,
      `              {item.label}`,
      `            </Link>`,
      `          ))}`,
      `        </nav>`,
      `      </header>`,
      `      <main className="content">{content}</main>`,
      `    </div>`,
      `  );`,
      `}`,
      '',
    ].join('\n');

    const mainTsx = [
      `import React from 'react';`,
      `import ReactDOM from 'react-dom/client';`,
      `import { App } from './App';`,
      '',
      `ReactDOM.createRoot(document.getElementById('root')!).render(`,
      `  <React.StrictMode>`,
      `    <App />`,
      `  </React.StrictMode>,`,
      `);`,
      '',
    ].join('\n');

    const packageJson = JSON.stringify(
      {
        name: 'examen-react-cypress',
        private: true,
        version: '1.0.0',
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'tsc -b && vite build',
          'cy:open': 'cypress open',
          'cy:run': 'cypress run',
        },
        dependencies: {
          react: '^18.3.1',
          'react-dom': '^18.3.1',
        },
        devDependencies: {
          '@vitejs/plugin-react': '^4.2.1',
          cypress: '^13.15.0',
          typescript: '^5.9.3',
          vite: '^5.4.21',
        },
      },
      null,
      2,
    );

    const viteConfigTs = [
      `import { defineConfig } from 'vite';`,
      `import react from '@vitejs/plugin-react';`,
      '',
      `export default defineConfig({`,
      `  plugins: [react()],`,
      `});`,
      '',
    ].join('\n');

    const tsconfigJson = JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          useDefineForClassFields: true,
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          skipLibCheck: true,
          moduleResolution: 'bundler',
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: 'react-jsx',
          strict: true,
        },
        include: ['src'],
      },
      null,
      2,
    );

    const indexHtml = [
      `<!doctype html>`,
      `<html lang="es">`,
      `  <head>`,
      `    <meta charset="UTF-8" />`,
      `    <title>Examen React + Cypress — ${version.theme_name}</title>`,
      `  </head>`,
      `  <body>`,
      `    <div id="root"></div>`,
      `    <script type="module" src="/src/main.tsx"></script>`,
      `  </body>`,
      `</html>`,
      '',
    ].join('\n');

    const cypressConfigTs = [
      `import { defineConfig } from 'cypress';`,
      '',
      `export default defineConfig({`,
      `  e2e: {`,
      `    baseUrl: 'http://localhost:5173',`,
      `  },`,
      `});`,
      '',
    ].join('\n');

    const cypressSupportE2eTs = [`import './commands';`, ''].join('\n');

    const cypressSupportCommandsTs = [
      `// Comandos personalizados de Cypress para este examen (ninguno por ahora).`,
      '',
    ].join('\n');

    const listaCySpec = [
      `describe('${ClassName}ListaPage (E2E)', () => {`,
      `  it('navega a /#/lista y muestra al menos un registro de ${resource}', () => {`,
      `    cy.visit('/#/lista');`,
      `    cy.get('[data-testid="lista-${resource}"]').should('exist');`,
      `    cy.get('[data-testid="${resource}-card"]').should('have.length.at.least', 1);`,
      `  });`,
      '',
      `  it('cada card muestra el campo "${f0.label}"', () => {`,
      `    cy.visit('/#/lista');`,
      `    cy.get('[data-testid="${resource}-card"]').first().should('be.visible');`,
      `  });`,
      `});`,
      '',
    ].join('\n');

    return [
      { name: 'ENUNCIADO.md', path: '/ENUNCIADO.md', content: enunciado, is_folder: false },
      { name: 'package.json', path: '/package.json', content: packageJson, is_folder: false },
      { name: 'vite.config.ts', path: '/vite.config.ts', content: viteConfigTs, is_folder: false },
      { name: 'tsconfig.json', path: '/tsconfig.json', content: tsconfigJson, is_folder: false },
      { name: 'index.html', path: '/index.html', content: indexHtml, is_folder: false },
      { name: 'cypress.config.ts', path: '/cypress.config.ts', content: cypressConfigTs, is_folder: false },

      { name: 'src', path: '/src', content: '', is_folder: true },
      { name: 'main.tsx', path: '/src/main.tsx', content: mainTsx, is_folder: false },
      { name: 'App.tsx', path: '/src/App.tsx', content: appTsx, is_folder: false },
      { name: 'router.tsx', path: '/src/router.tsx', content: routerTsx, is_folder: false },
      { name: 'styles.css', path: '/src/styles.css', content: stylesCss, is_folder: false },

      { name: 'components', path: '/src/components', content: '', is_folder: true },
      { name: `${ClassName}Card.tsx`, path: `/src/components/${ClassName}Card.tsx`, content: cardTsx, is_folder: false },
      { name: 'ContadorLimite.tsx', path: '/src/components/ContadorLimite.tsx', content: contadorLimiteTsx, is_folder: false },
      { name: 'ToggleControl.tsx', path: '/src/components/ToggleControl.tsx', content: toggleControlTsx, is_folder: false },

      { name: 'pages', path: '/src/pages', content: '', is_folder: true },
      { name: `${ClassName}ListaPage.tsx`, path: `/src/pages/${ClassName}ListaPage.tsx`, content: listaPageTsx, is_folder: false },
      { name: 'RegistroPage.tsx', path: '/src/pages/RegistroPage.tsx', content: registroPageTsx, is_folder: false },
      { name: 'BusquedaPage.tsx', path: '/src/pages/BusquedaPage.tsx', content: busquedaPageTsx, is_folder: false },

      { name: 'cypress', path: '/cypress', content: '', is_folder: true },
      { name: 'support', path: '/cypress/support', content: '', is_folder: true },
      { name: 'e2e.ts', path: '/cypress/support/e2e.ts', content: cypressSupportE2eTs, is_folder: false },
      { name: 'commands.ts', path: '/cypress/support/commands.ts', content: cypressSupportCommandsTs, is_folder: false },
      { name: 'e2e', path: '/cypress/e2e', content: '', is_folder: true },
      { name: `${resource}-lista.cy.ts`, path: `/cypress/e2e/${resource}-lista.cy.ts`, content: listaCySpec, is_folder: false },
    ];
  }

  /**
   * Andamiaje de React Native: el preview (Expo Snack, vía `ReactNativePreviewPanel`) SOLO
   * toma un único archivo `App.tsx` — no bundlea proyectos multi-archivo — así que, a
   * diferencia de Flutter/React, todo el examen vive en un solo archivo.
   *
   * El archivo arranca con una app "ToDo" COMPLETA y funcional (mismo modelo de referencia
   * que Flutter: `nombre`/`hecho`/`duracion`/`presupuesto`, contra `/todo-api/todos`) más 3
   * pantallas STUB (sin implementar) ya cableadas en el menú, que el alumno debe completar
   * duplicando/adaptando el patrón de la referencia:
   *   - Pregunta 1 (CRUD de su propia variante, contra su propio endpoint de práctica).
   *   - Preguntas 2 y 3 (pantallas de cálculo, mismo patrón fetch → calcular → mostrar).
   *
   * No hay tests (no existe test runner de React Native en este backend) — grading manual,
   * igual que Flutter.
   */
  private buildReactNativeExamFiles(version: ExamVersion) {
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
      `# Examen React Native — ${version.theme_name}`,
      '',
      `Puntaje total: ${totalPoints} pts`,
      '',
      PlaygroundService.RUBRIC_EXPLICATION,
      '',
      '## Tu API (variante asignada)',
      '',
      `> \`GET/POST ${endpoint}\` y \`GET/PATCH/DELETE ${endpoint}/:id\`.`,
      '',
      `> Campos del recurso: ${fields.map((f) => `\`${f.key}\` (${tsType(f.type)})`).join(', ')}.`,
      '',
      '> Ejemplo de un registro real de tu API (formato JSON de la respuesta):',
      '>',
      '> ```json',
      ...sampleJson.split('\n').map((l) => `> ${l}`),
      '> ```',
      '',
      '## Punto de partida: app "ToDo" completa y funcional',
      '',
      '  El proyecto está organizado por capas, como una app React Native real:',
      '',
      '  - `App.tsx`: punto de entrada, solo renderiza el router.',
      '  - `src/router/AppRouter.tsx`: guarda la pantalla activa y hace el switch entre páginas.',
      '  - `src/components/Menu.tsx`: menú de navegación (reutilizado por el router).',
      '  - `src/components/TareaForm.tsx` / `src/components/TareaList.tsx`: el formulario y la lista',
      '    de la Referencia, separados en sus propios componentes reutilizables.',
      '  - `src/components/FloatingActionButton.tsx`: botón flotante ("+") reutilizable para navegar',
      '    a la pantalla de "nuevo registro".',
      '  - `src/models/todo.ts`: modelo de referencia (interfaz `Todo`).',
      '  - `src/api/referenciaApi.ts`: API de referencia (fetch/create/update/delete de `Todo`,',
      '    importado desde `src/models/todo.ts`).',
      '  - `src/api/pregunta1Api.ts`: API de tu variante — a completar (nombre genérico:',
      '    DEBÉS renombrarlo de acuerdo a tu recurso).',
      '  - `src/models/pregunta1.ts`: acá vas a definir el modelo (interfaz) de tu variante —',
      '    viene vacío, con instrucciones en un comentario (nombre genérico: también a renombrar).',
      '  - `src/styles.ts`: estilos compartidos por todas las páginas.',
      '  - `src/pages/*.tsx`: una página por archivo.',
      '',
      '  El preview carga todos estos archivos, no solo `App.tsx`.',
      '',
      '  La página **`src/pages/Referencia.tsx`** ya viene RESUELTA: un CRUD completo (tareas con',
      '  `nombre` (string), `hecho` (bool), `duracion` (number) y `presupuesto` (number)) contra',
      `  otra API distinta a la tuya (\`${todoEndpoint}\`), más 2 páginas de cálculo de ejemplo`,
      '  (`src/pages/ReferenciaPromedio.tsx` / `src/pages/ReferenciaBusqueda.tsx`). Fijate cómo el',
      '  formulario y la lista NO están escritos dentro de `Referencia.tsx`: viven en',
      '  `src/components/TareaForm.tsx` y `src/components/TareaList.tsx`, y la página solo maneja',
      '  el estado y los llama. Podés navegar a esa sección desde el menú ("Referencia") para ver',
      '  cómo funciona antes de escribir la tuya.',
      '',
      '  **Importante — la lista y el formulario NO se muestran juntos en la misma pantalla.**',
      '  `Referencia.tsx` guarda un estado `view: \'list\' | \'form\'` y muestra una de las dos vistas:',
      '',
      '  - Vista **lista**: muestra `TareaList` con un `FloatingActionButton` ("+") flotante para',
      '    crear un registro nuevo (navega a la vista formulario, vacío).',
      '  - Vista **formulario**: muestra `TareaForm`, con un botón "←" arriba para volver a la lista',
      '    sin guardar. Tocar el ícono de editar (✎) de un ítem en la lista también navega a esta',
      '    vista, pero con los datos de ese ítem precargados.',
      '  - En `TareaList`, los botones de editar/eliminar de cada fila son solo ÍCONOS (sin texto):',
      '    "✎" para editar y "🗑" para eliminar (usá texto/emoji simple — el preview no soporta',
      '    librerías de íconos como `@expo/vector-icons`).',
      '',
      '  **Tu trabajo es DUPLICAR y ADAPTAR ese mismo patrón** (fetch → estado → render, con el',
      '  formulario y la lista separados en sus propios componentes dentro de `src/components/`,',
      '  la lista y el formulario como vistas separadas con un `FloatingActionButton` para crear, y',
      '  botones de editar/eliminar con ícono en vez de texto) dentro de las 3 páginas marcadas con',
      '  `// TODO` en `src/pages/`, apoyándote en `src/api/pregunta1Api.ts` y en el modelo que',
      '  definas en `src/models/pregunta1.ts` (ambos también marcados con `// TODO`):',
      '  `Pregunta1.tsx`, `Pregunta2.tsx`, `Pregunta3.tsx`.',
      '  No hace falta que borres la sección de referencia: podés dejarla como guía y solo',
      '  completar las 3 páginas propias.',
      '',
      '  1. **Pregunta 1** (`src/pages/Pregunta1.tsx` + `src/api/pregunta1Api.ts` + tu propio',
      '     modelo en `src/models/pregunta1.ts`): CRUD (listar/crear/editar/eliminar) contra el',
      '     endpoint de arriba. Primero definí el modelo con los campos de tu variante (ver',
      '     "Campos del recurso" arriba), y después implementá las 4 funciones de la API',
      '     usándolo. Te recomendamos crear tu propio formulario y lista como componentes separados en',
      '     `src/components/` (igual que `TareaForm.tsx`/`TareaList.tsx`), la lista y el formulario',
      '     como vistas separadas (no juntas en la misma pantalla) con un `FloatingActionButton`',
      '     para crear, y los botones de editar/eliminar de la lista como ícono (sin texto), igual',
      '     que en la Referencia.',
      '  2. **Pregunta 2** (`src/pages/Pregunta2.tsx`) y **Pregunta 3** (`src/pages/Pregunta3.tsx`):',
      '     tus propias páginas de cálculo, siguiendo el mismo patrón que `ReferenciaPromedio.tsx`/',
      '     `ReferenciaBusqueda.tsx`, pero calculando lo que pide cada enunciado de abajo (no el',
      '     mismo cálculo del ejemplo).',
      '',
      '  **Importante — renombrá TODO lo genérico según tu variante:** `Pregunta1.tsx` (función',
      '  `Pregunta1Page`, ítem de menú "Pregunta 1"), `src/api/pregunta1Api.ts` y',
      '  `src/models/pregunta1.ts` vienen con nombres genéricos a propósito — DEBÉS renombrarlos',
      '  vos de acuerdo al recurso de tu variante y a la regla de negocio del enunciado, y también',
      '  nombrar tus propios componentes de lista/formulario (si los separás como en la',
      '  Referencia). Por ejemplo, con nombres **ilustrativos que NO se relacionan con ninguna',
      '  variante real** (elegí vos el nombre según tu propio recurso — no copies este ejemplo):',
      '  si tu recurso fuera "fruta", podrías terminar con `src/models/fruta.ts` (interfaz',
      '  `Fruta`), `src/api/frutaApi.ts`, `src/components/ListaFruta.tsx` /',
      '  `src/components/FormFruta.tsx`, y la página `src/pages/Frutas.tsx` (función',
      '  `FrutasPage`, menú "Frutas"). Actualizá también el import y el `case` correspondiente en',
      '  `src/router/AppRouter.tsx` y la etiqueta en `src/components/Menu.tsx`.',
      '',
      '  No hay tests automáticos para React Native en esta plataforma — la corrección de este',
      '  examen es manual (tu profesor revisa el código y prueba el preview).',
      '',
      '## Preguntas',
      '',
      ...questions.map((q) => `### Pregunta ${q.order}: ${q.title} (${q.points} pts — ${this.buildRubricBreakdown(q.points)})\n\n${q.statement}\n`),
    ].join('\n');

    const referenciaModelTs = [
      'export interface Todo {',
      '  id: string;',
      '  nombre: string;',
      '  hecho: boolean;',
      '  duracion: number;',
      '  presupuesto: number;',
      '}',
      '',
    ].join('\n');

    const referenciaApiTs = [
      "import { Todo } from '../models/todo';",
      '',
      `const TODO_API_URL = '${todoEndpoint}';`,
      '',
      'export async function fetchTodos(): Promise<Todo[]> {',
      '  const res = await fetch(TODO_API_URL);',
      '  return res.json();',
      '}',
      '',
      "export async function createTodo(data: Omit<Todo, 'id'>): Promise<Todo> {",
      '  const res = await fetch(TODO_API_URL, {',
      "    method: 'POST',",
      "    headers: { 'Content-Type': 'application/json' },",
      '    body: JSON.stringify(data),',
      '  });',
      '  return res.json();',
      '}',
      '',
      "export async function updateTodo(id: string, data: Omit<Todo, 'id'>): Promise<Todo> {",
      '  const res = await fetch(`${TODO_API_URL}/${id}`, {',
      "    method: 'PATCH',",
      "    headers: { 'Content-Type': 'application/json' },",
      '    body: JSON.stringify(data),',
      '  });',
      '  return res.json();',
      '}',
      '',
      'export async function deleteTodo(id: string): Promise<void> {',
      "  await fetch(`${TODO_API_URL}/${id}`, { method: 'DELETE' });",
      '}',
      '',
    ].join('\n');

    const pregunta1ModelTs = [
      '// TODO: definí acá el modelo (interfaz TypeScript) de tu recurso, con los campos',
      '// indicados en la sección "Campos del recurso" de ENUNCIADO.md (no te olvides de',
      '// `id: string`). Por ejemplo (nombre y campos ilustrativos, NO relacionados con tu',
      '// variante real):',
      '//',
      '//   export interface Fruta {',
      '//     id: string;',
      '//     nombre: string;',
      '//     stock: number;',
      '//   }',
      '//',
      '// Renombrá también este archivo de acuerdo a tu propio recurso (por ejemplo',
      '// `fruta.ts` — nombre ilustrativo, elegí el que corresponda al tuyo).',
      '',
    ].join('\n');

    const pregunta1ApiTs = [
      "// TODO: 1) Definí primero tu modelo en `src/models/pregunta1.ts` (ver instrucciones",
      '// ahí). 2) Importalo acá reemplazando los `any` de abajo por tu tipo real. 3) Renombrá',
      '// este archivo (y el modelo) de acuerdo a tu recurso y regla de negocio — evitá',
      '// dejarlos como "pregunta1Api"/"pregunta1" (ver ENUNCIADO.md para ver un ejemplo',
      '// ilustrativo de nombres).',
      '',
      `const API_URL = '${endpoint}';`,
      '',
      '// TODO: duplicá el patrón de `src/api/referenciaApi.ts`, implementando estas 4',
      '// funciones contra API_URL (definida arriba), usando tu propio modelo en vez de `any`.',
      '',
      'export async function fetchItems(): Promise<any[]> {',
      "  throw new Error('TODO: implementar fetchItems');",
      '}',
      '',
      'export async function createItem(data: any): Promise<any> {',
      "  throw new Error('TODO: implementar createItem');",
      '}',
      '',
      'export async function updateItem(id: string, data: any): Promise<any> {',
      "  throw new Error('TODO: implementar updateItem');",
      '}',
      '',
      'export async function deleteItem(id: string): Promise<void> {',
      "  throw new Error('TODO: implementar deleteItem');",
      '}',
      '',
    ].join('\n');

    const stylesTs = [
      "import { StyleSheet } from 'react-native';",
      '',
      'export const styles = StyleSheet.create({',
      "  app: { flex: 1, backgroundColor: '#f4f5fb' },",
      '  menu: {',
      "    flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#4338ca',",
      '    paddingTop: 40, paddingBottom: 10, paddingHorizontal: 10, gap: 6,',
      '  },',
      '  menuBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },',
      "  menuBtnActive: { backgroundColor: '#ffffff' },",
      "  menuBtnText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },",
      "  menuBtnTextActive: { color: '#4338ca' },",
      '  content: { flex: 1, padding: 16 },',
      '  card: {',
      "    backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 12,",
      "    borderWidth: 1, borderColor: '#e2e4f3',",
      '  },',
      "  title: { fontSize: 16, fontWeight: '700', marginBottom: 10 },",
      '  input: {',
      "    borderWidth: 1, borderColor: '#e2e4f3', borderRadius: 8, padding: 10, marginBottom: 10,",
      '  },',
      "  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },",
      '  btn: {',
      "    backgroundColor: '#4f46e5', borderRadius: 8, paddingVertical: 10, alignItems: 'center',",
      '    marginBottom: 12,',
      '  },',
      '  btnSmall: {',
      "    backgroundColor: '#4f46e5', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10,",
      '    marginRight: 8, marginTop: 6,',
      '  },',
      "  btnText: { color: '#fff', fontWeight: '600' },",
      '  listItem: {',
      "    borderTopWidth: 1, borderTopColor: '#e2e4f3', paddingVertical: 10,",
      "    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',",
      '  },',
      '  listItemText: { fontSize: 13, flex: 1, marginRight: 8 },',
      '  listContainer: { flex: 1 },',
      '  fab: {',
      "    position: 'absolute', right: 16, bottom: 16, width: 56, height: 56, borderRadius: 28,",
      "    backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center',",
      "    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4,",
      '    shadowOffset: { width: 0, height: 2 }, elevation: 4,',
      '  },',
      "  fabText: { color: '#fff', fontSize: 28, fontWeight: '700', lineHeight: 30 },",
      '  formHeader: {',
      "    flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8,",
      '  },',
      '  backBtn: { padding: 4 },',
      "  backBtnText: { color: '#4f46e5', fontSize: 20, fontWeight: '700' },",
      '  iconBtn: {',
      "    width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center',",
      '    marginLeft: 8,',
      '  },',
      "  iconBtnEdit: { backgroundColor: '#4f46e5' },",
      "  iconBtnDelete: { backgroundColor: '#dc2626' },",
      "  iconBtnText: { color: '#fff', fontSize: 15 },",
      '});',
      '',
    ].join('\n');

    const floatingActionButtonTsx = [
      "import { Text, TouchableOpacity } from 'react-native';",
      "import { styles } from '../styles';",
      '',
      '/**',
      ' * Botón circular flotante (FAB) sobre la lista, para navegar a la pantalla',
      ' * de "nuevo registro". Reutilizable por cualquier página con lista + form.',
      ' */',
      'export function FloatingActionButton({ onPress }: { onPress: () => void }) {',
      '  return (',
      '    <TouchableOpacity style={styles.fab} onPress={onPress} accessibilityLabel="Agregar">',
      '      <Text style={styles.fabText}>+</Text>',
      '    </TouchableOpacity>',
      '  );',
      '}',
      '',
    ].join('\n');

    const tareaFormTsx = [
      "import { View, Text, TextInput, TouchableOpacity, Switch } from 'react-native';",
      "import { styles } from '../styles';",
      '',
      '/**',
      ' * Formulario de alta/edición de una tarea — pantalla separada de la lista',
      ' * (usado por `pages/Referencia.tsx`, que decide cuándo mostrarlo).',
      ' */',
      'export function TareaForm({',
      '  nombre, setNombre,',
      '  duracion, setDuracion,',
      '  presupuesto, setPresupuesto,',
      '  hecho, setHecho,',
      '  editingId, onSubmit, onCancel,',
      '}: {',
      '  nombre: string; setNombre: (v: string) => void;',
      '  duracion: string; setDuracion: (v: string) => void;',
      '  presupuesto: string; setPresupuesto: (v: string) => void;',
      '  hecho: boolean; setHecho: (v: boolean) => void;',
      '  editingId: string | null; onSubmit: () => void;',
      '  /** Vuelve a la lista sin guardar (botón "←" del encabezado). */',
      '  onCancel: () => void;',
      '}) {',
      '  return (',
      '    <View>',
      '      <View style={styles.formHeader}>',
      '        <TouchableOpacity style={styles.backBtn} onPress={onCancel} accessibilityLabel="Volver a la lista">',
      '          <Text style={styles.backBtnText}>←</Text>',
      '        </TouchableOpacity>',
      "        <Text style={styles.title}>{editingId ? 'Editar tarea' : 'Nueva tarea'}</Text>",
      '      </View>',
      '      <TextInput style={styles.input} placeholder="Nombre" value={nombre} onChangeText={setNombre} />',
      '      <TextInput style={styles.input} placeholder="Duración (min)" value={duracion} onChangeText={setDuracion} keyboardType="numeric" />',
      '      <TextInput style={styles.input} placeholder="Presupuesto" value={presupuesto} onChangeText={setPresupuesto} keyboardType="numeric" />',
      '      <View style={styles.row}>',
      '        <Text>Hecho</Text>',
      '        <Switch value={hecho} onValueChange={setHecho} />',
      '      </View>',
      '      <TouchableOpacity style={styles.btn} onPress={onSubmit}>',
      "        <Text style={styles.btnText}>{editingId ? 'Guardar cambios' : 'Agregar tarea'}</Text>",
      '      </TouchableOpacity>',
      '    </View>',
      '  );',
      '}',
      '',
    ].join('\n');

    const tareaListTsx = [
      "import { View, Text, TouchableOpacity, FlatList } from 'react-native';",
      "import { Todo } from '../models/todo';",
      "import { styles } from '../styles';",
      '',
      '/**',
      ' * Lista de tareas — separada del formulario (usada por `pages/Referencia.tsx`).',
      ' * Las acciones de editar/eliminar son solo íconos (sin texto) para no saturar la fila.',
      ' */',
      'export function TareaList({',
      '  todos, onEdit, onDelete,',
      '}: {',
      '  todos: Todo[]; onEdit: (todo: Todo) => void; onDelete: (id: string) => void;',
      '}) {',
      '  return (',
      '    <FlatList',
      '      data={todos}',
      '      keyExtractor={(item) => item.id}',
      '      renderItem={({ item }) => (',
      '        <View style={styles.listItem}>',
      '          <Text style={styles.listItemText}>',
      "            {item.nombre} — {item.duracion} min · {item.presupuesto} · {item.hecho ? 'hecho' : 'pendiente'}",
      '          </Text>',
      '          <View style={{ flexDirection: \'row\' }}>',
      '            <TouchableOpacity',
      '              style={[styles.iconBtn, styles.iconBtnEdit]}',
      '              onPress={() => onEdit(item)}',
      '              accessibilityLabel="Editar tarea"',
      '            >',
      '              <Text style={styles.iconBtnText}>✎</Text>',
      '            </TouchableOpacity>',
      '            <TouchableOpacity',
      '              style={[styles.iconBtn, styles.iconBtnDelete]}',
      '              onPress={() => onDelete(item.id)}',
      '              accessibilityLabel="Eliminar tarea"',
      '            >',
      '              <Text style={styles.iconBtnText}>🗑</Text>',
      '            </TouchableOpacity>',
      '          </View>',
      '        </View>',
      '      )}',
      '    />',
      '  );',
      '}',
      '',
    ].join('\n');

    const referenciaTsx = [
      "import { useEffect, useState } from 'react';",
      "import { View, Text } from 'react-native';",
      "import { Todo } from '../models/todo';",
      "import { fetchTodos, createTodo, updateTodo, deleteTodo } from '../api/referenciaApi';",
      "import { styles } from '../styles';",
      "import { TareaForm } from '../components/TareaForm';",
      "import { TareaList } from '../components/TareaList';",
      "import { FloatingActionButton } from '../components/FloatingActionButton';",
      '',
      '/**',
      ' * Referencia: CRUD resuelto, con la lista y el formulario como dos',
      ' * "vistas" separadas (`view`), en vez de mostrarlas juntas en la misma',
      ' * pantalla. La lista muestra un botón flotante ("+") para crear; tocar el',
      ' * ícono de editar en un ítem también navega al formulario, ya precargado.',
      ' */',
      'export function ReferenciaPage() {',
      '  const [todos, setTodos] = useState<Todo[]>([]);',
      '  const [loading, setLoading] = useState(true);',
      '  const [editingId, setEditingId] = useState<string | null>(null);',
      "  const [nombre, setNombre] = useState('');",
      "  const [duracion, setDuracion] = useState('0');",
      "  const [presupuesto, setPresupuesto] = useState('0');",
      '  const [hecho, setHecho] = useState(false);',
      "  const [view, setView] = useState<'list' | 'form'>('list');",
      '',
      '  function load() {',
      '    setLoading(true);',
      '    fetchTodos().then(setTodos).finally(() => setLoading(false));',
      '  }',
      '',
      '  useEffect(() => {',
      '    load();',
      '  }, []);',
      '',
      '  function resetForm() {',
      '    setEditingId(null);',
      "    setNombre('');",
      "    setDuracion('0');",
      "    setPresupuesto('0');",
      '    setHecho(false);',
      '  }',
      '',
      '  function openNewForm() {',
      '    resetForm();',
      "    setView('form');",
      '  }',
      '',
      '  async function handleSubmit() {',
      "    if (nombre.trim() === '') return;",
      '    const data = { nombre, hecho, duracion: Number(duracion), presupuesto: Number(presupuesto) };',
      '    if (editingId) {',
      '      await updateTodo(editingId, data);',
      '    } else {',
      '      await createTodo(data);',
      '    }',
      '    resetForm();',
      "    setView('list');",
      '    load();',
      '  }',
      '',
      '  function startEdit(todo: Todo) {',
      '    setEditingId(todo.id);',
      '    setNombre(todo.nombre);',
      '    setDuracion(String(todo.duracion));',
      '    setPresupuesto(String(todo.presupuesto));',
      '    setHecho(todo.hecho);',
      "    setView('form');",
      '  }',
      '',
      "  if (view === 'form') {",
      '    return (',
      '      <View style={styles.card}>',
      '        <TareaForm',
      '          nombre={nombre} setNombre={setNombre}',
      '          duracion={duracion} setDuracion={setDuracion}',
      '          presupuesto={presupuesto} setPresupuesto={setPresupuesto}',
      '          hecho={hecho} setHecho={setHecho}',
      '          editingId={editingId} onSubmit={handleSubmit}',
      "          onCancel={() => { resetForm(); setView('list'); }}",
      '        />',
      '      </View>',
      '    );',
      '  }',
      '',
      '  return (',
      '    <View style={styles.listContainer}>',
      '      <View style={styles.card}>',
      '        <Text style={styles.title}>Referencia: Tareas (CRUD resuelto)</Text>',
      '        {loading ? (',
      '          <Text>Cargando...</Text>',
      '        ) : (',
      '          <TareaList todos={todos} onEdit={startEdit} onDelete={(id) => deleteTodo(id).then(load)} />',
      '        )}',
      '      </View>',
      '      <FloatingActionButton onPress={openNewForm} />',
      '    </View>',
      '  );',
      '}',
      '',
    ].join('\n');

    const referenciaPromedioTsx = [
      "import { useEffect, useState } from 'react';",
      "import { View, Text } from 'react-native';",
      "import { Todo } from '../models/todo';",
      "import { fetchTodos } from '../api/referenciaApi';",
      "import { styles } from '../styles';",
      '',
      '/** Ejemplo de página de cálculo (referencia): promedio de duración de las tareas. */',
      'export function ReferenciaPromedioPage() {',
      '  const [todos, setTodos] = useState<Todo[]>([]);',
      '  const [loading, setLoading] = useState(true);',
      '',
      '  useEffect(() => {',
      '    fetchTodos().then(setTodos).finally(() => setLoading(false));',
      '  }, []);',
      '',
      '  const promedio = todos.length',
      '    ? todos.reduce((sum, t) => sum + t.duracion, 0) / todos.length',
      '    : 0;',
      '',
      '  return (',
      '    <View style={styles.card}>',
      '      <Text style={styles.title}>Referencia: promedio de duración</Text>',
      '      {loading ? <Text>Cargando...</Text> : <Text>Promedio: {promedio.toFixed(1)} min ({todos.length} tareas)</Text>}',
      '    </View>',
      '  );',
      '}',
      '',
    ].join('\n');

    const referenciaBusquedaTsx = [
      "import { useEffect, useState } from 'react';",
      "import { View, Text, TextInput } from 'react-native';",
      "import { Todo } from '../models/todo';",
      "import { fetchTodos } from '../api/referenciaApi';",
      "import { styles } from '../styles';",
      '',
      '/** Ejemplo de página de cálculo (referencia): búsqueda de tareas por nombre. */',
      'export function ReferenciaBusquedaPage() {',
      '  const [todos, setTodos] = useState<Todo[]>([]);',
      "  const [filtro, setFiltro] = useState('');",
      '  const [loading, setLoading] = useState(true);',
      '',
      '  useEffect(() => {',
      '    fetchTodos().then(setTodos).finally(() => setLoading(false));',
      '  }, []);',
      '',
      '  const resultados = todos.filter((t) => t.nombre.toLowerCase().includes(filtro.toLowerCase()));',
      '',
      '  return (',
      '    <View style={styles.card}>',
      '      <Text style={styles.title}>Referencia: búsqueda de tareas</Text>',
      '      <TextInput style={styles.input} placeholder="Buscar" value={filtro} onChangeText={setFiltro} />',
      '      {loading ? <Text>Cargando...</Text> : <Text>{resultados.length} resultado(s)</Text>}',
      '    </View>',
      '  );',
      '}',
      '',
    ].join('\n');

    const pregunta1Tsx = [
      "import { View, Text } from 'react-native';",
      "import { fetchItems, createItem, updateItem, deleteItem } from '../api/pregunta1Api';",
      "import { styles } from '../styles';",
      '',
      '/**',
      ' * Pregunta 1: CRUD completo de tu variante contra tu propia API.',
      ' * TODO: renombrá este archivo, esta función, tu modelo (`src/models/pregunta1.ts`) y tu',
      ' * archivo de API (`src/api/pregunta1Api.ts`) de acuerdo al recurso de tu variante y a la',
      ' * regla de negocio del enunciado (ver ENUNCIADO.md para un ejemplo ilustrativo de',
      ' * nombres). Actualizá también el import + case en `src/router/AppRouter.tsx` y la',
      ' * etiqueta en `src/components/Menu.tsx`.',
      ' */',
      'export function Pregunta1Page() {',
      '  // TODO: 1) definí tu modelo en `src/models/pregunta1.ts` (ver instrucciones ahí).',
      '  // 2) implementá las funciones de `src/api/pregunta1Api.ts` usando ese modelo.',
      '  // 3) duplicá acá el patrón de `src/pages/Referencia.tsx`: fetch en useEffect, estado',
      '  // tipado con tu modelo, y un formulario + una lista separados en sus propios',
      '  // componentes dentro de `src/components/` (igual que `TareaForm.tsx`/`TareaList.tsx`).',
      '  return (',
      '    <View style={styles.card}>',
      '      <Text style={styles.title}>Pregunta 1 — no implementado</Text>',
      '      <Text>Completá esta página siguiendo el patrón de "Referencia".</Text>',
      '    </View>',
      '  );',
      '}',
      '',
    ].join('\n');

    const pregunta2Tsx = [
      "import { View, Text } from 'react-native';",
      "import { fetchItems } from '../api/pregunta1Api';",
      "import { styles } from '../styles';",
      '',
      '/** Pregunta 2: tu propia página de cálculo. */',
      'export function Pregunta2Page() {',
      '  // TODO: duplicá el patrón de `src/pages/ReferenciaPromedio.tsx`, pero llamando a tu',
      '  // función de fetch (una vez implementada y renombrada en `src/api/pregunta1Api.ts`)',
      '  // y calculando lo que pide el enunciado de la Pregunta 2 (ver ENUNCIADO.md) a partir',
      '  // de los datos de tu API.',
      '  return (',
      '    <View style={styles.card}>',
      '      <Text style={styles.title}>Pregunta 2 — no implementado</Text>',
      '    </View>',
      '  );',
      '}',
      '',
    ].join('\n');

    const pregunta3Tsx = [
      "import { View, Text } from 'react-native';",
      "import { fetchItems } from '../api/pregunta1Api';",
      "import { styles } from '../styles';",
      '',
      '/** Pregunta 3: tu propia página de cálculo. */',
      'export function Pregunta3Page() {',
      '  // TODO: duplicá el patrón de `src/pages/ReferenciaBusqueda.tsx`, pero llamando a tu',
      '  // función de fetch (una vez implementada y renombrada en `src/api/pregunta1Api.ts`)',
      '  // y calculando lo que pide el enunciado de la Pregunta 3 (ver ENUNCIADO.md) a partir',
      '  // de los datos de tu API.',
      '  return (',
      '    <View style={styles.card}>',
      '      <Text style={styles.title}>Pregunta 3 — no implementado</Text>',
      '    </View>',
      '  );',
      '}',
      '',
    ].join('\n');

    const menuTsx = [
      "import { View, Text, TouchableOpacity } from 'react-native';",
      "import { styles } from '../styles';",
      "import type { Screen } from '../router/AppRouter';",
      '',
      'export function Menu({ screen, onNavigate }: { screen: Screen; onNavigate: (s: Screen) => void }) {',
      '  const items: { key: Screen; label: string }[] = [',
      "    { key: 'home', label: 'Inicio' },",
      "    { key: 'referencia', label: 'Referencia' },",
      "    { key: 'ref-promedio', label: 'Ref. promedio' },",
      "    { key: 'ref-busqueda', label: 'Ref. búsqueda' },",
      "    { key: 'p1', label: 'Pregunta 1' },",
      "    { key: 'p2', label: 'Pregunta 2' },",
      "    { key: 'p3', label: 'Pregunta 3' },",
      '  ];',
      '  return (',
      '    <View style={styles.menu}>',
      '      {items.map((item) => (',
      '        <TouchableOpacity',
      '          key={item.key}',
      '          onPress={() => onNavigate(item.key)}',
      '          style={[styles.menuBtn, screen === item.key && styles.menuBtnActive]}',
      '        >',
      '          <Text style={[styles.menuBtnText, screen === item.key && styles.menuBtnTextActive]}>',
      '            {item.label}',
      '          </Text>',
      '        </TouchableOpacity>',
      '      ))}',
      '    </View>',
      '  );',
      '}',
      '',
    ].join('\n');

    const homePageTsx = [
      "import { View, Text } from 'react-native';",
      "import { styles } from '../styles';",
      '',
      'export function HomePage() {',
      '  return (',
      '    <View style={styles.card}>',
      `      <Text style={styles.title}>Examen React Native — ${version.theme_name}</Text>`,
      '      <Text>Usá el menú de arriba para navegar entre las secciones del examen.</Text>',
      '    </View>',
      '  );',
      '}',
      '',
    ].join('\n');

    const appRouterTsx = [
      "import { useState } from 'react';",
      "import { View, ScrollView } from 'react-native';",
      "import { Menu } from '../components/Menu';",
      "import { HomePage } from '../pages/Home';",
      "import { ReferenciaPage } from '../pages/Referencia';",
      "import { ReferenciaPromedioPage } from '../pages/ReferenciaPromedio';",
      "import { ReferenciaBusquedaPage } from '../pages/ReferenciaBusqueda';",
      "import { Pregunta1Page } from '../pages/Pregunta1';",
      "import { Pregunta2Page } from '../pages/Pregunta2';",
      "import { Pregunta3Page } from '../pages/Pregunta3';",
      "import { styles } from '../styles';",
      '',
      "export type Screen = 'home' | 'referencia' | 'ref-promedio' | 'ref-busqueda' | 'p1' | 'p2' | 'p3';",
      '',
      'export function AppRouter() {',
      "  const [screen, setScreen] = useState<Screen>('home');",
      '',
      '  let content;',
      '  switch (screen) {',
      "    case 'referencia':",
      '      content = <ReferenciaPage />;',
      '      break;',
      "    case 'ref-promedio':",
      '      content = <ReferenciaPromedioPage />;',
      '      break;',
      "    case 'ref-busqueda':",
      '      content = <ReferenciaBusquedaPage />;',
      '      break;',
      "    case 'p1':",
      '      content = <Pregunta1Page />;',
      '      break;',
      "    case 'p2':",
      '      content = <Pregunta2Page />;',
      '      break;',
      "    case 'p3':",
      '      content = <Pregunta3Page />;',
      '      break;',
      '    default:',
      '      content = <HomePage />;',
      '  }',
      '',
      '  return (',
      '    <View style={styles.app}>',
      '      <Menu screen={screen} onNavigate={setScreen} />',
      '      <ScrollView style={styles.content}>{content}</ScrollView>',
      '    </View>',
      '  );',
      '}',
      '',
    ].join('\n');

    const appTsx = [
      "import { AppRouter } from './src/router/AppRouter';",
      '',
      'export default function App() {',
      '  return <AppRouter />;',
      '}',
      '',
    ].join('\n');

    return [
      { name: 'ENUNCIADO.md', path: '/ENUNCIADO.md', content: enunciado, is_folder: false },
      { name: 'App.tsx', path: '/App.tsx', content: appTsx, is_folder: false },
      { name: 'src', path: '/src', content: '', is_folder: true },
      { name: 'styles.ts', path: '/src/styles.ts', content: stylesTs, is_folder: false },
      { name: 'api', path: '/src/api', content: '', is_folder: true },
      { name: 'referenciaApi.ts', path: '/src/api/referenciaApi.ts', content: referenciaApiTs, is_folder: false },
      { name: 'pregunta1Api.ts', path: '/src/api/pregunta1Api.ts', content: pregunta1ApiTs, is_folder: false },
      { name: 'models', path: '/src/models', content: '', is_folder: true },
      { name: 'todo.ts', path: '/src/models/todo.ts', content: referenciaModelTs, is_folder: false },
      { name: 'pregunta1.ts', path: '/src/models/pregunta1.ts', content: pregunta1ModelTs, is_folder: false },
      { name: 'components', path: '/src/components', content: '', is_folder: true },
      { name: 'Menu.tsx', path: '/src/components/Menu.tsx', content: menuTsx, is_folder: false },
      { name: 'TareaForm.tsx', path: '/src/components/TareaForm.tsx', content: tareaFormTsx, is_folder: false },
      { name: 'TareaList.tsx', path: '/src/components/TareaList.tsx', content: tareaListTsx, is_folder: false },
      {
        name: 'FloatingActionButton.tsx',
        path: '/src/components/FloatingActionButton.tsx',
        content: floatingActionButtonTsx,
        is_folder: false,
      },
      { name: 'router', path: '/src/router', content: '', is_folder: true },
      { name: 'AppRouter.tsx', path: '/src/router/AppRouter.tsx', content: appRouterTsx, is_folder: false },
      { name: 'pages', path: '/src/pages', content: '', is_folder: true },
      { name: 'Home.tsx', path: '/src/pages/Home.tsx', content: homePageTsx, is_folder: false },
      { name: 'Referencia.tsx', path: '/src/pages/Referencia.tsx', content: referenciaTsx, is_folder: false },
      { name: 'ReferenciaPromedio.tsx', path: '/src/pages/ReferenciaPromedio.tsx', content: referenciaPromedioTsx, is_folder: false },
      { name: 'ReferenciaBusqueda.tsx', path: '/src/pages/ReferenciaBusqueda.tsx', content: referenciaBusquedaTsx, is_folder: false },
      { name: 'Pregunta1.tsx', path: '/src/pages/Pregunta1.tsx', content: pregunta1Tsx, is_folder: false },
      { name: 'Pregunta2.tsx', path: '/src/pages/Pregunta2.tsx', content: pregunta2Tsx, is_folder: false },
      { name: 'Pregunta3.tsx', path: '/src/pages/Pregunta3.tsx', content: pregunta3Tsx, is_folder: false },
    ];
  }

  /**
   * Andamiaje de HTML/CSS/JS (manipulación del DOM, sin frameworks): el proyecto
   * trae un ejemplo de referencia "Notas" YA RESUELTO pero deliberadamente MUY
   * simple (listar/crear/eliminar — sin editar, sin buscar) contra una API de
   * referencia distinta a la asignada (`/todo-api/todos`). En `src/mi-crud.js`
   * solo el LISTADO del recurso propio ya viene resuelto; el alumno debe
   * completar crear/editar/eliminar (incluyendo el manejo del error de la regla
   * de negocio de su variante) y las 2 secciones de cálculo en
   * `src/calculo1.js` / `src/calculo2.js`. Sin tests automáticos — corrección
   * manual (código + preview), igual que Flutter RealApi / React Native.
   */
  private buildHtmlDomExamFiles(version: ExamVersion) {
    const questions = [...(version.questions ?? [])].sort((a, b) => a.order - b.order);
    const totalPoints = questions.reduce((sum, q) => sum + (q.points ?? 0), 0);
    const typeSlug = slugify(version.theme_name);
    const variant = getVariantConfig(typeSlug);
    const fields = variant.fields;
    const resource = variant.resource;
    const ClassName = cap(resource);
    const apiBase = 'https://api.franciscohiguera.site/api';
    const endpoint = `${apiBase}/practice-api/${typeSlug}/${resource}`;
    const todoEndpoint = `${apiBase}/todo-api/todos`;

    const sampleRecord = variant.seeds[0] ?? {};
    const sampleJson = JSON.stringify(sampleRecord, null, 2);

    const businessRuleNotes: Record<string, string> = {
      vehiculos:
        'Si creás o editás un vehículo con una **placa** que ya existe en tu variante, la API responde **409 (Conflict)** con el mensaje `Ya existe un registro con esa placa.` — tu pantalla debe mostrar ese mensaje, no fallar en silencio.',
      restaurante:
        'Si intentás **eliminar** un plato con `disponible = true`, la API responde **400 (Bad Request)** con el mensaje `No se puede eliminar un plato disponible; márcalo como no disponible primero.` — mostrá ese mensaje y no quites la fila hasta que el usuario lo marque como no disponible y reintente.',
      mascotas:
        'Si creás o editás una mascota con un **código** que ya existe en tu variante, la API responde **409 (Conflict)** con el mensaje `Ya existe un registro con ese código.` — tu pantalla debe mostrar ese mensaje.',
    };
    const businessRuleNote =
      businessRuleNotes[typeSlug] ??
      'Revisá los códigos de error (4xx) que devuelve tu API y mostrá el mensaje al usuario en vez de ignorarlo.';

    const inputType = (t: DartFieldType) => (t === 'bool' ? 'checkbox' : t === 'string' ? 'text' : 'number');

    const enunciado = [
      `# Examen HTML/CSS/JS (DOM) — ${version.theme_name}`,
      '',
      `Puntaje total: ${totalPoints} pts`,
      '',
      PlaygroundService.RUBRIC_EXPLICATION,
      '',
      '## Tu API (variante asignada)',
      '',
      `> \`GET/POST ${endpoint}\` y \`GET/PATCH/DELETE ${endpoint}/:id\`.`,
      '',
      `> Campos del recurso: ${fields.map((f) => `\`${f.key}\` (${tsType(f.type)})`).join(', ')}.`,
      '',
      '> Ejemplo de un registro real de tu API (formato JSON de la respuesta):',
      '>',
      '> ```json',
      ...sampleJson.split('\n').map((l) => `> ${l}`),
      '> ```',
      '',
      `> **Regla de negocio de tu variante:** ${businessRuleNote}`,
      '',
      '## Punto de partida: ejemplo de referencia "Notas" (a propósito muy simple)',
      '',
      '  El proyecto trae un ejemplo YA RESUELTO en `src/referencia.js` (sección "Referencia" del',
      '  menú): notas con `nombre` (texto), `hecho` (bool), `duracion` (número) y `presupuesto`',
      `  (número), contra otra API distinta a la tuya (\`${todoEndpoint}\`). A propósito solo cubre`,
      '  **listar, crear y eliminar** (sin editar, sin buscar) — es la base mínima para que veas el',
      '  patrón (fetch → render → manejar eventos del DOM), no la solución completa.',
      '',
      '  **Tu trabajo es completar `src/mi-crud.js`, `src/calculo1.js` y `src/calculo2.js`**',
      '  duplicando y ampliando ese patrón para tu propio recurso — incluyendo lo más difícil,',
      '  que el ejemplo de referencia NO resuelve: **editar**, y el **manejo del error de la',
      '  regla de negocio de tu variante** (ver arriba).',
      '',
      '  1. **Pregunta 1** (`src/mi-crud.js`): CRUD completo (listar, crear, editar y eliminar)',
      '     contra el endpoint de arriba, con los campos de tu variante. El listado ya viene',
      '     resuelto como ejemplo; vos completás crear/editar/eliminar, mostrando el mensaje de',
      '     error de tu regla de negocio cuando la API lo devuelva.',
      '  2. **Pregunta 2** (`src/calculo1.js`) y **Pregunta 3** (`src/calculo2.js`): tus propias',
      '     secciones de cálculo sobre los datos de tu API, calculando lo que pide cada enunciado',
      '     de abajo (no un cálculo genérico).',
      '',
      '  No hay tests automáticos para este examen — la corrección es manual (código + preview).',
      '',
      '## Preguntas',
      '',
      ...questions.map((q) => `### Pregunta ${q.order}: ${q.title} (${q.points} pts — ${this.buildRubricBreakdown(q.points)})\n\n${q.statement}\n`),
    ].join('\n');

    const indexHtml = [
      '<!DOCTYPE html>',
      '<html lang="es">',
      '<head>',
      '  <meta charset="UTF-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
      `  <title>Examen DOM — ${version.theme_name}</title>`,
      '  <link rel="stylesheet" href="styles.css">',
      '</head>',
      '<body>',
      '  <nav class="menu">',
      '    <button onclick="mostrarSeccion(\'inicio\')">Inicio</button>',
      '    <button onclick="mostrarSeccion(\'referencia\')">Referencia</button>',
      `    <button onclick="mostrarSeccion('mi-crud')">${ClassName} (P1)</button>`,
      '    <button onclick="mostrarSeccion(\'calculo1\')">Pregunta 2</button>',
      '    <button onclick="mostrarSeccion(\'calculo2\')">Pregunta 3</button>',
      '  </nav>',
      '',
      '  <section id="seccion-inicio" class="seccion">',
      `    <h2>Examen HTML/CSS/JS — ${version.theme_name}</h2>`,
      '    <p>Usá el menú de arriba para navegar entre las secciones del examen.</p>',
      '  </section>',
      '',
      '  <section id="seccion-referencia" class="seccion" hidden>',
      '    <h2>Referencia: Notas (CRUD resuelto, a propósito simple)</h2>',
      '    <div class="formulario">',
      '      <input type="text" id="ref-nombre" placeholder="Nombre">',
      '      <input type="number" id="ref-duracion" placeholder="Duración (min)">',
      '      <input type="number" id="ref-presupuesto" placeholder="Presupuesto">',
      '      <label><input type="checkbox" id="ref-hecho"> Hecho</label>',
      '      <button onclick="agregarNota()">Agregar</button>',
      '    </div>',
      '    <table>',
      '      <thead><tr><th>Nombre</th><th>Duración</th><th>Presupuesto</th><th>Hecho</th><th>Acciones</th></tr></thead>',
      '      <tbody id="refCuerpoTabla"></tbody>',
      '    </table>',
      '  </section>',
      '',
      `  <section id="seccion-mi-crud" class="seccion" hidden>`,
      `    <h2>${ClassName} (Pregunta 1)</h2>`,
      '    <div class="formulario">',
      ...fields.map((f) =>
        f.type === 'bool'
          ? `      <label><input type="checkbox" id="mi-${f.key}"> ${f.label}</label>`
          : `      <input type="${inputType(f.type)}" id="mi-${f.key}" placeholder="${f.label}">`,
      ),
      '      <button onclick="guardarMiItem()">Agregar</button>',
      '      <button onclick="cancelarEdicionMi()">Cancelar</button>',
      '    </div>',
      '    <table>',
      '      <thead><tr>' + fields.map((f) => `<th>${f.label}</th>`).join('') + '<th>Acciones</th></tr></thead>',
      '      <tbody id="miCuerpoTabla"></tbody>',
      '    </table>',
      '  </section>',
      '',
      '  <section id="seccion-calculo1" class="seccion" hidden>',
      '    <h2>Pregunta 2: cálculo propio</h2>',
      '    <div id="calc1Resultado">TODO</div>',
      '  </section>',
      '',
      '  <section id="seccion-calculo2" class="seccion" hidden>',
      '    <h2>Pregunta 3: cálculo propio</h2>',
      '    <div id="calc2Resultado">TODO</div>',
      '  </section>',
      '',
      '  <script src="nav.js"></script>',
      '  <script src="src/referencia.js"></script>',
      '  <script src="src/mi-crud.js"></script>',
      '  <script src="src/calculo1.js"></script>',
      '  <script src="src/calculo2.js"></script>',
      '</body>',
      '</html>',
      '',
    ].join('\n');

    const stylesCss = [
      'body { font-family: Arial, sans-serif; margin: 30px; }',
      '.menu { display: flex; gap: 8px; margin-bottom: 20px; }',
      '.menu button { padding: 8px 14px; border: none; border-radius: 4px; background: #4a90d9; color: white; cursor: pointer; }',
      '.formulario { background: #eef4fb; border: 1px solid #b0cfe8; padding: 12px; border-radius: 6px; margin-bottom: 16px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }',
      '.formulario input[type="text"], .formulario input[type="number"] { padding: 6px; }',
      'table { border-collapse: collapse; width: 100%; }',
      'th, td { border: 1px solid #aaa; padding: 6px 10px; text-align: left; }',
      'th { background: #4a90d9; color: white; }',
      'button { cursor: pointer; }',
      '',
    ].join('\n');

    // ── Referencia (resuelta, a propósito simple): listar / crear / eliminar ─────────
    const referenciaJs = [
      `const REF_API_URL = '${todoEndpoint}';`,
      '',
      'function cargarNotas() {',
      '  fetch(REF_API_URL)',
      '    .then((res) => res.json())',
      '    .then(renderNotas);',
      '}',
      '',
      'function renderNotas(notas) {',
      "  const tbody = document.getElementById('refCuerpoTabla');",
      "  tbody.innerHTML = '';",
      '  notas.forEach((n) => {',
      "    const fila = document.createElement('tr');",
      '    fila.innerHTML = `',
      '      <td>${n.nombre}</td>',
      '      <td>${n.duracion}</td>',
      '      <td>${n.presupuesto}</td>',
      "      <td>${n.hecho ? 'Sí' : 'No'}</td>",
      '      <td><button onclick="eliminarNota(\'${n.id}\')">Eliminar</button></td>',
      '    `;',
      '    tbody.appendChild(fila);',
      '  });',
      '}',
      '',
      '// Create: crea la nota y vuelve a cargar la lista.',
      'function agregarNota() {',
      "  const nombre = document.getElementById('ref-nombre').value.trim();",
      "  if (!nombre) return;",
      '  const data = {',
      '    nombre,',
      "    duracion: Number(document.getElementById('ref-duracion').value) || 0,",
      "    presupuesto: Number(document.getElementById('ref-presupuesto').value) || 0,",
      "    hecho: document.getElementById('ref-hecho').checked,",
      '  };',
      '  fetch(REF_API_URL, {',
      "    method: 'POST',",
      "    headers: { 'Content-Type': 'application/json' },",
      '    body: JSON.stringify(data),',
      '  }).then(() => {',
      "    document.getElementById('ref-nombre').value = '';",
      "    document.getElementById('ref-duracion').value = '';",
      "    document.getElementById('ref-presupuesto').value = '';",
      "    document.getElementById('ref-hecho').checked = false;",
      '    cargarNotas();',
      '  });',
      '}',
      '',
      '// Delete: sin confirmación ni manejo de error — esta referencia es a propósito simple.',
      'function eliminarNota(id) {',
      '  fetch(`${REF_API_URL}/${id}`, { method: \'DELETE\' }).then(cargarNotas);',
      '}',
      '',
      'window.addEventListener(\'DOMContentLoaded\', cargarNotas);',
      '',
    ].join('\n');

    // ── Tu trabajo: solo el listado viene resuelto, el resto son TODO ─────────────────
    const miCrudJs = [
      `// Endpoint de tu variante (\`${resource}\`): ${endpoint}`,
      `const MI_API_URL = '${endpoint}';`,
      'let miIdEditando = null;',
      '',
      '// Read: YA RESUELTO — trae la lista y la pinta en la tabla.',
      'function cargarMisItems() {',
      '  fetch(MI_API_URL)',
      '    .then((res) => res.json())',
      '    .then(renderMiTabla);',
      '}',
      '',
      'function renderMiTabla(items) {',
      "  const tbody = document.getElementById('miCuerpoTabla');",
      "  tbody.innerHTML = '';",
      '  items.forEach((item) => {',
      "    const fila = document.createElement('tr');",
      '    fila.innerHTML = `',
      ...fields.map((f) => (f.type === 'bool' ? `      <td>\${item.${f.key} ? 'Sí' : 'No'}</td>` : `      <td>\${item.${f.key}}</td>`)),
      '      <td>',
      '        <button onclick="cargarEdicionMi(\'${item.id}\')">Editar</button>',
      '        <button onclick="eliminarMiItem(\'${item.id}\')">Eliminar</button>',
      '      </td>',
      '    `;',
      '    tbody.appendChild(fila);',
      '  });',
      '}',
      '',
      '// TODO — Create/Update: leer el formulario (ids `mi-<campo>`, ver index.html), armar el',
      '// objeto `data` con los campos de tu variante y hacer POST (si `miIdEditando` es null) o',
      '// PATCH `${MI_API_URL}/${miIdEditando}` (si estás editando). IMPORTANTE: revisá',
      '// `response.ok`; si es `false`, leé `await response.json()` y mostrá `mensaje.message`',
      '// (la regla de negocio de tu variante, ver ENUNCIADO.md) en vez de ignorarlo.',
      'function guardarMiItem() {',
      '  // TODO: completar (ver comentario de arriba).',
      '}',
      '',
      '// TODO — completar edición: buscar el item por id (podés volver a pedir la lista o',
      '// guardar el último `items` recibido) y precargar los inputs `mi-<campo>` con sus valores;',
      '// guardar el id en `miIdEditando` para que `guardarMiItem` sepa que debe editar.',
      'function cargarEdicionMi(id) {',
      '  // TODO: completar (ver comentario de arriba).',
      '}',
      '',
      '// TODO: limpiar `miIdEditando` y los inputs del formulario.',
      'function cancelarEdicionMi() {',
      '  // TODO: completar (ver comentario de arriba).',
      '}',
      '',
      '// TODO — Delete: hacer DELETE `${MI_API_URL}/${id}`. Si la API responde con error (ver',
      '// regla de negocio de tu variante en ENUNCIADO.md), mostrá el mensaje y NO quites la fila.',
      'function eliminarMiItem(id) {',
      '  // TODO: completar (ver comentario de arriba).',
      '}',
      '',
      "window.addEventListener('DOMContentLoaded', cargarMisItems);",
      '',
    ].join('\n');

    const calculo1Js = [
      `// Pregunta 2 — ver el enunciado específico en ENUNCIADO.md. Datos de tu API: ${endpoint}`,
      'function calcularPregunta2() {',
      '  // TODO: pedí los datos con fetch y calculá lo que pide el enunciado de la Pregunta 2.',
      "  // Mostrá el resultado con: document.getElementById('calc1Resultado').textContent = ...;",
      '}',
      '',
      "window.addEventListener('DOMContentLoaded', calcularPregunta2);",
      '',
    ].join('\n');

    const calculo2Js = [
      `// Pregunta 3 — ver el enunciado específico en ENUNCIADO.md. Datos de tu API: ${endpoint}`,
      'function calcularPregunta3() {',
      '  // TODO: pedí los datos con fetch y calculá lo que pide el enunciado de la Pregunta 3.',
      "  // Mostrá el resultado con: document.getElementById('calc2Resultado').textContent = ...;",
      '}',
      '',
      "window.addEventListener('DOMContentLoaded', calcularPregunta3);",
      '',
    ].join('\n');

    const navJs = [
      'function mostrarSeccion(id) {',
      "  document.querySelectorAll('.seccion').forEach((s) => { s.hidden = true; });",
      "  document.getElementById('seccion-' + id).hidden = false;",
      '}',
      '',
    ].join('\n');

    return [
      { name: 'ENUNCIADO.md', path: '/ENUNCIADO.md', content: enunciado, is_folder: false },
      { name: 'index.html', path: '/index.html', content: indexHtml, is_folder: false },
      { name: 'styles.css', path: '/styles.css', content: stylesCss, is_folder: false },
      { name: 'nav.js', path: '/nav.js', content: navJs, is_folder: false },
      { name: 'src', path: '/src', content: '', is_folder: true },
      { name: 'referencia.js', path: '/src/referencia.js', content: referenciaJs, is_folder: false },
      { name: 'mi-crud.js', path: '/src/mi-crud.js', content: miCrudJs, is_folder: false },
      { name: 'calculo1.js', path: '/src/calculo1.js', content: calculo1Js, is_folder: false },
      { name: 'calculo2.js', path: '/src/calculo2.js', content: calculo2Js, is_folder: false },
    ];
  }

  // ── Examen HTML/CSS/JS — manipulación del DOM (arreglo en memoria, SIN API) ──
  private buildHtmlArrayExamFiles(version: ExamVersion) {
    const questions = [...(version.questions ?? [])].sort((a, b) => a.order - b.order);
    const totalPoints = questions.reduce((sum, q) => sum + (q.points ?? 0), 0);
    const typeSlug = slugify(version.theme_name);
    const variant = getVariantConfig(typeSlug);
    const fields = variant.fields;
    const resource = variant.resource;
    const ClassName = cap(resource);

    const seedsWithId = variant.seeds.map((s, i) => ({ id: i + 1, ...s }));
    const seedsJson = JSON.stringify(seedsWithId, null, 2);
    const sampleJson = JSON.stringify(seedsWithId[0] ?? {}, null, 2);

    const businessRuleNotes: Record<string, string> = {
      ropa:
        'No se debe poder **eliminar** una prenda con `stock` mayor a 0 — tu código debe mostrar un mensaje de error (por ejemplo con un `alert`) y no quitarla del arreglo hasta que su `stock` sea 0.',
      libros:
        'No se debe poder **crear ni editar** un libro con un `titulo` que ya use otro registro del arreglo — tu código debe mostrar un mensaje de error y no modificar el arreglo en ese caso.',
      farmacia:
        'No se debe poder **eliminar** un medicamento con `existencias` mayor a 0 — tu código debe mostrar un mensaje de error y no quitarlo del arreglo hasta que sus `existencias` sean 0.',
      nomina:
        'No se debe poder **crear ni editar** un empleado con un `codigoEmpleado` que ya use otro registro del arreglo — tu código debe mostrar un mensaje de error y no modificar el arreglo en ese caso.',
      papeleria:
        'No se debe poder **crear ni editar** un producto con un `codigo` que ya use otro registro del arreglo — tu código debe mostrar un mensaje de error y no modificar el arreglo en ese caso.',
    };
    const businessRuleNote =
      businessRuleNotes[typeSlug] ??
      'Revisá qué campo de tu variante debería ser único (o qué condición bloquea un borrado) y validalo antes de modificar el arreglo, mostrando el mensaje al usuario en vez de ignorarlo.';

    const inputType = (t: DartFieldType) => (t === 'bool' ? 'checkbox' : t === 'string' ? 'text' : 'number');

    const enunciado = [
      `# Examen HTML/CSS/JS (DOM, arreglo en memoria) — ${version.theme_name}`,
      '',
      `Puntaje total: ${totalPoints} pts`,
      '',
      PlaygroundService.RUBRIC_EXPLICATION,
      '',
      '## Tus datos (arreglo en memoria, SIN API)',
      '',
      '  Este examen NO usa `fetch` ni ninguna API: los datos ya vienen cargados como un arreglo',
      '  de JavaScript en `src/mi-crud.js` (variable `misItems`). Tu trabajo es leerlo/modificarlo',
      '  directamente con métodos de arreglo (`push`, `splice`, `find`, `filter`, `map`, etc.) y',
      '  volver a pintar la tabla — sin `async`/`await`, sin `fetch`.',
      '',
      `> Campos de tu registro: ${fields.map((f) => `\`${f.key}\` (${tsType(f.type)})`).join(', ')}.`,
      '',
      '> Ejemplo de un registro de `misItems` (formato del arreglo):',
      '>',
      '> ```json',
      ...sampleJson.split('\n').map((l) => `> ${l}`),
      '> ```',
      '',
      `> **Regla de negocio de tu variante:** ${businessRuleNote}`,
      '',
      '## Punto de partida: ejemplo de referencia "Notas" (a propósito muy simple)',
      '',
      '  El proyecto trae un ejemplo YA RESUELTO en `src/referencia.js` (sección "Referencia" del',
      '  menú): notas con `nombre` (texto), `hecho` (bool), `duracion` (número) y `presupuesto`',
      '  (número), sobre su PROPIO arreglo en memoria (`refNotas`), distinto al tuyo. A propósito',
      '  solo cubre **listar, crear y eliminar** (sin editar, sin buscar) — es la base mínima para',
      '  que veas el patrón (modificar el arreglo → volver a pintar la tabla → manejar eventos del',
      '  DOM), no la solución completa.',
      '',
      '  **Tu trabajo es completar `src/mi-crud.js`, `src/calculo1.js` y `src/calculo2.js`**',
      '  duplicando y ampliando ese patrón sobre `misItems` — incluyendo lo más difícil, que el',
      '  ejemplo de referencia NO resuelve: **editar**, y el **manejo de la regla de negocio de tu',
      '  variante** (ver arriba), validada en JavaScript antes de modificar el arreglo (no hay API',
      '  que la rechace por vos).',
      '',
      '  1. **Pregunta 1** (`src/mi-crud.js`): CRUD completo (listar, crear, editar y eliminar)',
      '     sobre `misItems`, con los campos de tu variante. El listado ya viene resuelto como',
      '     ejemplo; vos completás crear/editar/eliminar, validando la regla de negocio de tu',
      '     variante antes de modificar el arreglo y mostrando un mensaje de error si se viola.',
      '  2. **Pregunta 2** (`src/calculo1.js`) y **Pregunta 3** (`src/calculo2.js`): tus propias',
      '     secciones de cálculo sobre `misItems`, calculando lo que pide cada enunciado de abajo',
      '     (no un cálculo genérico).',
      '',
      '  No hay tests automáticos para este examen — la corrección es manual (código + preview).',
      '',
      '## Preguntas',
      '',
      ...questions.map((q) => `### Pregunta ${q.order}: ${q.title} (${q.points} pts — ${this.buildRubricBreakdown(q.points)})\n\n${q.statement}\n`),
    ].join('\n');

    const indexHtml = [
      '<!DOCTYPE html>',
      '<html lang="es">',
      '<head>',
      '  <meta charset="UTF-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
      `  <title>Examen DOM (arreglo) — ${version.theme_name}</title>`,
      '  <link rel="stylesheet" href="styles.css">',
      '</head>',
      '<body>',
      '  <nav class="menu">',
      '    <button onclick="mostrarSeccion(\'inicio\')">Inicio</button>',
      '    <button onclick="mostrarSeccion(\'referencia\')">Referencia</button>',
      `    <button onclick="mostrarSeccion('mi-crud')">${ClassName} (P1)</button>`,
      '    <button onclick="mostrarSeccion(\'calculo1\')">Pregunta 2</button>',
      '    <button onclick="mostrarSeccion(\'calculo2\')">Pregunta 3</button>',
      '  </nav>',
      '',
      '  <section id="seccion-inicio" class="seccion">',
      `    <h2>Examen HTML/CSS/JS (arreglo) — ${version.theme_name}</h2>`,
      '    <p>Usá el menú de arriba para navegar entre las secciones del examen.</p>',
      '  </section>',
      '',
      '  <section id="seccion-referencia" class="seccion" hidden>',
      '    <h2>Referencia: Notas (CRUD resuelto, a propósito simple)</h2>',
      '    <div class="formulario">',
      '      <input type="text" id="ref-nombre" placeholder="Nombre">',
      '      <input type="number" id="ref-duracion" placeholder="Duración (min)">',
      '      <input type="number" id="ref-presupuesto" placeholder="Presupuesto">',
      '      <label><input type="checkbox" id="ref-hecho"> Hecho</label>',
      '      <button onclick="agregarNota()">Agregar</button>',
      '    </div>',
      '    <table>',
      '      <thead><tr><th>Nombre</th><th>Duración</th><th>Presupuesto</th><th>Hecho</th><th>Acciones</th></tr></thead>',
      '      <tbody id="refCuerpoTabla"></tbody>',
      '    </table>',
      '  </section>',
      '',
      `  <section id="seccion-mi-crud" class="seccion" hidden>`,
      `    <h2>${ClassName} (Pregunta 1)</h2>`,
      '    <div class="formulario">',
      ...fields.map((f) =>
        f.type === 'bool'
          ? `      <label><input type="checkbox" id="mi-${f.key}"> ${f.label}</label>`
          : `      <input type="${inputType(f.type)}" id="mi-${f.key}" placeholder="${f.label}">`,
      ),
      '      <button onclick="guardarMiItem()">Agregar</button>',
      '      <button onclick="cancelarEdicionMi()">Cancelar</button>',
      '    </div>',
      '    <table>',
      '      <thead><tr>' + fields.map((f) => `<th>${f.label}</th>`).join('') + '<th>Acciones</th></tr></thead>',
      '      <tbody id="miCuerpoTabla"></tbody>',
      '    </table>',
      '  </section>',
      '',
      '  <section id="seccion-calculo1" class="seccion" hidden>',
      '    <h2>Pregunta 2: cálculo propio</h2>',
      '    <div id="calc1Resultado">TODO</div>',
      '  </section>',
      '',
      '  <section id="seccion-calculo2" class="seccion" hidden>',
      '    <h2>Pregunta 3: cálculo propio</h2>',
      '    <div id="calc2Resultado">TODO</div>',
      '  </section>',
      '',
      '  <script src="nav.js"></script>',
      '  <script src="src/referencia.js"></script>',
      '  <script src="src/mi-crud.js"></script>',
      '  <script src="src/calculo1.js"></script>',
      '  <script src="src/calculo2.js"></script>',
      '</body>',
      '</html>',
      '',
    ].join('\n');

    const stylesCss = [
      'body { font-family: Arial, sans-serif; margin: 30px; }',
      '.menu { display: flex; gap: 8px; margin-bottom: 20px; }',
      '.menu button { padding: 8px 14px; border: none; border-radius: 4px; background: #4a90d9; color: white; cursor: pointer; }',
      '.formulario { background: #eef4fb; border: 1px solid #b0cfe8; padding: 12px; border-radius: 6px; margin-bottom: 16px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }',
      '.formulario input[type="text"], .formulario input[type="number"] { padding: 6px; }',
      'table { border-collapse: collapse; width: 100%; }',
      'th, td { border: 1px solid #aaa; padding: 6px 10px; text-align: left; }',
      'th { background: #4a90d9; color: white; }',
      'button { cursor: pointer; }',
      '',
    ].join('\n');

    // ── Referencia (resuelta, a propósito simple): listar / crear / eliminar sobre su propio arreglo ──
    const referenciaJs = [
      'let refNotas = [',
      "  { id: 1, nombre: 'Repasar apuntes', hecho: false, duracion: 30, presupuesto: 0 },",
      "  { id: 2, nombre: 'Entregar tarea', hecho: true, duracion: 90, presupuesto: 5 },",
      '];',
      'let refNextId = 3;',
      '',
      'function cargarNotas() {',
      '  renderNotas(refNotas);',
      '}',
      '',
      'function renderNotas(notas) {',
      "  const tbody = document.getElementById('refCuerpoTabla');",
      "  tbody.innerHTML = '';",
      '  notas.forEach((n) => {',
      "    const fila = document.createElement('tr');",
      '    fila.innerHTML = `',
      '      <td>${n.nombre}</td>',
      '      <td>${n.duracion}</td>',
      '      <td>${n.presupuesto}</td>',
      "      <td>${n.hecho ? 'Sí' : 'No'}</td>",
      '      <td><button onclick="eliminarNota(${n.id})">Eliminar</button></td>',
      '    `;',
      '    tbody.appendChild(fila);',
      '  });',
      '}',
      '',
      '// Create: agrega la nota al arreglo y vuelve a pintar la tabla.',
      'function agregarNota() {',
      "  const nombre = document.getElementById('ref-nombre').value.trim();",
      "  if (!nombre) return;",
      '  refNotas.push({',
      '    id: refNextId++,',
      '    nombre,',
      "    duracion: Number(document.getElementById('ref-duracion').value) || 0,",
      "    presupuesto: Number(document.getElementById('ref-presupuesto').value) || 0,",
      "    hecho: document.getElementById('ref-hecho').checked,",
      '  });',
      "  document.getElementById('ref-nombre').value = '';",
      "  document.getElementById('ref-duracion').value = '';",
      "  document.getElementById('ref-presupuesto').value = '';",
      "  document.getElementById('ref-hecho').checked = false;",
      '  cargarNotas();',
      '}',
      '',
      '// Delete: sin confirmación ni manejo de error — esta referencia es a propósito simple.',
      'function eliminarNota(id) {',
      '  refNotas = refNotas.filter((n) => n.id !== id);',
      '  cargarNotas();',
      '}',
      '',
      'window.addEventListener(\'DOMContentLoaded\', cargarNotas);',
      '',
    ].join('\n');

    // ── Tu trabajo: solo el listado viene resuelto, el resto son TODO ─────────────────
    const miCrudJs = [
      `// Datos de tu variante (\`${resource}\`), ya cargados en memoria — SIN fetch, SIN API.`,
      `let misItems = ${seedsJson};`,
      `let misNextId = ${seedsWithId.length + 1};`,
      'let miIdEditando = null;',
      '',
      '// Read: YA RESUELTO — pinta el arreglo actual en la tabla.',
      'function cargarMisItems() {',
      '  renderMiTabla(misItems);',
      '}',
      '',
      'function renderMiTabla(items) {',
      "  const tbody = document.getElementById('miCuerpoTabla');",
      "  tbody.innerHTML = '';",
      '  items.forEach((item) => {',
      "    const fila = document.createElement('tr');",
      '    fila.innerHTML = `',
      ...fields.map((f) => (f.type === 'bool' ? `      <td>\${item.${f.key} ? 'Sí' : 'No'}</td>` : `      <td>\${item.${f.key}}</td>`)),
      '      <td>',
      '        <button onclick="cargarEdicionMi(${item.id})">Editar</button>',
      '        <button onclick="eliminarMiItem(${item.id})">Eliminar</button>',
      '      </td>',
      '    `;',
      '    tbody.appendChild(fila);',
      '  });',
      '}',
      '',
      '// TODO — Create/Update: leer el formulario (ids `mi-<campo>`, ver index.html), armar el',
      '// objeto `data` con los campos de tu variante. ANTES de modificar `misItems`, validá la',
      '// regla de negocio de tu variante (ver ENUNCIADO.md); si se viola, mostrá un mensaje',
      '// (por ejemplo con `alert(...)`) y no modifiques el arreglo. Si `miIdEditando` es null,',
      '// hacé `misItems.push({ id: misNextId++, ...data })`; si no, buscá el item con',
      '// `misItems.find(...)` y actualizá sus campos. Terminá llamando a `cargarMisItems()`.',
      'function guardarMiItem() {',
      '  // TODO: completar (ver comentario de arriba).',
      '}',
      '',
      '// TODO — completar edición: buscar el item por id con `misItems.find(...)` y precargar',
      '// los inputs `mi-<campo>` con sus valores; guardar el id en `miIdEditando` para que',
      '// `guardarMiItem` sepa que debe editar en vez de crear.',
      'function cargarEdicionMi(id) {',
      '  // TODO: completar (ver comentario de arriba).',
      '}',
      '',
      '// TODO: limpiar `miIdEditando` y los inputs del formulario.',
      'function cancelarEdicionMi() {',
      '  // TODO: completar (ver comentario de arriba).',
      '}',
      '',
      '// TODO — Delete: validá primero la regla de negocio de tu variante (ver ENUNCIADO.md); si',
      '// se viola, mostrá un mensaje y NO quites el item. Si no se viola, sacalo del arreglo con',
      '// `misItems = misItems.filter((item) => item.id !== id)` y volvé a pintar la tabla.',
      'function eliminarMiItem(id) {',
      '  // TODO: completar (ver comentario de arriba).',
      '}',
      '',
      "window.addEventListener('DOMContentLoaded', cargarMisItems);",
      '',
    ].join('\n');

    const calculo1Js = [
      `// Pregunta 2 — ver el enunciado específico en ENUNCIADO.md. Tus datos: el arreglo \`misItems\` de src/mi-crud.js.`,
      'function calcularPregunta2() {',
      '  // TODO: recorré `misItems` (sin fetch, ya está cargado) y calculá lo que pide el',
      '  // enunciado de la Pregunta 2.',
      "  // Mostrá el resultado con: document.getElementById('calc1Resultado').textContent = ...;",
      '}',
      '',
      "window.addEventListener('DOMContentLoaded', calcularPregunta2);",
      '',
    ].join('\n');

    const calculo2Js = [
      `// Pregunta 3 — ver el enunciado específico en ENUNCIADO.md. Tus datos: el arreglo \`misItems\` de src/mi-crud.js.`,
      'function calcularPregunta3() {',
      '  // TODO: recorré `misItems` (sin fetch, ya está cargado) y calculá lo que pide el',
      '  // enunciado de la Pregunta 3.',
      "  // Mostrá el resultado con: document.getElementById('calc2Resultado').textContent = ...;",
      '}',
      '',
      "window.addEventListener('DOMContentLoaded', calcularPregunta3);",
      '',
    ].join('\n');

    const navJs = [
      'function mostrarSeccion(id) {',
      "  document.querySelectorAll('.seccion').forEach((s) => { s.hidden = true; });",
      "  document.getElementById('seccion-' + id).hidden = false;",
      '}',
      '',
    ].join('\n');

    return [
      { name: 'ENUNCIADO.md', path: '/ENUNCIADO.md', content: enunciado, is_folder: false },
      { name: 'index.html', path: '/index.html', content: indexHtml, is_folder: false },
      { name: 'styles.css', path: '/styles.css', content: stylesCss, is_folder: false },
      { name: 'nav.js', path: '/nav.js', content: navJs, is_folder: false },
      { name: 'src', path: '/src', content: '', is_folder: true },
      { name: 'referencia.js', path: '/src/referencia.js', content: referenciaJs, is_folder: false },
      { name: 'mi-crud.js', path: '/src/mi-crud.js', content: miCrudJs, is_folder: false },
      { name: 'calculo1.js', path: '/src/calculo1.js', content: calculo1Js, is_folder: false },
      { name: 'calculo2.js', path: '/src/calculo2.js', content: calculo2Js, is_folder: false },
    ];
  }

  async findAllByUser(userId: string) {
    return this.projectRepo.find({
      where: { user_id: userId },
      order: { updated_at: 'DESC' },
    });
  }

  /** Resolves the current student's own project within a shared exam_group_id (for SEB direct-link startURL). */
  async findMyProjectInExamGroup(groupId: string, userId: string) {
    let project = await this.projectRepo.findOne({
      where: { exam_group_id: groupId, user_id: userId },
    });
    // Legacy: group_id might be a project id (no exam_group_id set)
    if (!project) {
      project = await this.projectRepo.findOne({
        where: { id: groupId, user_id: userId, is_exam: true },
      });
    }
    if (!project) throw new NotFoundException('No tenés un examen asignado en este grupo.');
    return project;
  }

  async findOne(id: string, userId: string, userRole?: string) {
    const project = await this.projectRepo.findOne({
      where: { id },
      relations: ['files', 'user'],
    });

    if (!project) throw new NotFoundException('Project not found');

    const isPrivileged = ['admin', 'teacher'].includes(userRole?.toLowerCase() ?? '');

    // Check time constraints for exams (admin/teacher bypass). Only applies while the
    // exam is still PENDING — once submitted/graded the student must still be able to
    // reopen it (read-only) regardless of the deadline having passed.
    if (project.is_exam && !isPrivileged && project.status === ProjectStatus.PENDING) {
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

    // Never leak sensitive user fields (password hash, tokens, etc.) to the client —
    // only expose the minimal identity fields needed to show "reviewing X's exam".
    if (project.user) {
      project.user = {
        first_name: project.user.first_name,
        last_name: project.user.last_name,
        email: project.user.email,
      } as User;
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
   * Batch-upsert all files (and folders) for a project.
   * Lookup priority: DB UUID (if provided) → name+path → create new.
   * This avoids URL-encoding issues with special chars in file names.
   *
   * Also deletes any file/folder that exists in the DB for this project but
   * is NOT present in the incoming `files` array. Without this, deleting a
   * file/folder in the editor only removed it from the frontend store — the
   * DB record survived and reappeared as a "ghost" file when an admin opened
   * the project for review, causing execution errors there even though the
   * student's own session (using the local store) worked fine.
   */
  async saveAllFiles(
    projectId: string,
    files: { id?: string; name: string; content: string; path: string; is_folder?: boolean }[],
    userId: string,
  ) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project || project.user_id !== userId) throw new ForbiddenException();
    if (project.is_exam && project.status !== ProjectStatus.PENDING) {
      throw new ForbiddenException('Este examen ya fue entregado y no se puede modificar.');
    }

    const existingFiles = await this.fileRepo.find({ where: { project_id: projectId } });
    const keptIds = new Set<string>();

    for (const f of files) {
      let file: PlaygroundFile | undefined;

      // Primary: find by DB UUID (works after renames since the record moves)
      if (f.id && !f.id.startsWith('local-')) {
        file = existingFiles.find((e) => e.id === f.id);
      }

      // Fallback: find by name + path
      if (!file) {
        file = existingFiles.find((e) => e.name === f.name && e.path === f.path);
      }

      if (file) {
        file.content = f.is_folder ? '' : f.content;
        file.name    = f.name;
        file.path    = f.path;
        await this.fileRepo.save(file);
        keptIds.add(file.id);
      } else {
        const created = this.fileRepo.create({
          project_id: projectId,
          name: f.name,
          content: f.is_folder ? '' : f.content,
          is_folder: f.is_folder ?? false,
          path: f.path,
        });
        const saved = await this.fileRepo.save(created);
        keptIds.add(saved.id);
      }
    }

    const toDelete = existingFiles.filter((e) => !keptIds.has(e.id));
    if (toDelete.length) {
      await this.fileRepo.remove(toDelete);
    }

    return { status: 'saved', count: files.length };
  }

  /** Rename a file or folder by its DB UUID. Updates child paths for folders. */
  async renameFile(projectId: string, fileId: string, newName: string, userId: string) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project || project.user_id !== userId) throw new ForbiddenException();
    if (project.is_exam && project.status !== ProjectStatus.PENDING) {
      throw new ForbiddenException('Este examen ya fue entregado y no se puede modificar.');
    }

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
    if (project.is_exam && project.status !== ProjectStatus.PENDING) {
      throw new ForbiddenException('Este examen ya fue entregado y no se puede modificar.');
    }

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
    if (project.is_exam && project.status !== ProjectStatus.PENDING) {
      throw new ForbiddenException('Este examen ya fue entregado y no se puede modificar.');
    }

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
  
  // Ventana de deduplicación: `fullscreenchange`, `visibilitychange` y `blur` son 3 listeners de
  // navegador independientes que suelen dispararse casi simultáneamente por UNA sola acción real
  // del alumno (ej. un solo Alt+Tab dispara `blur` + `visibilitychange` con <50ms de diferencia).
  // Sin este umbral, un mismo incidente se cuenta 2-3 veces en `cheating_logs`, inflando el
  // contador de infracciones que ve el profesor. Se ignora (no se persiste) cualquier evento nuevo
  // que llegue a menos de este umbral del último evento ya logueado, sin importar el `action`.
  private static readonly CHEAT_LOG_DEDUPE_WINDOW_MS = 2000;

  async logCheat(projectId: string, userId: string, action: string, details?: string) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project || project.user_id !== userId) throw new ForbiddenException();

    const now = new Date();
    const currentLogs = Array.isArray(project.cheating_logs) ? project.cheating_logs : [];

    const lastLog = currentLogs[currentLogs.length - 1];
    if (lastLog) {
      const lastTs = new Date(lastLog.timestamp).getTime();
      if (now.getTime() - lastTs < PlaygroundService.CHEAT_LOG_DEDUPE_WINDOW_MS) {
        // Mismo incidente real ya registrado por otro listener hace instantes: no duplicar.
        return { status: 'deduped' };
      }
    }

    currentLogs.push({ timestamp: now.toISOString(), action, details });
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

  /** Returns one summary entry per exam/practice batch (grouped by exam_group_id) */
  async findAdminExamGroups() {
    const exams = await this.projectRepo.find({
      where: [{ is_exam: true }, { exam_group_id: Not(IsNull()) }],
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
        is_exam:         first.is_exam,
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

  /** Returns all student projects belonging to an exam/practice group */
  async findAdminExamsByGroup(groupId: string) {
    const projects = await this.projectRepo.find({
      where: { exam_group_id: groupId },
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

  /** Deletes all student projects in an exam/practice group */
  async deleteAdminExamGroup(groupId: string) {
    const projects = await this.projectRepo.find({
      where: { exam_group_id: groupId },
      relations: ['files'],
    });
    if (projects.length === 0) {
      const single = await this.projectRepo.findOne({ where: { id: groupId, is_exam: true }, relations: ['files'] });
      if (single) return this.projectRepo.remove([single]);
      throw new NotFoundException('Exam group not found');
    }
    return this.projectRepo.remove(projects);
  }

  /** Updates metadata on all student projects in an exam/practice group */
  async updateAdminExamGroup(
    groupId: string,
    data: { name?: string; start_time?: Date | null; end_time?: Date | null; allow_copy_paste?: boolean; require_seb?: boolean },
  ) {
    const projects = await this.projectRepo.find({ where: { exam_group_id: groupId } });
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

  /** Change status of a single exam/practice project */
  async changeExamStatus(id: string, status: ProjectStatus) {
    const project = await this.projectRepo.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    if (!project.is_exam && !project.exam_group_id) throw new ForbiddenException('Solo se pueden cambiar status de proyectos de examen o práctica.');
    project.status = status;
    return this.projectRepo.save(project);
  }

  /** Change status of all projects in an exam/practice group */
  async changeExamGroupStatus(groupId: string, status: ProjectStatus) {
    const projects = await this.projectRepo.find({ where: { exam_group_id: groupId } });
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
