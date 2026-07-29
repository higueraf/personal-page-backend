/**
 * Configuración de las variantes de la "API de práctica".
 *
 * Cada variante tiene su propio segmento de URL (`/practice-api/<key>/<resource>`,
 * ej. `/practice-api/ropa/prendas`) y su propio conjunto de campos (mínimo 7,
 * con nombres distintos entre sí),
 * para que copiar el proyecto de un compañero con otra variante no funcione
 * sin cambios reales de código.
 *
 * Esta config la usan tanto `practice-api.service.ts` (para poblar datos
 * demo) como `playground.service.ts` (para generar el modelo Dart y el
 * ApiService del examen de Flutter), así ambos quedan siempre sincronizados.
 */

export type DartFieldType = 'string' | 'int' | 'double' | 'bool';

export interface VariantField {
  key: string;
  type: DartFieldType;
  label: string;
}

export interface VariantConfig {
  /** Último segmento de la URL del recurso, ej. `/practice-api/ropa/prendas` — distinto por variante. */
  resource: string;
  fields: VariantField[];
  seeds: Record<string, any>[];
}

export const PRACTICE_VARIANTS: Record<string, VariantConfig> = {
  ropa: {
    resource: 'prendas',
    fields: [
      { key: 'prenda', type: 'string', label: 'Prenda' },
      { key: 'talla', type: 'string', label: 'Talla' },
      { key: 'color', type: 'string', label: 'Color' },
      { key: 'categoria', type: 'string', label: 'Categoría' },
      { key: 'precio', type: 'double', label: 'Precio' },
      { key: 'stock', type: 'int', label: 'Stock' },
      { key: 'disponible', type: 'bool', label: 'Disponible' },
    ],
    seeds: [
      { prenda: 'Camiseta básica', talla: 'M', color: 'Blanco', categoria: 'Camisetas', precio: 12.5, stock: 30, disponible: true },
      { prenda: 'Jean clásico', talla: '32', color: 'Azul', categoria: 'Pantalones', precio: 28.0, stock: 15, disponible: true },
      { prenda: 'Chompa deportiva', talla: 'L', color: 'Negro', categoria: 'Abrigos', precio: 35.0, stock: 8, disponible: true },
      { prenda: 'Gorra', talla: 'Única', color: 'Rojo', categoria: 'Accesorios', precio: 8.0, stock: 25, disponible: true },
      { prenda: 'Zapatillas urbanas', talla: '40', color: 'Gris', categoria: 'Calzado', precio: 45.0, stock: 0, disponible: false },
    ],
  },
  libros: {
    resource: 'libros',
    fields: [
      { key: 'titulo', type: 'string', label: 'Título' },
      { key: 'autor', type: 'string', label: 'Autor' },
      { key: 'genero', type: 'string', label: 'Género' },
      { key: 'precio', type: 'double', label: 'Precio' },
      { key: 'ejemplares', type: 'int', label: 'Ejemplares' },
      { key: 'anioPublicacion', type: 'int', label: 'Año de publicación' },
      { key: 'disponible', type: 'bool', label: 'Disponible' },
    ],
    seeds: [
      { titulo: 'Cien años de soledad', autor: 'Gabriel García Márquez', genero: 'Novela', precio: 15.0, ejemplares: 5, anioPublicacion: 1967, disponible: true },
      { titulo: 'Clean Code', autor: 'Robert C. Martin', genero: 'Tecnología', precio: 22.0, ejemplares: 3, anioPublicacion: 2008, disponible: true },
      { titulo: 'El Principito', autor: 'Antoine de Saint-Exupéry', genero: 'Infantil', precio: 9.5, ejemplares: 0, anioPublicacion: 1943, disponible: false },
      { titulo: 'Sapiens', autor: 'Yuval Noah Harari', genero: 'Ensayo', precio: 18.0, ejemplares: 7, anioPublicacion: 2011, disponible: true },
      { titulo: 'Cálculo I', autor: 'James Stewart', genero: 'Educativo', precio: 25.0, ejemplares: 2, anioPublicacion: 2015, disponible: true },
    ],
  },
  farmacia: {
    resource: 'medicamentos',
    fields: [
      { key: 'medicamento', type: 'string', label: 'Medicamento' },
      { key: 'presentacion', type: 'string', label: 'Presentación' },
      { key: 'laboratorio', type: 'string', label: 'Laboratorio' },
      { key: 'precio', type: 'double', label: 'Precio' },
      { key: 'existencias', type: 'int', label: 'Existencias' },
      { key: 'requiereReceta', type: 'bool', label: 'Requiere receta' },
      { key: 'fechaVencimiento', type: 'string', label: 'Fecha de vencimiento' },
    ],
    seeds: [
      { medicamento: 'Paracetamol 500mg', presentacion: 'Tabletas', laboratorio: 'Genfar', precio: 3.5, existencias: 40, requiereReceta: false, fechaVencimiento: '2027-05-01' },
      { medicamento: 'Ibuprofeno 400mg', presentacion: 'Tabletas', laboratorio: 'Bayer', precio: 4.2, existencias: 3, requiereReceta: false, fechaVencimiento: '2026-11-01' },
      { medicamento: 'Amoxicilina 500mg', presentacion: 'Cápsulas', laboratorio: 'Pfizer', precio: 6.8, existencias: 2, requiereReceta: true, fechaVencimiento: '2026-09-01' },
      { medicamento: 'Vitamina C', presentacion: 'Efervescente', laboratorio: 'Bayer', precio: 5.0, existencias: 50, requiereReceta: false, fechaVencimiento: '2028-01-01' },
      { medicamento: 'Alcohol antiséptico', presentacion: 'Líquido', laboratorio: 'Genérico', precio: 2.0, existencias: 4, requiereReceta: false, fechaVencimiento: '2027-03-01' },
    ],
  },
  tareas: {
    resource: 'tareas',
    fields: [
      { key: 'tarea', type: 'string', label: 'Tarea' },
      { key: 'materia', type: 'string', label: 'Materia' },
      { key: 'prioridad', type: 'string', label: 'Prioridad' },
      { key: 'progreso', type: 'int', label: 'Progreso (%)' },
      { key: 'fechaLimite', type: 'string', label: 'Fecha límite' },
      { key: 'responsable', type: 'string', label: 'Responsable' },
      { key: 'completada', type: 'bool', label: 'Completada' },
    ],
    seeds: [
      { tarea: 'Terminar informe de proyecto', materia: 'Programación IV', prioridad: 'Alta', progreso: 40, fechaLimite: '2026-08-01', responsable: 'Juan Pérez', completada: false },
      { tarea: 'Estudiar para el examen', materia: 'Bases de Datos', prioridad: 'Alta', progreso: 20, fechaLimite: '2026-07-28', responsable: 'María Gómez', completada: false },
      { tarea: 'Comprar materiales', materia: 'Diseño Gráfico', prioridad: 'Media', progreso: 100, fechaLimite: '2026-07-20', responsable: 'Carlos Ruiz', completada: true },
      { tarea: 'Reunión con el equipo', materia: 'Programación IV', prioridad: 'Media', progreso: 0, fechaLimite: '2026-08-05', responsable: 'Ana Torres', completada: false },
      { tarea: 'Revisar correos pendientes', materia: 'Administración', prioridad: 'Baja', progreso: 100, fechaLimite: '2026-07-15', responsable: 'Luis Salas', completada: true },
    ],
  },
  nomina: {
    resource: 'empleados',
    fields: [
      { key: 'nombre', type: 'string', label: 'Nombre' },
      { key: 'cargo', type: 'string', label: 'Cargo' },
      { key: 'departamento', type: 'string', label: 'Departamento' },
      { key: 'salarioBase', type: 'double', label: 'Salario base' },
      { key: 'antiguedad', type: 'int', label: 'Antigüedad (años)' },
      { key: 'codigoEmpleado', type: 'string', label: 'Código de empleado' },
      { key: 'activo', type: 'bool', label: 'Activo' },
    ],
    seeds: [
      { nombre: 'Laura Méndez', cargo: 'Analista de sistemas', departamento: 'Tecnología', salarioBase: 1800.0, antiguedad: 3, codigoEmpleado: 'EMP-001', activo: true },
      { nombre: 'Jorge Salinas', cargo: 'Contador', departamento: 'Finanzas', salarioBase: 1600.0, antiguedad: 5, codigoEmpleado: 'EMP-002', activo: true },
      { nombre: 'Patricia Rivas', cargo: 'Recursos Humanos', departamento: 'RRHH', salarioBase: 1500.0, antiguedad: 1, codigoEmpleado: 'EMP-003', activo: true },
      { nombre: 'Diego Castro', cargo: 'Vendedor', departamento: 'Ventas', salarioBase: 1200.0, antiguedad: 2, codigoEmpleado: 'EMP-004', activo: false },
      { nombre: 'Sofía Herrera', cargo: 'Gerente de Ventas', departamento: 'Ventas', salarioBase: 2200.0, antiguedad: 7, codigoEmpleado: 'EMP-005', activo: true },
    ],
  },
  papeleria: {
    resource: 'productos',
    fields: [
      { key: 'producto', type: 'string', label: 'Producto' },
      { key: 'marca', type: 'string', label: 'Marca' },
      { key: 'categoria', type: 'string', label: 'Categoría' },
      { key: 'precio', type: 'double', label: 'Precio' },
      { key: 'stock', type: 'int', label: 'Stock' },
      { key: 'codigo', type: 'string', label: 'Código' },
      { key: 'disponible', type: 'bool', label: 'Disponible' },
    ],
    seeds: [
      { producto: 'Cuaderno universitario 100 hojas', marca: 'Norma', categoria: 'Cuadernos', precio: 3.5, stock: 40, codigo: 'PAP-001', disponible: true },
      { producto: 'Lápiz HB', marca: 'Faber-Castell', categoria: 'Lápices', precio: 0.5, stock: 200, codigo: 'PAP-002', disponible: true },
      { producto: 'Resma de papel bond A4', marca: 'Reprograf', categoria: 'Papel', precio: 6.0, stock: 15, codigo: 'PAP-003', disponible: true },
      { producto: 'Marcador permanente negro', marca: 'Sharpie', categoria: 'Marcadores', precio: 2.2, stock: 0, codigo: 'PAP-004', disponible: false },
      { producto: 'Calculadora científica', marca: 'Casio', categoria: 'Electrónica', precio: 25.0, stock: 8, codigo: 'PAP-005', disponible: true },
    ],
  },
  vehiculos: {
    resource: 'autos',
    fields: [
      { key: 'marca', type: 'string', label: 'Marca' },
      { key: 'modelo', type: 'string', label: 'Modelo' },
      { key: 'anio', type: 'int', label: 'Año' },
      { key: 'precio', type: 'double', label: 'Precio' },
      { key: 'kilometraje', type: 'int', label: 'Kilometraje' },
      { key: 'placa', type: 'string', label: 'Placa' },
      { key: 'disponible', type: 'bool', label: 'Disponible' },
    ],
    seeds: [
      { marca: 'Toyota', modelo: 'Corolla', anio: 2022, precio: 22000.0, kilometraje: 15000, placa: 'PBA-1234', disponible: true },
      { marca: 'Chevrolet', modelo: 'Sail', anio: 2019, precio: 12500.0, kilometraje: 48000, placa: 'PCD-5566', disponible: true },
      { marca: 'Kia', modelo: 'Sportage', anio: 2023, precio: 28500.0, kilometraje: 5000, placa: 'PEF-7788', disponible: true },
      { marca: 'Hyundai', modelo: 'Tucson', anio: 2020, precio: 19500.0, kilometraje: 32000, placa: 'PGH-9900', disponible: false },
      { marca: 'Nissan', modelo: 'Versa', anio: 2021, precio: 15800.0, kilometraje: 21000, placa: 'PIJ-2211', disponible: true },
    ],
  },
  restaurante: {
    resource: 'platos',
    fields: [
      { key: 'plato', type: 'string', label: 'Plato' },
      { key: 'categoria', type: 'string', label: 'Categoría' },
      { key: 'precio', type: 'double', label: 'Precio' },
      { key: 'tiempoPreparacion', type: 'int', label: 'Tiempo de preparación (min)' },
      { key: 'ingredientePrincipal', type: 'string', label: 'Ingrediente principal' },
      { key: 'destacado', type: 'bool', label: 'Destacado' },
      { key: 'disponible', type: 'bool', label: 'Disponible' },
    ],
    seeds: [
      { plato: 'Seco de pollo', categoria: 'Plato fuerte', precio: 6.5, tiempoPreparacion: 25, ingredientePrincipal: 'Pollo', destacado: true, disponible: true },
      { plato: 'Ceviche de camarón', categoria: 'Entrada', precio: 8.0, tiempoPreparacion: 15, ingredientePrincipal: 'Camarón', destacado: true, disponible: true },
      { plato: 'Ensalada César', categoria: 'Entrada', precio: 4.5, tiempoPreparacion: 10, ingredientePrincipal: 'Lechuga', destacado: false, disponible: true },
      { plato: 'Lomo saltado', categoria: 'Plato fuerte', precio: 7.5, tiempoPreparacion: 20, ingredientePrincipal: 'Res', destacado: false, disponible: false },
      { plato: 'Torta de chocolate', categoria: 'Postre', precio: 3.5, tiempoPreparacion: 5, ingredientePrincipal: 'Chocolate', destacado: true, disponible: true },
    ],
  },
  mascotas: {
    resource: 'mascotas',
    fields: [
      { key: 'nombre', type: 'string', label: 'Nombre' },
      { key: 'especie', type: 'string', label: 'Especie' },
      { key: 'raza', type: 'string', label: 'Raza' },
      { key: 'edad', type: 'int', label: 'Edad (años)' },
      { key: 'peso', type: 'double', label: 'Peso (kg)' },
      { key: 'codigo', type: 'string', label: 'Código' },
      { key: 'disponible', type: 'bool', label: 'Disponible para adopción' },
    ],
    seeds: [
      { nombre: 'Firulais', especie: 'Perro', raza: 'Mestizo', edad: 2, peso: 14.5, codigo: 'MAS-001', disponible: true },
      { nombre: 'Michi', especie: 'Gato', raza: 'Siamés', edad: 1, peso: 3.2, codigo: 'MAS-002', disponible: true },
      { nombre: 'Rocky', especie: 'Perro', raza: 'Pastor Alemán', edad: 4, peso: 28.0, codigo: 'MAS-003', disponible: false },
      { nombre: 'Nube', especie: 'Gato', raza: 'Mestizo', edad: 3, peso: 4.1, codigo: 'MAS-004', disponible: true },
      { nombre: 'Toby', especie: 'Perro', raza: 'Beagle', edad: 5, peso: 12.0, codigo: 'MAS-005', disponible: false },
    ],
  },
};

export const GENERIC_VARIANT: VariantConfig = {
  resource: 'items',
  fields: [
    { key: 'nombre', type: 'string', label: 'Nombre' },
    { key: 'descripcion', type: 'string', label: 'Descripción' },
    { key: 'categoria', type: 'string', label: 'Categoría' },
    { key: 'precio', type: 'double', label: 'Precio' },
    { key: 'cantidad', type: 'int', label: 'Cantidad' },
    { key: 'codigo', type: 'string', label: 'Código' },
    { key: 'activo', type: 'bool', label: 'Activo' },
  ],
  seeds: [
    { nombre: 'Ítem de ejemplo 1', descripcion: 'Demo', categoria: 'General', precio: 10, cantidad: 5, codigo: 'ITM-001', activo: true },
    { nombre: 'Ítem de ejemplo 2', descripcion: 'Demo', categoria: 'General', precio: 20, cantidad: 3, codigo: 'ITM-002', activo: true },
    { nombre: 'Ítem de ejemplo 3', descripcion: 'Demo', categoria: 'General', precio: 15, cantidad: 0, codigo: 'ITM-003', activo: false },
    { nombre: 'Ítem de ejemplo 4', descripcion: 'Demo', categoria: 'General', precio: 8, cantidad: 10, codigo: 'ITM-004', activo: true },
    { nombre: 'Ítem de ejemplo 5', descripcion: 'Demo', categoria: 'General', precio: 30, cantidad: 1, codigo: 'ITM-005', activo: false },
  ],
};

export function getVariantConfig(type: string): VariantConfig {
  return PRACTICE_VARIANTS[type] ?? GENERIC_VARIANT;
}
