import { ExamVersion, ExamQuestion } from '../../entities/exam-version.entity';

/**
 * Andamiaje del examen "JavaScript — DOM, ciclos y CRUD".
 *
 * Sigue el MISMO patrón que `buildHtmlArrayExamFiles`: un único `index.html` con un menú que
 * muestra y oculta secciones (`nav.js`), y un `.js` por ejercicio dentro de `src/`. Es
 * deliberado: la vista previa del playground renderiza siempre el primer `.html` del proyecto,
 * así que tres `index.html` en carpetas separadas —que es como se trabaja en local— dejarían al
 * alumno sin poder ver los ejercicios 2 y 3. Con el menú, el alumno cambia de ejercicio dentro
 * de la propia vista previa.
 *
 * Los tres scripts comparten el ámbito global de la página, así que los ids del DOM y las
 * variables van prefijados por ejercicio para que no se pisen.
 */

interface TemaExamen {
  /** Ejercicio 1: recurso que se consume 15 unidades por vuelta. */
  e1Titulo: string;
  e1Historia: string;
  e1RecursoLabel: string;
  e1CantidadLabel: string;
  e1Item: string;
  e1Ok: string;
  e1Fallo: string;
  e1ResumenOk: string;
  e1ResumenFallo: string;
  e1ResumenResto: string;
  /** Ejercicio 2: 5 objetos con 3 atributos numéricos y clasificación por promedio. */
  e2Titulo: string;
  e2Historia: string;
  e2Entidad: string;
  e2EntidadPlural: string;
  e2Campos: [string, string, string];
  e2Labels: [string, string, string];
  e2Datos: [string, number, number, number][];
  e2Clases: [string, string, string];
  /** Ejercicio 3: CRUD. */
  e3Titulo: string;
  e3Entidad: string;
  e3EntidadPlural: string;
  e3CampoTexto: string;
  e3CampoTextoLabel: string;
  e3CampoNum: string;
  e3CampoNumLabel: string;
  e3Datos: [number, string, string, number][];
  e3PlaceholderNombre: string;
  e3PlaceholderTexto: string;
}

const TEMAS: Record<string, TemaExamen> = {
  'estacion-de-bomberos': {
    e1Titulo: 'Control de salidas de emergencia',
    e1Historia: 'La estación despacha unidades a emergencias. Cada salida consume 15 litros de agua del tanque.',
    e1RecursoLabel: 'Agua disponible (litros)', e1CantidadLabel: 'Cantidad de salidas',
    e1Item: 'Salida', e1Ok: 'despachada', e1Fallo: 'agua insuficiente',
    e1ResumenOk: 'Despachadas', e1ResumenFallo: 'Canceladas', e1ResumenResto: 'Agua restante',
    e2Titulo: 'Evaluación de unidades',
    e2Historia: 'La estación evalúa sus unidades según el estado del motor, la bomba y los neumáticos (sobre 100).',
    e2Entidad: 'Unidad', e2EntidadPlural: 'unidades',
    e2Campos: ['motor', 'bomba', 'neumaticos'], e2Labels: ['Motor', 'Bomba', 'Neumáticos'],
    e2Datos: [['Autobomba 1', 100, 75, 95], ['Autobomba 2', 70, 50, 75], ['Escalera', 85, 80, 90],
              ['Rescate', 95, 70, 80], ['Cisterna', 40, 35, 45]],
    e2Clases: ['Operativa', 'Requiere mantenimiento', 'Fuera de servicio'],
    e3Titulo: 'CRUD de unidades',
    e3Entidad: 'unidad', e3EntidadPlural: 'unidades',
    e3CampoTexto: 'estacion', e3CampoTextoLabel: 'Estación',
    e3CampoNum: 'combustible', e3CampoNumLabel: 'Combustible (0-100)',
    e3Datos: [[1, 'Autobomba 1', 'Central', 90], [2, 'Escalera', 'Norte', 55], [3, 'Rescate', 'Sur', 75]],
    e3PlaceholderNombre: 'Autobomba 2', e3PlaceholderTexto: 'Valle',
  },
  'refugio-de-animales': {
    e1Titulo: 'Reparto de raciones',
    e1Historia: 'El refugio reparte el alimento del día. Cada mascota atendida consume 15 raciones.',
    e1RecursoLabel: 'Raciones disponibles', e1CantidadLabel: 'Cantidad de mascotas',
    e1Item: 'Mascota', e1Ok: 'alimentada', e1Fallo: 'raciones insuficientes',
    e1ResumenOk: 'Alimentadas', e1ResumenFallo: 'Sin alimentar', e1ResumenResto: 'Raciones restantes',
    e2Titulo: 'Evaluación para adopción',
    e2Historia: 'El refugio evalúa a sus mascotas según su salud, su sociabilidad y su nivel de adiestramiento (sobre 100).',
    e2Entidad: 'Mascota', e2EntidadPlural: 'mascotas',
    e2Campos: ['salud', 'sociabilidad', 'adiestramiento'], e2Labels: ['Salud', 'Sociabilidad', 'Adiestramiento'],
    e2Datos: [['Luna', 100, 75, 95], ['Rocco', 70, 50, 75], ['Mia', 85, 80, 90],
              ['Thor', 95, 70, 80], ['Pelusa', 40, 35, 45]],
    e2Clases: ['Lista para adopción', 'Requiere seguimiento', 'No disponible'],
    e3Titulo: 'CRUD de mascotas',
    e3Entidad: 'mascota', e3EntidadPlural: 'mascotas',
    e3CampoTexto: 'especie', e3CampoTextoLabel: 'Especie',
    e3CampoNum: 'salud', e3CampoNumLabel: 'Salud (0-100)',
    e3Datos: [[1, 'Luna', 'Perro', 90], [2, 'Mia', 'Gato', 55], [3, 'Thor', 'Perro', 75]],
    e3PlaceholderNombre: 'Rocco', e3PlaceholderTexto: 'Conejo',
  },
  'museo': {
    e1Titulo: 'Iluminación de salas',
    e1Historia: 'El museo enciende la iluminación de sus salas. Cada sala iluminada consume 15 kWh del cupo diario.',
    e1RecursoLabel: 'Energía disponible (kWh)', e1CantidadLabel: 'Cantidad de salas',
    e1Item: 'Sala', e1Ok: 'iluminada', e1Fallo: 'energía insuficiente',
    e1ResumenOk: 'Iluminadas', e1ResumenFallo: 'A oscuras', e1ResumenResto: 'Energía restante',
    e2Titulo: 'Evaluación de obras',
    e2Historia: 'El museo evalúa sus obras según su estado de conservación, su valor histórico y su demanda del público (sobre 100).',
    e2Entidad: 'Obra', e2EntidadPlural: 'obras',
    e2Campos: ['conservacion', 'valor', 'demanda'], e2Labels: ['Conservación', 'Valor', 'Demanda'],
    e2Datos: [['Retrato azul', 100, 75, 95], ['Paisaje roto', 70, 50, 75], ['Bodegón', 85, 80, 90],
              ['Mural antiguo', 95, 70, 80], ['Boceto dañado', 40, 35, 45]],
    e2Clases: ['En exhibición', 'Requiere restauración', 'En bodega'],
    e3Titulo: 'CRUD de obras',
    e3Entidad: 'obra', e3EntidadPlural: 'obras',
    e3CampoTexto: 'sala', e3CampoTextoLabel: 'Sala',
    e3CampoNum: 'conservacion', e3CampoNumLabel: 'Conservación (0-100)',
    e3Datos: [[1, 'Retrato azul', 'Sala 1', 90], [2, 'Bodegón', 'Sala 2', 55], [3, 'Mural antiguo', 'Sala 2', 75]],
    e3PlaceholderNombre: 'Paisaje roto', e3PlaceholderTexto: 'Sala 3',
  },
  'aerolinea': {
    e1Titulo: 'Programación de vuelos',
    e1Historia: 'La aerolínea programa los vuelos del día. Cada despegue consume 15 toneladas de combustible.',
    e1RecursoLabel: 'Combustible disponible (toneladas)', e1CantidadLabel: 'Cantidad de vuelos',
    e1Item: 'Vuelo', e1Ok: 'programado', e1Fallo: 'combustible insuficiente',
    e1ResumenOk: 'Programados', e1ResumenFallo: 'Cancelados', e1ResumenResto: 'Combustible restante',
    e2Titulo: 'Evaluación de aeronaves',
    e2Historia: 'La aerolínea evalúa sus aeronaves según el estado del motor, el fuselaje y la aviónica (sobre 100).',
    e2Entidad: 'Aeronave', e2EntidadPlural: 'aeronaves',
    e2Campos: ['motor', 'fuselaje', 'avionica'], e2Labels: ['Motor', 'Fuselaje', 'Aviónica'],
    e2Datos: [['HC-101', 100, 75, 95], ['HC-202', 70, 50, 75], ['HC-303', 85, 80, 90],
              ['HC-404', 95, 70, 80], ['HC-505', 40, 35, 45]],
    e2Clases: ['Apta para volar', 'Requiere revisión', 'En tierra'],
    e3Titulo: 'CRUD de vuelos',
    e3Entidad: 'vuelo', e3EntidadPlural: 'vuelos',
    e3CampoTexto: 'destino', e3CampoTextoLabel: 'Destino',
    e3CampoNum: 'ocupacion', e3CampoNumLabel: 'Ocupación (0-100)',
    e3Datos: [[1, 'HC-101', 'Guayaquil', 90], [2, 'HC-202', 'Cuenca', 55], [3, 'HC-303', 'Manta', 75]],
    e3PlaceholderNombre: 'HC-404', e3PlaceholderTexto: 'Loja',
  },
  'laboratorio': {
    e1Titulo: 'Procesamiento de muestras',
    e1Historia: 'El laboratorio procesa las muestras del día. Cada análisis consume 15 mililitros de reactivo.',
    e1RecursoLabel: 'Reactivo disponible (ml)', e1CantidadLabel: 'Cantidad de muestras',
    e1Item: 'Muestra', e1Ok: 'procesada', e1Fallo: 'reactivo insuficiente',
    e1ResumenOk: 'Procesadas', e1ResumenFallo: 'Pendientes', e1ResumenResto: 'Reactivo restante',
    e2Titulo: 'Evaluación de equipos',
    e2Historia: 'El laboratorio evalúa sus equipos según su precisión, su calibración y su mantenimiento (sobre 100).',
    e2Entidad: 'Equipo', e2EntidadPlural: 'equipos',
    e2Campos: ['precision', 'calibracion', 'mantenimiento'], e2Labels: ['Precisión', 'Calibración', 'Mantenimiento'],
    e2Datos: [['Microscopio', 100, 75, 95], ['Centrífuga', 70, 50, 75], ['Espectrómetro', 85, 80, 90],
              ['Autoclave', 95, 70, 80], ['Balanza vieja', 40, 35, 45]],
    e2Clases: ['Certificado', 'Requiere calibración', 'Fuera de uso'],
    e3Titulo: 'CRUD de muestras',
    e3Entidad: 'muestra', e3EntidadPlural: 'muestras',
    e3CampoTexto: 'tipo', e3CampoTextoLabel: 'Tipo',
    e3CampoNum: 'pureza', e3CampoNumLabel: 'Pureza (0-100)',
    e3Datos: [[1, 'M-001', 'Sangre', 90], [2, 'M-002', 'Agua', 55], [3, 'M-003', 'Suelo', 75]],
    e3PlaceholderNombre: 'M-004', e3PlaceholderTexto: 'Aire',
  },
};

function slug(texto: string): string {
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Nombre del campo numérico sin la aclaración del rango: "Salud (0-100)" → "Salud". */
const corto = (label: string) => label.split(' (')[0];

export function buildJsDomCrudExamFiles(version: ExamVersion) {
  const t = TEMAS[slug(version.theme_name)] ?? TEMAS['refugio-de-animales'];
  const Plural = cap(t.e3EntidadPlural);
  const Entidad = cap(t.e3Entidad);

  const indexHtml = [
    '<!DOCTYPE html>',
    '<html lang="es">',
    '<head>',
    '  <meta charset="UTF-8">',
    `  <title>Examen JavaScript — ${version.theme_name}</title>`,
    '  <link rel="stylesheet" href="estilos.css">',
    '</head>',
    '<body>',
    `  <h1>Examen de JavaScript — ${version.theme_name}</h1>`,
    '',
    '  <nav class="menu">',
    '    <button onclick="mostrarSeccion(\'inicio\')">Inicio</button>',
    '    <button onclick="mostrarSeccion(\'ejercicio1\')">Ejercicio 1</button>',
    '    <button onclick="mostrarSeccion(\'ejercicio2\')">Ejercicio 2</button>',
    '    <button onclick="mostrarSeccion(\'ejercicio3\')">Ejercicio 3</button>',
    '  </nav>',
    '',
    '  <section id="seccion-inicio" class="seccion">',
    '    <h2>Instrucciones</h2>',
    '    <p>Usa el menú de arriba para moverte entre los tres ejercicios.</p>',
    '    <p>El HTML y el CSS ya están completos: <b>no hay que tocarlos</b>. Tu trabajo va en los',
    '       tres archivos de la carpeta <code>src/</code>, uno por ejercicio.</p>',
    `    <p>Ejercicio 1: ${t.e1Titulo} (2.5 pts) · Ejercicio 2: ${t.e2Titulo} (2.5 pts) ·`,
    `       Ejercicio 3: ${t.e3Titulo} (5 pts)</p>`,
    '  </section>',
    '',
    '  <section id="seccion-ejercicio1" class="seccion" hidden>',
    `    <h2>Ejercicio 1: ${t.e1Titulo}</h2>`,
    `    <p>${t.e1Historia}</p>`,
    `    <label for="e1-recurso">${t.e1RecursoLabel}:</label>`,
    '    <input type="number" id="e1-recurso">',
    `    <label for="e1-cantidad">${t.e1CantidadLabel}:</label>`,
    '    <input type="number" id="e1-cantidad">',
    '    <button id="e1-simular">Simular</button>',
    '    <div id="e1-resultado"></div>',
    '    <h3 id="e1-resumen"></h3>',
    '  </section>',
    '',
    '  <section id="seccion-ejercicio2" class="seccion" hidden>',
    `    <h2>Ejercicio 2: ${t.e2Titulo}</h2>`,
    `    <p>${t.e2Historia}</p>`,
    `    <button id="e2-evaluar">Evaluar ${t.e2EntidadPlural}</button>`,
    '    <table>',
    '      <thead><tr>',
    `        <th>${t.e2Entidad}</th>`,
    ...t.e2Labels.map((l) => `        <th>${l}</th>`),
    '        <th>Promedio</th><th>Clasificación</th>',
    '      </tr></thead>',
    '      <tbody id="e2-tabla"></tbody>',
    '    </table>',
    '    <h3 id="e2-resumen"></h3>',
    '  </section>',
    '',
    '  <section id="seccion-ejercicio3" class="seccion" hidden>',
    `    <h2>Ejercicio 3: ${t.e3Titulo}</h2>`,
    '    <form id="e3-formulario">',
    `      <h3 id="e3-titulo">Nueva ${t.e3Entidad}</h3>`,
    '      <label for="e3-nombre">Nombre:</label>',
    `      <input type="text" id="e3-nombre" placeholder="${t.e3PlaceholderNombre}">`,
    `      <label for="e3-campoTexto">${t.e3CampoTextoLabel}:</label>`,
    `      <input type="text" id="e3-campoTexto" placeholder="${t.e3PlaceholderTexto}">`,
    `      <label for="e3-campoNumero">${t.e3CampoNumLabel}:</label>`,
    '      <input type="number" id="e3-campoNumero" min="0" max="100">',
    '      <div class="acciones-formulario">',
    '        <button type="submit" id="e3-guardar">Guardar</button>',
    '        <button type="button" id="e3-cancelar">Cancelar</button>',
    '      </div>',
    '    </form>',
    '    <p id="e3-mensaje"></p>',
    '    <div id="e3-contenedor"></div>',
    '    <p id="e3-cantidad"></p>',
    '  </section>',
    '',
    '  <script src="nav.js"></script>',
    '  <script src="src/ejercicio-1.js"></script>',
    '  <script src="src/ejercicio-2.js"></script>',
    '  <script src="src/ejercicio-3.js"></script>',
    '</body>',
    '</html>',
    '',
  ].join('\n');

  const navJs = [
    '// Cambia de ejercicio mostrando y ocultando secciones. No hay que modificarlo.',
    'function mostrarSeccion(id) {',
    "  document.querySelectorAll('.seccion').forEach(function (s) { s.hidden = true; });",
    "  document.getElementById('seccion-' + id).hidden = false;",
    '}',
    '',
  ].join('\n');

  const estilosCss = [
    '* { box-sizing: border-box; }',
    'body { font-family: Arial, Helvetica, sans-serif; max-width: 820px; margin: 24px auto;',
    '       padding: 0 16px; color: #1a1a1a; background: #f7f8fa; }',
    'h1 { font-size: 22px; color: #2b4a7d; border-bottom: 2px solid #4a6fa5; padding-bottom: 8px; }',
    'h2 { font-size: 18px; color: #2b4a7d; }',
    'code { background: #e8eef7; padding: 1px 4px; border-radius: 3px; }',
    '.menu { display: flex; gap: 8px; margin: 16px 0 20px; flex-wrap: wrap; }',
    '.menu button { background: #4a6fa5; }',
    'label { display: block; margin-top: 12px; font-weight: bold; font-size: 14px; }',
    'input { width: 100%; padding: 8px; margin-top: 4px; border: 1px solid #c6d0de;',
    '        border-radius: 4px; font-size: 14px; }',
    'button { margin-top: 14px; padding: 9px 16px; border: 0; border-radius: 4px;',
    '         background: #4a6fa5; color: #fff; font-size: 14px; cursor: pointer; }',
    'button:hover { filter: brightness(0.92); }',
    '#e1-resultado p { margin: 4px 0; padding: 6px 10px; background: #fff; border-radius: 4px;',
    '                  border-left: 4px solid #c6d0de; }',
    '#e1-resumen, #e2-resumen { margin-top: 16px; padding: 10px 12px; background: #e8eef7;',
    '                           border-radius: 4px; font-size: 15px; }',
    'table { width: 100%; border-collapse: collapse; margin-top: 16px; background: #fff; font-size: 14px; }',
    'th, td { border: 1px solid #c6d0de; padding: 8px 10px; text-align: left; }',
    'th { background: #e8eef7; }',
    '#e3-formulario { background: #fff; padding: 16px; border: 1px solid #c6d0de; border-radius: 6px; }',
    '.acciones-formulario { display: flex; gap: 10px; }',
    '#e3-cancelar { background: #8894a6; }',
    '#e3-contenedor { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));',
    '                 gap: 12px; margin-top: 18px; }',
    '.tarjeta { background: #fff; border: 1px solid #c6d0de; border-left: 4px solid #4a6fa5;',
    '           border-radius: 6px; padding: 12px 14px; }',
    '.tarjeta h3 { margin: 0 0 6px; font-size: 16px; color: #2b4a7d; }',
    '.tarjeta p { margin: 2px 0; font-size: 13px; }',
    '.acciones { display: flex; gap: 8px; margin-top: 10px; }',
    '.acciones button { margin-top: 0; padding: 6px 12px; font-size: 13px; }',
    '.editar { background: #c98a1b; }',
    '.eliminar { background: #b3392f; }',
    '#e3-cantidad { margin-top: 14px; font-size: 14px; color: #555; }',
    '#e3-mensaje { margin-top: 10px; font-size: 14px; color: #b3392f; min-height: 18px; }',
    '',
  ].join('\n');

  const ejercicio1Js = [
    `// Ejercicio 1: ${t.e1Titulo}`,
    `// ${t.e1Historia}`,
    '//',
    '// Los elementos del DOM ya están tomados. Te toca escribir la lógica.',
    '',
    'const e1Recurso = document.getElementById("e1-recurso");',
    'const e1Cantidad = document.getElementById("e1-cantidad");',
    'const e1Simular = document.getElementById("e1-simular");',
    'const e1Resultado = document.getElementById("e1-resultado");',
    'const e1Resumen = document.getElementById("e1-resumen");',
    '',
    '// TODO 1: escucha el clic de e1Simular.',
    '// TODO 2: lee los dos valores con Number() y limpia lo anterior',
    '//         (e1Resultado.replaceChildren() y e1Resumen.textContent = "").',
    '// TODO 3: valida que ambos sean enteros positivos. Si no lo son, escribe',
    '//         "Ingrese enteros positivos" en e1Resumen y corta con return.',
    '// TODO 4: recorre con un ciclo for. En cada vuelta, si quedan 15 unidades o más,',
    '//         descuéntalas y cuenta un acierto; si no, cuenta un fallo. Crea un <p>',
    '//         con createElement y agrégalo a e1Resultado: verde si se logra, rojo si no.',
    '// TODO 5: al terminar, escribe en e1Resumen los tres totales.',
    '',
  ].join('\n');

  const arregloE2 = t.e2Datos
    .map(([nombre, a, b, c]) =>
      `  { nombre: "${nombre}", ${t.e2Campos[0]}: ${a},\n` +
      `    ${t.e2Campos[1]}: ${b}, ${t.e2Campos[2]}: ${c} }`)
    .join(',\n');

  const ejercicio2Js = [
    `// Ejercicio 2: ${t.e2Titulo}`,
    `// ${t.e2Historia}`,
    '//',
    `// Criterios: promedio >= 80 → "${t.e2Clases[0]}" (verde);`,
    `//            promedio >= 60 y < 80 → "${t.e2Clases[1]}" (naranja);`,
    `//            promedio < 60 → "${t.e2Clases[2]}" (rojo).`,
    '',
    `const e2Datos = [`,
    arregloE2,
    '];',
    '',
    'const e2Evaluar = document.getElementById("e2-evaluar");',
    'const e2Tabla = document.getElementById("e2-tabla");',
    'const e2Resumen = document.getElementById("e2-resumen");',
    '',
    '// TODO 1: escucha el clic de e2Evaluar y limpia la tabla con e2Tabla.replaceChildren().',
    '// TODO 2: recorre e2Datos con un ciclo for y calcula el promedio de los tres valores.',
    '// TODO 3: clasifica según los criterios de arriba y lleva un contador por clasificación.',
    '// TODO 4: por cada elemento crea un <tr> y, dentro, un <td> por columna (nombre, los tres',
    '//         valores, el promedio con toFixed(2) y la clasificación en su color y en negrita).',
    '// TODO 5: al terminar, escribe en e2Resumen los totales de cada clasificación.',
    '',
  ].join('\n');

  const arregloE3 = t.e3Datos
    .map(([id, nombre, texto, numero]) =>
      `  { id: ${id}, nombre: "${nombre}", ${t.e3CampoTexto}: "${texto}", ${t.e3CampoNum}: ${numero} }`)
    .join(',\n');

  const ejercicio3Js = [
    `// Ejercicio 3: ${t.e3Titulo}`,
    '//',
    `// La función mostrar${Plural}() ya está escrita: pinta la lista completa y deja listos los`,
    '// botones Editar y Eliminar de cada tarjeta. Tú escribes el CRUD que falta. El formulario',
    '// del HTML todavía no tiene NADA asociado.',
    '',
    `let e3Datos = [`,
    arregloE3,
    '];',
    '',
    'let e3SiguienteId = 4;',
    'let e3IdEditando = null;',
    '',
    '// ELEMENTOS DEL DOM',
    'const e3Formulario = document.getElementById("e3-formulario");',
    'const e3Nombre = document.getElementById("e3-nombre");',
    'const e3CampoTexto = document.getElementById("e3-campoTexto");',
    'const e3CampoNumero = document.getElementById("e3-campoNumero");',
    'const e3Cancelar = document.getElementById("e3-cancelar");',
    'const e3Titulo = document.getElementById("e3-titulo");',
    'const e3Contenedor = document.getElementById("e3-contenedor");',
    'const e3Mensaje = document.getElementById("e3-mensaje");',
    'const e3Cantidad = document.getElementById("e3-cantidad");',
    '',
    `// READ: MOSTRAR ${t.e3EntidadPlural.toUpperCase()} — ya resuelto, no hay que modificarlo`,
    `function mostrar${Plural}() {`,
    '',
    '    e3Contenedor.replaceChildren();',
    '',
    `    e3Datos.forEach(function (${t.e3Entidad}) {`,
    '',
    '        const tarjeta = document.createElement("div");',
    '        tarjeta.classList.add("tarjeta");',
    '',
    '        const titulo = document.createElement("h3");',
    `        titulo.textContent = ${t.e3Entidad}.nombre;`,
    '',
    '        const parrafoTexto = document.createElement("p");',
    '        parrafoTexto.textContent =',
    `            "${t.e3CampoTextoLabel}: " + ${t.e3Entidad}.${t.e3CampoTexto};`,
    '',
    '        const parrafoNumero = document.createElement("p");',
    '        parrafoNumero.textContent =',
    `            "${corto(t.e3CampoNumLabel)}: " + ${t.e3Entidad}.${t.e3CampoNum};`,
    '',
    '        const acciones = document.createElement("div");',
    '        acciones.classList.add("acciones");',
    '',
    '        const botonEditar = document.createElement("button");',
    '        botonEditar.textContent = "Editar";',
    '        botonEditar.classList.add("editar");',
    '',
    '        botonEditar.addEventListener("click", function () {',
    `            editar${Entidad}(${t.e3Entidad}.id);`,
    '        });',
    '',
    '        const botonEliminar = document.createElement("button");',
    '        botonEliminar.textContent = "Eliminar";',
    '        botonEliminar.classList.add("eliminar");',
    '',
    '        botonEliminar.addEventListener("click", function () {',
    `            eliminar${Entidad}(${t.e3Entidad}.id);`,
    '        });',
    '',
    '        acciones.append(botonEditar, botonEliminar);',
    '        tarjeta.append(titulo, parrafoTexto, parrafoNumero, acciones);',
    '        e3Contenedor.appendChild(tarjeta);',
    '',
    '    });',
    '',
    `    e3Cantidad.textContent = "Total: " + e3Datos.length + " ${t.e3EntidadPlural}";`,
    '',
    '}',
    '',
    '// ─── A PARTIR DE AQUÍ TE TOCA A TI ─────────────────────────────────────────',
    '',
    '// TODO 1 — CREATE y UPDATE: escucha el "submit" de e3Formulario (con preventDefault).',
    `//   Valida que el nombre y la ${t.e3CampoTexto} no estén vacíos y que el número esté entre`,
    '//   0 y 100; si algo falla, muéstralo en e3Mensaje y no guardes. Si e3IdEditando es null,',
    '//   agrega un objeto nuevo usando e3SiguienteId y después auméntalo; si no, actualiza el',
    `//   que tenga ese id SIN cambiar su id. Al terminar, limpia el formulario y llama a mostrar${Plural}().`,
    '',
    `// TODO 2 — editar${Entidad}(id): busca el elemento, carga sus datos en los inputs, guarda su`,
    `//   id en e3IdEditando y cambia e3Titulo a "Editando ${t.e3Entidad}".`,
    `function editar${Entidad}(id) {`,
    '',
    '}',
    '',
    `// TODO 3 — eliminar${Entidad}(id): pide confirmación con confirm(). Si acepta, quita ese`,
    '//   elemento del arreglo y vuelve a mostrar la lista.',
    `function eliminar${Entidad}(id) {`,
    '',
    '}',
    '',
    '// TODO 4 — Cancelar: limpia el formulario, pone e3IdEditando en null y devuelve el título',
    `//   a "Nueva ${t.e3Entidad}".`,
    '',
    `mostrar${Plural}();`,
    '',
  ].join('\n');

  return [
    { name: 'index.html', path: '/index.html', content: indexHtml, is_folder: false },
    { name: 'estilos.css', path: '/estilos.css', content: estilosCss, is_folder: false },
    { name: 'nav.js', path: '/nav.js', content: navJs, is_folder: false },
    { name: 'src', path: '/src', content: '', is_folder: true },
    { name: 'ejercicio-1.js', path: '/src/ejercicio-1.js', content: ejercicio1Js, is_folder: false },
    { name: 'ejercicio-2.js', path: '/src/ejercicio-2.js', content: ejercicio2Js, is_folder: false },
    { name: 'ejercicio-3.js', path: '/src/ejercicio-3.js', content: ejercicio3Js, is_folder: false },
  ];
}

/** Los nombres de los cinco temas, en el orden en que se reparten por rotación. */
export const JS_DOM_CRUD_TEMAS = [
  'Estación de Bomberos', 'Refugio de Animales', 'Museo', 'Aerolínea', 'Laboratorio',
];

/**
 * Las tres consignas de una variante. Salen de la misma tabla `TEMAS` que genera el andamiaje,
 * así que el enunciado y los archivos del alumno no pueden desincronizarse.
 */
export function buildJsDomCrudQuestions(themeName: string): ExamQuestion[] {
  const t = TEMAS[slug(themeName)] ?? TEMAS['refugio-de-animales'];
  const Plural = cap(t.e3EntidadPlural);
  const Entidad = cap(t.e3Entidad);

  return [
    {
      order: 1, points: 2.5, title: t.e1Titulo,
      statement:
        `${t.e1Historia} Resuélvelo en \`src/ejercicio-1.js\`. ` +
        'Al pulsar **Simular**, valida que los dos valores sean enteros positivos; si no lo son, ' +
        'muestra `Ingrese enteros positivos` en el resumen y no sigas. Después recorre con un ciclo ' +
        '`for`: en cada vuelta, si queda suficiente, descuenta las 15 unidades y cuenta un acierto; ' +
        'si no, cuenta un fallo. Crea un `<p>` por vuelta con `createElement`, en verde cuando se ' +
        `logra ("${t.e1Ok}") y en rojo cuando no ("${t.e1Fallo}"). Al terminar, escribe en el resumen ` +
        `"${t.e1ResumenOk}", "${t.e1ResumenFallo}" y "${t.e1ResumenResto}". ` +
        'Prueba con 80 y 7: deben salir 5 logrados, 2 fallidos y 5 unidades restantes. ' +
        'Debes usar: `addEventListener`, `Number()`, `Number.isInteger()`, un ciclo `for`, ' +
        '`createElement` y `appendChild`.',
    },
    {
      order: 2, points: 2.5, title: t.e2Titulo,
      statement:
        `${t.e2Historia} Resuélvelo en \`src/ejercicio-2.js\`, donde el arreglo ya está declarado. ` +
        'Al pulsar **Evaluar**, recorre el arreglo con un ciclo `for`, calcula el promedio de los tres ' +
        'valores y genera una fila de tabla por elemento con `createElement`. Clasifica según el ' +
        `promedio: "${t.e2Clases[0]}" si es mayor o igual a 80 (verde); "${t.e2Clases[1]}" si está ` +
        `entre 60 y 80 (naranja); "${t.e2Clases[2]}" si es menor que 60 (rojo). El promedio va con dos ` +
        'decimales (`toFixed(2)`) y la celda de la clasificación en su color y en negrita. Al final, ' +
        'escribe en el resumen cuántos hay de cada clasificación. ' +
        'Debes usar: un ciclo `for` sobre el arreglo, `if / else if / else`, `toFixed(2)`, ' +
        '`createElement` y `appendChild`.',
    },
    {
      order: 3, points: 5, title: t.e3Titulo,
      statement:
        `Administra las ${t.e3EntidadPlural} en \`src/ejercicio-3.js\`. Cada ${t.e3Entidad} tiene ` +
        `\`id\` único, \`nombre\`, \`${t.e3CampoTexto}\` (texto) y \`${t.e3CampoNum}\` (entero de 0 a 100). ` +
        `Ya están hechos el arreglo, los elementos del DOM y la función \`mostrar${Plural}()\`, que pinta ` +
        'la lista y deja funcionando los botones Editar y Eliminar de cada tarjeta: no la modifiques, ' +
        'llámala cada vez que cambien los datos. El formulario del HTML todavía no tiene nada asociado. ' +
        '(1) CREATE y UPDATE: escucha el `submit` del formulario con `preventDefault()`. Valida que el ' +
        `nombre y la ${t.e3CampoTexto} no estén vacíos y que el número esté entre 0 y 100; si algo falla, ` +
        'muéstralo en el mensaje y no guardes. Si `e3IdEditando` es `null`, agrega un objeto nuevo con ' +
        '`e3SiguienteId` y auméntalo después; si no, actualiza el que tenga ese id sin cambiar su `id`. ' +
        `(2) \`editar${Entidad}(id)\`: carga los datos en los inputs, guarda el id en \`e3IdEditando\` y ` +
        `cambia el título a "Editando ${t.e3Entidad}". (3) \`eliminar${Entidad}(id)\`: pide confirmación ` +
        'con `confirm()` y, si acepta, quita el elemento del arreglo y vuelve a mostrar la lista. ' +
        `(4) Cancelar: limpia el formulario, pone \`e3IdEditando\` en \`null\` y devuelve el título a ` +
        `"Nueva ${t.e3Entidad}". ` +
        'Debes usar: `addEventListener("submit", ...)` con `preventDefault()`, `push`, `find`, `filter` y `confirm`.',
    },
  ];
}
