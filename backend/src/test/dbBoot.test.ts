import { db } from "../db/index.js";
import { runMigrations } from "../db/migrations.js";

function testDbBoot(): void {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all() as { name: string }[];

  const names = tables.map((t) => t.name);
  const required = ["users", "bets", "crash_rounds", "tournament_weeks"];

  for (const table of required) {
    if (!names.includes(table)) {
      throw new Error(`Missing table: ${table}`);
    }
  }

  runMigrations();
  console.log("✅ Database boot test passed");
  console.log(`   Tables: ${names.length}`);
}

testDbBoot();
