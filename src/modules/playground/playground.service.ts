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
import { getVariantConfig, VariantField, DartFieldType } from '../practice-api/practice-variants.config';

/** Valor Dart por defecto según el tipo del campo, usado al parsear la respuesta de la API. */
function dartDefault(type: DartFieldType): string {
  if (type === 'string') return "''";
  if (type === 'bool') return 'true';
  return '0';
}

/** Expresión Dart para leer `json['key']` con el tipo y valor por defecto correctos. */
function dartFromJson(field: VariantField): string {
  const { key, type } = field;
  if (type === 'string') return `json['${key}'] as String? ?? ''`;
  if (type === 'int') return `(json['${key}'] as num?)?.toInt() ?? 0`;
  if (type === 'double') return `(json['${key}'] as num?)?.toDouble() ?? 0`;
  return `json['${key}'] as bool? ?? true`;
}

function dartType(type: DartFieldType): string {
  return type === 'string' ? 'String' : type === 'int' ? 'int' : type === 'double' ? 'double' : 'bool';
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

/** Wraps text into `///` Dart doc-comment lines (for widget/screen headers). */
function wrapLineComment(text: string, width = 86): string {
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
  return lines.map(l => `/// ${l}`).join('\n');
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
   * Andamiaje de Flutter con arquitectura por capas (models/services/screens),
   * más un único archivo de enunciados (ENUNCIADO.md, no-.dart) para no
   * repetirlos por archivo — el bundler de preview del frontend solo toma
   * archivos .dart, así que este .md queda automáticamente fuera del preview
   * compilado.
   *
   * Estructura de la pantalla principal (home_screen.dart): ícono grande +
   * mensaje de bienvenida, 3 botones abajo (uno por pregunta, cada uno abre
   * su propia pantalla stub) y un Drawer (menú) con acceso al ejemplo de
   * referencia "ToDo" — una mini-app APARTE, completa y funcional (misma
   * estructura: home + 3 botones), contra otra API (`/todo-api/todos`),
   * que el alumno puede estudiar/replicar para resolver su propia variante.
   * Las 2 pantallas de cálculo del ejemplo ToDo son intencionalmente
   * DISTINTAS a las de Preguntas 2/3 del examen (para que sirvan de guía de
   * patrón, no de respuesta literal).
   */
  private buildFlutterExamFiles(version: ExamVersion) {
    const questions = [...(version.questions ?? [])].sort((a, b) => a.order - b.order);
    const [q1, q2, q3] = questions;
    const totalPoints = questions.reduce((sum, q) => sum + (q.points ?? 0), 0);
    const typeSlug = slugify(version.theme_name);
    const variant = getVariantConfig(typeSlug);
    const fields = variant.fields;
    const apiBase = 'https://api.franciscohiguera.site/api';
    const endpoint = `${apiBase}/practice-api/${typeSlug}/${variant.resource}`;
    const todoEndpoint = `${apiBase}/todo-api/todos`;

    const enunciado = [
      `# Examen Flutter — ${version.theme_name}`,
      '',
      `Puntaje total: ${totalPoints} pts`,
      '',
      '## Tu API (variante asignada)',
      '',
      `> \`GET/POST ${endpoint}\` y \`GET/PATCH/DELETE ${endpoint}/:id\` (ya viene configurado en \`lib/services/api_service.dart\`).`,
      '',
      `> Campos del recurso: ${fields.map((f) => `\`${f.key}\` (${dartType(f.type)})`).join(', ')}.`,
      '',
      '## Estructura del proyecto',
      '',
      '- `lib/screens/home_screen.dart`: pantalla principal (ícono + bienvenida + 3 botones, uno por pregunta).',
      '- `lib/screens/item_list_screen.dart`: **Pregunta 1** — stub del CRUD contra tu API.',
      '- `lib/screens/question2_screen.dart`: **Pregunta 2** — stub de la pantalla de cálculo.',
      '- `lib/screens/question3_screen.dart`: **Pregunta 3** — stub de la pantalla de cálculo.',
      '',
      '### Ejemplo de referencia (ToDo) — accedé desde el menú ☰ de la pantalla principal',
      '',
      '  Es una mini-app COMPLETA y funcional, con la misma estructura que tu examen (pantalla',
      '  principal + 3 botones), pero contra otra API pública ' + `(\`${todoEndpoint}\`)` + ' y con un',
      '  modelo de solo 2 campos (`id` + `nombre`). Estudiá este ejemplo para replicar el mismo',
      '  patrón (modelo → servicio → pantalla) en las pantallas de tu propia variante:',
      '',
      '  - `lib/screens/todo_home_screen.dart`: pantalla principal del ejemplo (ícono + bienvenida + 3 botones).',
      '  - `lib/screens/todo_list_screen.dart` + `todo_form_screen.dart`: CRUD completo (listar/crear/editar/eliminar).',
      '  - `lib/screens/todo_stat1_screen.dart`: ejemplo de pantalla de cálculo (promedio de caracteres por tarea).',
      '  - `lib/screens/todo_stat2_screen.dart`: ejemplo de pantalla de cálculo (buscador de tareas por texto).',
      '',
      '  Nota: los cálculos del ejemplo ToDo son a propósito DISTINTOS a los de las Preguntas 2 y 3 de',
      '  tu examen — sirven para mostrar el patrón, no la respuesta.',
      '',
      '## Preguntas',
      '',
      ...questions.map((q) => `### Pregunta ${q.order}: ${q.title} (${q.points} pts)\n\n${q.statement}\n`),
    ].join('\n');

    const constructorParams = fields.map((f) => `    required this.${f.key},`).join('\n');
    const classProps = fields.map((f) => `  final ${dartType(f.type)} ${f.key};`).join('\n');
    const fromJsonProps = fields.map((f) => `      ${f.key}: ${dartFromJson(f)},`).join('\n');
    const toJsonProps = fields.map((f) => `      '${f.key}': ${f.key},`).join('\n');
    const firstField = fields[0];
    const secondField = fields[1] ?? fields[0];

    return [
      { name: 'ENUNCIADO.md', path: '/ENUNCIADO.md', content: enunciado, is_folder: false },
      { name: 'lib', path: '/lib', content: '', is_folder: true },
      { name: 'models', path: '/lib/models', content: '', is_folder: true },
      { name: 'services', path: '/lib/services', content: '', is_folder: true },
      { name: 'screens', path: '/lib/screens', content: '', is_folder: true },
      {
        name: 'item.dart', path: '/lib/models/item.dart', is_folder: false,
        content:
`/// Modelo de datos de tu variante (${version.theme_name}).
class Item {
  final String? id;
${classProps}

  Item({
    this.id,
${constructorParams}
  });

  factory Item.fromJson(Map<String, dynamic> json) {
    return Item(
      id: json['id'] as String?,
${fromJsonProps}
    );
  }

  Map<String, dynamic> toJson() {
    return {
${toJsonProps}
    };
  }
}
`,
      },
      {
        name: 'todo.dart', path: '/lib/models/todo.dart', is_folder: false,
        content:
`/// Modelo del ejemplo de referencia — solo 2 campos, a propósito, para que
/// sirva de plantilla simple de arquitectura por capas.
class Todo {
  final String? id;
  final String nombre;

  Todo({this.id, required this.nombre});

  factory Todo.fromJson(Map<String, dynamic> json) {
    return Todo(
      id: json['id'] as String?,
      nombre: json['nombre'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {'nombre': nombre};
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

/// Cliente de la API de práctica de tu variante (ver ENUNCIADO.md).
class ApiService {
  static const String baseUrl = '${endpoint}';

  Future<List<Item>> fetchItems() async {
    final res = await http.get(Uri.parse(baseUrl));
    final List<dynamic> data = jsonDecode(res.body);
    return data.map((e) => Item.fromJson(e)).toList();
  }

  Future<Item> createItem(Item item) async {
    final res = await http.post(
      Uri.parse(baseUrl),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(item.toJson()),
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
        name: 'todo_api_service.dart', path: '/lib/services/todo_api_service.dart', is_folder: false,
        content:
`import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/todo.dart';

/// Cliente del ejemplo de referencia — API pública distinta a la de tu
/// variante, usada solo para estudiar el patrón (no es parte de tu entrega).
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
        name: 'home_screen.dart', path: '/lib/screens/home_screen.dart', is_folder: false,
        content:
`import 'package:flutter/material.dart';
import 'item_list_screen.dart';
import 'question2_screen.dart';
import 'question3_screen.dart';
import 'todo_home_screen.dart';

/// Pantalla principal: ícono + bienvenida, 3 botones (uno por pregunta) y un
/// Drawer con el ejemplo de referencia (ToDo).
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('${version.theme_name}')),
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            const DrawerHeader(
              child: Text('Menú', style: TextStyle(fontSize: 20)),
            ),
            ListTile(
              leading: const Icon(Icons.checklist),
              title: const Text('Ejemplo de referencia (ToDo)'),
              subtitle: const Text('App completa ya resuelta'),
              onTap: () {
                Navigator.pop(context);
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const TodoHomeScreen()),
                );
              },
            ),
          ],
        ),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.school, size: 96, color: Colors.blue),
            const SizedBox(height: 16),
            Text(
              'Bienvenido/a al examen de ${version.theme_name}',
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
                    MaterialPageRoute(builder: (_) => const ItemListScreen()),
                  ),
                  child: Text('Pregunta 1 · ${q1?.title ?? ''} (${q1?.points ?? 0} pts)'),
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const Question2Screen()),
                  ),
                  child: Text('Pregunta 2 · ${q2?.title ?? ''} (${q2?.points ?? 0} pts)'),
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const Question3Screen()),
                  ),
                  child: Text('Pregunta 3 · ${q3?.title ?? ''} (${q3?.points ?? 0} pts)'),
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
        name: 'item_list_screen.dart', path: '/lib/screens/item_list_screen.dart', is_folder: false,
        content:
`import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../models/item.dart';

${wrapLineComment(`Pregunta 1 (${q1?.points ?? 0} pts): ${q1?.statement ?? ''}`)}
class ItemListScreen extends StatefulWidget {
  const ItemListScreen({super.key});

  @override
  State<ItemListScreen> createState() => _ItemListScreenState();
}

class _ItemListScreenState extends State<ItemListScreen> {
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
      appBar: AppBar(title: const Text('${q1?.title ?? 'Pregunta 1'}')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _items.length,
              itemBuilder: (context, i) {
                final item = _items[i];
                return ListTile(
                  title: Text(item.${firstField.key}.toString()),
                  subtitle: Text('${secondField.key}: \${item.${secondField.key}}'),
                  trailing: IconButton(
                    icon: const Icon(Icons.delete),
                    onPressed: () {
                      // TODO: eliminar (item.id) llamando a _api.deleteItem y recargar la lista
                    },
                  ),
                  onTap: () {
                    // TODO: abrir un formulario para editar este item (parte del examen)
                  },
                );
              },
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // TODO: abrir un formulario para crear un item nuevo (parte del examen)
          // usando _api.createItem(...) y recargando la lista con _load()
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}
`,
      },
      {
        name: 'question2_screen.dart', path: '/lib/screens/question2_screen.dart', is_folder: false,
        content:
`import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../models/item.dart';

${wrapLineComment(`Pregunta 2 (${q2?.points ?? 0} pts): ${q2?.statement ?? ''}`)}
class Question2Screen extends StatefulWidget {
  const Question2Screen({super.key});

  @override
  State<Question2Screen> createState() => _Question2ScreenState();
}

class _Question2ScreenState extends State<Question2Screen> {
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
      appBar: AppBar(title: const Text('${q2?.title ?? 'Pregunta 2'}')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${q2?.statement ?? ''}',
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                  const SizedBox(height: 24),
                  // TODO: calcular el resultado a partir de \`_items\` y mostrarlo abajo
                  // (parte del examen).
                  const Text('Resultado: (pendiente de implementar)'),
                ],
              ),
            ),
    );
  }
}
`,
      },
      {
        name: 'question3_screen.dart', path: '/lib/screens/question3_screen.dart', is_folder: false,
        content:
`import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../models/item.dart';

${wrapLineComment(`Pregunta 3 (${q3?.points ?? 0} pts): ${q3?.statement ?? ''}`)}
class Question3Screen extends StatefulWidget {
  const Question3Screen({super.key});

  @override
  State<Question3Screen> createState() => _Question3ScreenState();
}

class _Question3ScreenState extends State<Question3Screen> {
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
      appBar: AppBar(title: const Text('${q3?.title ?? 'Pregunta 3'}')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${q3?.statement ?? ''}',
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                  const SizedBox(height: 24),
                  // TODO: calcular el resultado a partir de \`_items\` y mostrarlo abajo
                  // (parte del examen).
                  const Text('Resultado: (pendiente de implementar)'),
                ],
              ),
            ),
    );
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

/// Ejemplo de referencia — CRUD completo y funcional (no es parte de la
/// entrega, es solo para estudiar el patrón: modelo → servicio → pantalla).
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

  @override
  void initState() {
    super.initState();
    _nombreCtrl = TextEditingController(text: widget.todo?.nombre ?? '');
  }

  @override
  void dispose() {
    _nombreCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final nombre = _nombreCtrl.text.trim();
    if (nombre.isEmpty) return;

    if (widget.todo == null) {
      await _api.createTodo(Todo(nombre: nombre));
    } else {
      await _api.updateTodo(widget.todo!.id!, Todo(nombre: nombre));
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
import 'screens/home_screen.dart';

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
      home: const HomeScreen(),
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
