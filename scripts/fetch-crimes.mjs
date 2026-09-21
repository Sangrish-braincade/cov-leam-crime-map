// Keep data/crimes/ in step with police.uk.
//
// police.uk publishes once a month, ~7-8 weeks after the month ends, and only
// serves the latest 36 months. This script:
//   - fetches any month police.uk has that data/crimes/ doesn't,
//   - when a new month lands, re-fetches the previous REFRESH months too, because
//     police.uk updates outcomes ("Under investigation" -> a result) on older crimes,
//   - never deletes a month, so git keeps history past the 36-month window.
//
//   node scripts/fetch-crimes.mjs              # normal run (the daily GitHub Action)
//   node scripts/fetch-crimes.mjs --from-raw   # one-off: convert data/raw/crimes/*.json dumps
//
// Prints NEW_MONTH=<yyyy-mm> when something changed so the workflow can commit.
import { existsSync, mkdirSync, readdirSync, readFileSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { availableMonths, compactRow, fetchMonth, writeMonth } from "./lib/police.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "crimes");
const REFRESH = 3;

mkdirSync(OUT, { recursive: true });
const have = new Set(readdirSync(OUT).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, 7)));

if (process.argv.includes("--from-raw")) {
  const rawDir = join(ROOT, "data", "raw", "crimes");
  for (const f of readdirSync(rawDir).filter((f) => f.endsWith(".json")).sort()) {
    const raw = JSON.parse(readFileSync(join(rawDir, f), "utf8"));
    writeMonth(join(OUT, f), raw.month, raw.crimes.map(compactRow));
    console.log(`${raw.month}: ${raw.crimes.length} crimes`);
  }
  process.exit(0);
}

const months = await availableMonths();
const missing = months.filter((m) => !have.has(m));
if (missing.length === 0) {
  console.log(`up to date — latest police.uk month is ${months.at(-1)}`);
  process.exit(0);
}

const refresh = months.filter((m) => have.has(m)).slice(-REFRESH);
for (const month of [...missing, ...refresh]) {
  const crimes = await fetchMonth(month);
  writeMonth(join(OUT, `${month}.json`), month, crimes.map(compactRow));
  console.log(`${month}: ${crimes.length} crimes${have.has(month) ? " (refreshed)" : " (new)"}`);
}

const latest = missing.at(-1);
console.log(`NEW_MONTH=${latest}`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `new_month=${latest}\n`);
if (!existsSync(join(OUT, `${latest}.json`))) process.exit(1);
