import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { PracticeItem } from '../entities/practice-item.entity';
import { sanitizeData } from '../modules/practice-api/practice-api.service';
import { PRACTICE_VARIANTS } from '../modules/practice-api/practice-variants.config';

/**
 * Corrige en la BD los registros de `practice_items` ya guardados con tipos
 * incorrectos o campos ajenos (ej. `color: false`, `stok`, `catgeoria`) desde
 * antes de que `practice-api.service.ts` empezara a sanear el body de
 * entrada. Reutiliza `sanitizeData` para que el resultado sea idéntico al que
 * produciría hoy la API para cada variante.
 *
 * Uso:
 *   DB_HOST=... DB_PORT=... DB_USER=... DB_PASS=... DB_NAME=... \
 *     npx ts-node -r tsconfig-paths/register src/scripts/sanitize-practice-items.ts [--dry-run]
 */
async function run() {
  const dryRun = process.argv.includes('--dry-run');

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    entities: [PracticeItem],
  });

  await dataSource.initialize();
  const repo = dataSource.getRepository(PracticeItem);
  const items = await repo.find();

  // Solo se sanean tipos con schema conocido en PRACTICE_VARIANTS. Un `type`
  // que no exista ahí (ej. typo de variante, o una variante vieja renombrada)
  // se reporta pero NO se toca, para no reclasificar datos reales bajo un
  // schema equivocado (getVariantConfig cae a GENERIC_VARIANT en ese caso,
  // lo cual borraría campos que no pertenecen al genérico).
  let changed = 0;
  const skippedTypes = new Map<string, number>();
  for (const item of items) {
    if (!PRACTICE_VARIANTS[item.type]) {
      skippedTypes.set(item.type, (skippedTypes.get(item.type) ?? 0) + 1);
      continue;
    }
    const sanitized = sanitizeData(item.type, item.data ?? {});
    const before = JSON.stringify(item.data ?? {});
    const after = JSON.stringify(sanitized);
    if (before !== after) {
      changed++;
      console.log(`[${item.type}] ${item.id}`);
      console.log(`  antes:  ${before}`);
      console.log(`  después: ${after}`);
      if (!dryRun) {
        item.data = sanitized;
        await repo.save(item);
      }
    }
  }

  console.log(
    `\n${dryRun ? '[DRY RUN] ' : ''}Total registros: ${items.length}. Corregidos: ${changed}.`,
  );
  if (skippedTypes.size) {
    console.log('\nTipos NO reconocidos (omitidos, requieren revisión manual):');
    for (const [type, count] of skippedTypes) console.log(`  - "${type}": ${count} registro(s)`);
  }
  await dataSource.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
