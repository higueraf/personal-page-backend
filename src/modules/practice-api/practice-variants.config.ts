/**
 * Configuración de las variantes de la "API de práctica".
 *
 * Cada variante tiene su propio segmento de URL (`/practice-api/<key>/items`)
 * y su propio conjunto de campos (mínimo 7, con nombres distintos entre sí),
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
  fields: VariantField[];
  seeds: Record<string, any>[];
}

export const PRACTICE_VARIANTS: Record<string, VariantConfig> = {
  ropa: {
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
};

export const GENERIC_VARIANT: VariantConfig = {
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
