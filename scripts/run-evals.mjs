// Runs the chatbot regression cases in evals/cases.jsonl and compares with the previous run.
// Usage: node scripts/run-evals.mjs                  (calls evals.url from harness.config.json)
//        node scripts/run-evals.mjs --saved FILE     (checks saved replies, no server needed)
// Results go to .harness/evals/, so evals/ keeps only human-reviewed criteria. Exit 1 if any case fails.
import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../.claude/hooks/lib.mjs";

const root = process.cwd();
const e = { cases: "evals/cases.jsonl", body: { message: "{{input}}", userId: "{{userId}}" }, replyPath: "reply", ...(loadConfig(root).evals || {}) };
const argv = process.argv.slice(2);
const savedFile = argv.includes("--saved") ? argv[argv.indexOf("--saved") + 1] : null;
const readJsonl = (f) => fs.readFileSync(path.join(root, f), "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
const cases = readJsonl(e.cases);
const saved = savedFile ? Object.fromEntries(readJsonl(savedFile).map((x) => [x.id, x.reply])) : null;

const fill = (v, c) => typeof v === "string" ? v.replace("{{input}}", c.input).replace("{{userId}}", c.userId || "") : Array.isArray(v) ? v.map((x) => fill(x, c)) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x, c)])) : v;
const pick = (obj, p) => p.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);

async function reply(c) {
  if (saved) return saved[c.id] ?? null;
  const res = await fetch(e.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(fill(e.body, c)) });
  const text = await res.text();
  try { return String(pick(JSON.parse(text), e.replyPath) ?? text); } catch { return text; }
}

const rows = [];
for (const c of cases) {
  let out = null, error = null;
  try { out = await reply(c); } catch (err) { error = err.message; }
  const miss = (c.mustMatch || []).filter((re) => out == null || !new RegExp(re, "i").test(out));
  const bad = (c.mustNotMatch || []).filter((re) => out != null && new RegExp(re, "i").test(out));
  const status = error || out == null ? "미실행" : miss.length || bad.length ? "실패" : "통과";
  rows.push({ id: c.id, type: c.type, status, reason: error || [...miss.map((m) => "없음:" + m), ...bad.map((b) => "금지:" + b)].join(", "), reply: out });
}

const dir = path.join(root, ".harness", "evals");
fs.mkdirSync(dir, { recursive: true });
const prevName = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort().pop();
const prev = prevName ? Object.fromEntries(JSON.parse(fs.readFileSync(path.join(dir, prevName), "utf8")).map((x) => [x.id, x.status])) : {};
fs.writeFileSync(path.join(dir, new Date().toISOString().replace(/[:.]/g, "-") + ".json"), JSON.stringify(rows, null, 2));

for (const x of rows) {
  const change = prev[x.id] && prev[x.id] !== x.status ? "  (이전: " + prev[x.id] + ")" : "";
  console.log([x.id.padEnd(5), x.type.padEnd(6), x.status, x.reason].filter(Boolean).join("  ") + change);
}
const count = (s) => rows.filter((x) => x.status === s).length;
console.log("\n통과 " + count("통과") + " · 실패 " + count("실패") + " · 미실행 " + count("미실행") + " / " + rows.length);
process.exit(count("실패") || count("미실행") ? 1 : 0);
