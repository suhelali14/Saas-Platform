import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import "dotenv/config";
import { parseIntent } from "./intent-service.js";

// Golden eval set (docs/04-multi-agent-design.md "Evaluation loop"): run
// this before shipping a prompt or model change to intent-service.ts. Needs
// ANTHROPIC_API_KEY set to actually exercise the LLM path -- without one it
// runs (and should pass less well) against the heuristic fallback, which is
// itself a useful baseline to compare against.
const __dirname = dirname(fileURLToPath(import.meta.url));

interface FixtureCase {
  rawText: string;
  expectedCategory: string | null;
  expectedBudgetMax: number | null;
}

const fixtures: FixtureCase[] = JSON.parse(
  readFileSync(join(__dirname, "__fixtures__", "intent-eval-set.json"), "utf-8"),
);

async function main() {
  let pass = 0;

  for (const fixture of fixtures) {
    const { parsed, source } = await parseIntent({ turns: [{ role: "user", content: fixture.rawText }] });
    const categoryOk = parsed.category === fixture.expectedCategory;
    const budgetOk =
      fixture.expectedBudgetMax === null || parsed.budgetMax === fixture.expectedBudgetMax;
    const ok = categoryOk && budgetOk;
    if (ok) pass++;

    const status = ok ? "PASS" : "FAIL";
    console.log(
      `[${status}] (${source}) "${fixture.rawText}" -> category=${parsed.category} budgetMax=${parsed.budgetMax}` +
        (ok ? "" : ` (expected category=${fixture.expectedCategory} budgetMax=${fixture.expectedBudgetMax})`),
    );
  }

  console.log(`\n${pass}/${fixtures.length} passed.`);
  if (pass < fixtures.length) {
    process.exitCode = 1;
  }
}

main();
