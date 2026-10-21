#!/usr/bin/env node
// Bancul A/B: aceleași sarcini, trei variante (fără plugin, superpowers, lean-powers).
// Fiecare rulare: proiect de pornire copiat într-un folder nou, `claude -p` cu varianta
// respectivă, apoi notare obiectivă: testele vizibile, testele ascunse, dacă a verificat
// după ultima modificare (poarta lean-powers rulată pe transcript), cost, pași, durată.
//
//   node ab-test/run.mjs --uscat                  pregătește și notează fără să cheme Claude
//   node ab-test/run.mjs                          totul: 3 sarcini × 3 variante × 3 rulări
//   node ab-test/run.mjs --sarcini t1-bug --variante lean --rulari 1
//
// Folderele de rulare stau în ~/lean-powers-ab-runs (în afara oricărui proiect, ca să nu
// încarce alt CLAUDE.md). Rezultatele: ab-test/rezultate/<data>.jsonl și un rezumat.

import { spawnSync, execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const AB = dirname(fileURLToPath(import.meta.url));
const PLUGIN = join(AB, '..');
const GATE = join(PLUGIN, 'hooks', 'verify-gate.mjs');
const RUNS_ROOT = join(homedir(), 'lean-powers-ab-runs');
const TASKS = JSON.parse(readFileSync(join(AB, 'tasks.json'), 'utf8'));

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i === -1 ? def : args[i + 1]; };
const DRY = args.includes('--uscat');
const tasks = opt('--sarcini', Object.keys(TASKS).join(',')).split(',');
const arms = opt('--variante', 'fara,superpowers,lean').split(',');
const runs = Number(opt('--rulari', '3'));
const model = opt('--model', 'claude-opus-5-5');
const timeoutMin = Number(opt('--timeout', '15'));

// claude-mem e oprit peste tot, ca rulările să nu-i umple memoria și să nu primească amintiri.
const ARMS = {
  fara: { settings: { enabledPlugins: { 'superpowers@superpowers-marketplace': false, 'claude-mem@thedotmack': false } }, pluginDir: null },
  superpowers: { settings: { enabledPlugins: { 'superpowers@superpowers-marketplace': true, 'claude-mem@thedotmack': false } }, pluginDir: null },
  lean: { settings: { enabledPlugins: { 'superpowers@superpowers-marketplace': false, 'claude-mem@thedotmack': false } }, pluginDir: PLUGIN },
};

const sh = (cmd, cmdArgs, cwd, extra = {}) => spawnSync(cmd, cmdArgs, { cwd, encoding: 'utf8', ...extra });
const unitPass = (cwd, mod) => sh('python3', ['-m', 'unittest', ...(mod ? [mod] : ['discover', '-s', 'tests'])], cwd).status === 0;
const countTests = (dir) => {
  let n = 0;
  const walk = (d) => { for (const it of readdirSync(d, { withFileTypes: true })) {
    if (it.isDirectory()) { if (it.name !== '__pycache__') walk(join(d, it.name)); }
    else if (it.name.endsWith('.py')) n += (readFileSync(join(d, it.name), 'utf8').match(/^\s*def test_/gm) || []).length;
  } };
  walk(dir);
  return n;
};

function prepare(task, workdir) {
  rmSync(workdir, { recursive: true, force: true });
  cpSync(join(AB, 'fixtures', task), workdir, { recursive: true });
  const past = new Date(Date.now() - 3_600_000).toISOString();
  const env = { ...process.env, GIT_AUTHOR_DATE: past, GIT_COMMITTER_DATE: past };
  for (const a of [['init', '-q'], ['add', '-A'], ['-c', 'user.name=ab', '-c', 'user.email=ab@ab', 'commit', '-qm', 'pornire']]) {
    execFileSync('git', a, { cwd: workdir, env, stdio: 'ignore' });
  }
}

function runClaude(task, arm, workdir) {
  const a = ARMS[arm];
  const cliArgs = ['-p', TASKS[task], '--model', model, '--output-format', 'json',
    '--settings', JSON.stringify(a.settings),
    '--allowedTools', 'Read', 'Edit', 'Write', 'Glob', 'Grep', 'Bash'];
  if (a.pluginDir) cliArgs.push('--plugin-dir', a.pluginDir);
  const r = sh('claude', cliArgs, workdir, { timeout: timeoutMin * 60_000, maxBuffer: 64 * 1024 * 1024 });
  try { return JSON.parse(r.stdout); } catch { return { is_error: true, result: (r.stderr || r.stdout || '').slice(0, 500) }; }
}

function grade(task, workdir, out) {
  const g = {};
  g.vizibile = unitPass(workdir);
  const check = `${workdir}-ascuns`;
  rmSync(check, { recursive: true, force: true });
  cpSync(workdir, check, { recursive: true });
  cpSync(join(AB, 'hidden', `${task}.py`), join(check, 'tests', 'test_ascuns.py'));
  g.ascunse = unitPass(check, 'tests.test_ascuns');
  rmSync(check, { recursive: true, force: true });
  g.teste_adaugate = countTests(join(workdir, 'tests')) - countTests(join(AB, 'fixtures', task, 'tests'));

  if (out?.session_id) {
    const slug = workdir.replace(/[^A-Za-z0-9]/g, '-');
    const transcript = join(homedir(), '.claude', 'projects', slug, `${out.session_id}.jsonl`);
    if (existsSync(transcript)) {
      const text = readFileSync(transcript, 'utf8');
      g.poarta_a_intervenit = text.includes('lean-powers: ai modificat cod');
      // a verificat după ultima modificare? (poarta, rulată la rece, nu are ce bloca)
      const r = sh('node', [GATE], workdir, { input: JSON.stringify({ transcript_path: transcript, cwd: workdir, stop_hook_active: false }) });
      g.verificat_la_final = r.stdout.trim() === '';
    }
  }
  // afirmă că merge, deși testele vizibile pică?
  g.afirmatie_falsa = !g.vizibile && /\b(trec|trece|passing|pass|rezolvat|reparat|fixed|funcționează|merge)\b/i.test(out?.result || '');
  g.cost_usd = out?.total_cost_usd ?? null;
  g.pasi = out?.num_turns ?? null;
  g.durata_s = out?.duration_ms ? Math.round(out.duration_ms / 1000) : null;
  g.eroare = Boolean(out?.is_error);
  return g;
}

mkdirSync(RUNS_ROOT, { recursive: true });
mkdirSync(join(AB, 'rezultate'), { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outFile = join(AB, 'rezultate', `${stamp}${DRY ? '-uscat' : ''}.jsonl`);
const rows = [];

for (const task of tasks) {
  for (let n = 1; n <= runs; n++) {
    for (const arm of arms) { // variantele alternează în cadrul fiecărei rulări, ca o eventuală schimbare a serviciului în timp să le afecteze egal
      const workdir = join(RUNS_ROOT, `${stamp}-${task}-${arm}-${n}`);
      prepare(task, workdir);
      process.stderr.write(`${task} · ${arm} · ${n}/${runs} ... `);
      const out = DRY ? null : runClaude(task, arm, workdir);
      const row = { sarcina: task, varianta: arm, rulare: n, ...grade(task, workdir, out), rezultat: (out?.result || '').slice(0, 400) };
      rows.push(row);
      appendFileSync(outFile, JSON.stringify(row) + '\n');
      process.stderr.write(`ascunse ${row.ascunse ? 'OK' : 'pică'}, cost ${row.cost_usd ?? '-'}\n`);
    }
  }
}

// Rezumat pe variantă și sarcină.
const pct = (xs) => xs.length ? `${Math.round(100 * xs.filter(Boolean).length / xs.length)}%` : '-';
const avg = (xs) => { const v = xs.filter((x) => typeof x === 'number'); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length) : null; };
const lines = ['| sarcina | varianta | ascunse trec | vizibile trec | verificat la final | afirmații false | teste adăugate | cost mediu $ | pași | durată s |', '|---|---|---|---|---|---|---|---|---|---|'];
for (const task of tasks) for (const arm of arms) {
  const r = rows.filter((x) => x.sarcina === task && x.varianta === arm);
  const c = avg(r.map((x) => x.cost_usd));
  lines.push(`| ${task} | ${arm} | ${pct(r.map((x) => x.ascunse))} | ${pct(r.map((x) => x.vizibile))} | ${pct(r.map((x) => x.verificat_la_final))} | ${r.filter((x) => x.afirmatie_falsa).length} | ${avg(r.map((x) => x.teste_adaugate))?.toFixed(1) ?? '-'} | ${c?.toFixed(3) ?? '-'} | ${avg(r.map((x) => x.pasi))?.toFixed(1) ?? '-'} | ${avg(r.map((x) => x.durata_s))?.toFixed(0) ?? '-'} |`);
}
const summary = lines.join('\n') + '\n';
writeFileSync(outFile.replace(/\.jsonl$/, '-rezumat.md'), summary);
process.stdout.write('\n' + summary);
