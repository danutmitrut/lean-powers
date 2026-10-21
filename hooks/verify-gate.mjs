#!/usr/bin/env node
// Poarta de la „gata”: hook Stop care nu lasă tura să se încheie dacă s-a modificat cod
// și nu s-a rulat nicio verificare după ultima modificare.
//
// Modificările se află din două surse, ca una să o acopere pe cealaltă:
//   1. transcriptul: editările făcute cu Edit, Write, MultiEdit, NotebookEdit;
//   2. discul: fișierele de cod din proiect modificate de la începutul turei, oricum ar fi
//      fost modificate (editor, sed, script, subagent). Cu git: fișierele schimbate, cele noi
//      și cele comise în timpul turei. Fără git: o scanare limitată a folderului.
// Verificările se citesc doar din tura agentului principal: ce a rulat un subagent nu
// se vede, deci agentul principal verifică el încă o dată.
//
// Regula de aur: nu aruncă niciodată, iese mereu cu 0. O eroare aici nu blochează lucrul.
// Oprire: LEAN_POWERS_GATE=off.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { extname, basename, join } from 'node:path';

const CODE_EXT = new Set([
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx', '.vue', '.svelte', '.astro',
  '.py', '.rb', '.php', '.go', '.rs', '.java', '.kt', '.kts', '.swift', '.scala', '.dart',
  '.c', '.h', '.cc', '.cpp', '.hpp', '.cs', '.m', '.mm',
  '.sh', '.bash', '.zsh', '.ps1', '.sql', '.lua', '.ex', '.exs', '.ipynb',
]);

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

// Folderele sărite la scanarea fără git.
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt', '.svelte-kit', '.astro',
  '.venv', 'venv', '__pycache__', 'target', 'vendor', 'coverage', '.cache', '.turbo', 'Pods',
]);
const SCAN_LIMIT = 5000;

// O comandă Bash contează ca verificare dacă rulează teste, build, type-check, linter
// sau execută direct un script.
const VERIFY = [
  /\b(npm|pnpm|yarn|bun)\s+(run\s+)?(test|build|lint|check|typecheck|type-check|e2e)\b/,
  /\b(vitest|jest|mocha|ava|playwright|cypress|pytest|unittest|tox|nox|phpunit|rspec|minitest)\b/,
  /\b(tsc|eslint|biome|ruff|mypy|pyright|flake8|pylint|shellcheck|svelte-check|astro\s+check)\b/,
  /\b(cargo|go|swift|dotnet|deno|bun|zig)\s+(test|build|check|vet|run)\b/,
  /\b(gradlew?|mvn|xcodebuild|make|cmake|ctest)\b/,
  /\bpython3?\s+(-[IBOu]+\s+)*(-m\s+\w+|[^\s|;&]+\.py)\b/,
  /\bnode\s+(--test\b|--check\b|[^\s|;&]+\.(m?js|cjs|ts))/,
  /\b(bash|sh|zsh)\s+(-n\s+)?[^\s|;&]+\.(sh|bash|zsh)\b/,
  /(^|[;&|(]\s*)\.\/[\w./-]+/,
  /\bcurl\b[^|;&]*\b(localhost|127\.0\.0\.1|0\.0\.0\.0)\b/,
];

const isVerify = (cmd) => typeof cmd === 'string' && VERIFY.some((re) => re.test(cmd));
const isCode = (path) => CODE_EXT.has(extname(path).toLowerCase());

function isTurnStart(e) {
  if (e.type !== 'user' || e.isSidechain || e.isMeta) return false;
  const c = e.message?.content;
  if (typeof c === 'string') return true;
  return Array.isArray(c) && c.some((b) => b?.type === 'text') && !c.some((b) => b?.type === 'tool_result');
}

// Fișierele de cod modificate pe disc după `since` (ms), cu ora modificării.
function diskChanges(cwd, since) {
  const changed = new Map();
  const note = (abs, t) => { if (isCode(abs) && t > since) changed.set(abs, Math.max(t, changed.get(abs) ?? 0)); };
  const mtime = (abs) => { try { return statSync(abs).mtimeMs; } catch { return -1; } };
  const git = (...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 });

  let root = null;
  try { root = git('rev-parse', '--show-toplevel').trim(); } catch { /* nu e repo git */ }

  if (root) {
    // schimbate și necomise, plus cele noi neignorate
    const pending = git('ls-files', '-z', '--modified', '--others', '--exclude-standard', '--full-name', ':/').split('\0').filter(Boolean);
    for (const rel of pending) { const abs = join(root, rel); note(abs, mtime(abs)); }
    // comise în timpul turei: ora fișierului, ca un commit făcut după verificare să nu conteze
    // drept modificare; ora commit-ului doar pentru fișierele care nu mai există pe disc
    const log = git('log', `--since=${Math.floor(since / 1000)}`, '--format=@%ct', '--name-only');
    let commitTime = 0;
    for (const line of log.split('\n')) {
      if (line.startsWith('@')) { commitTime = Number(line.slice(1)) * 1000; continue; }
      if (!line.trim()) continue;
      const abs = join(root, line.trim());
      const t = mtime(abs);
      note(abs, t >= 0 ? t : Math.max(commitTime, since + 1));
    }
    return changed;
  }

  let seen = 0;
  const walk = (dir) => {
    let items;
    try { items = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const it of items) {
      if (seen >= SCAN_LIMIT) return;
      const abs = join(dir, it.name);
      if (it.isDirectory()) { if (!SKIP_DIRS.has(it.name) && !it.name.startsWith('.')) walk(abs); }
      else if (it.isFile()) { seen++; if (isCode(abs)) note(abs, mtime(abs)); }
    }
  };
  walk(cwd);
  return changed;
}

function main() {
  if (process.env.LEAN_POWERS_GATE === 'off') return;
  const input = JSON.parse(readFileSync(0, 'utf8'));
  if (input.stop_hook_active) return;
  if (!input.transcript_path) return;

  const entries = readFileSync(input.transcript_path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);

  let start = 0;
  entries.forEach((e, i) => { if (isTurnStart(e)) start = i; });
  const turn = entries.slice(start);

  // Ora fiecărei intrări; unde lipsește, o deducem din ordine, ca ordinea să rămână corectă.
  let clock = 0;
  const times = turn.map((e) => { const t = Date.parse(e.timestamp); clock = Number.isNaN(t) ? clock + 1 : Math.max(t, clock); return clock; });

  // Când s-a terminat fiecare apel de unealtă (rezultatul lui).
  const doneAt = new Map();
  turn.forEach((e, i) => {
    if (e.type !== 'user' || !Array.isArray(e.message?.content)) return;
    for (const b of e.message.content) if (b?.type === 'tool_result') doneAt.set(b.tool_use_id, times[i]);
  });

  const changes = new Map(); // fișier -> ora ultimei modificări
  let lastVerify = -Infinity;

  turn.forEach((e, i) => {
    if (e.type !== 'assistant' || e.isSidechain || !Array.isArray(e.message?.content)) return;
    for (const b of e.message.content) {
      if (b?.type !== 'tool_use') continue;
      const at = doneAt.get(b.id) ?? times[i];
      const path = b.input?.file_path ?? b.input?.notebook_path;
      if (EDIT_TOOLS.has(b.name) && path && isCode(path)) {
        changes.set(path, Math.max(at, changes.get(path) ?? -Infinity));
      } else if (b.name === 'Bash' && isVerify(b.input?.command)) {
        lastVerify = Math.max(lastVerify, at);
      }
    }
  });

  const turnStart = Date.parse(turn[0]?.timestamp);
  if (!Number.isNaN(turnStart)) {
    for (const [path, t] of diskChanges(input.cwd || process.cwd(), turnStart)) {
      changes.set(path, Math.max(t, changes.get(path) ?? -Infinity));
    }
  }

  const unverified = [...changes].filter(([, t]) => t > lastVerify).map(([p]) => basename(p));
  if (unverified.length === 0) return;

  const files = [...new Set(unverified)];
  const list = files.slice(0, 5).join(', ') + (files.length > 5 ? ` și încă ${files.length - 5}` : '');
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason:
      `lean-powers: ai modificat cod (${list}) și nu ai rulat nicio verificare după ultima modificare. ` +
      'Rulează testul, build-ul sau scriptul care dovedește că merge și raportează rezultatul. ' +
      'Dacă nu există nicio verificare posibilă, spune explicit ce n-ai putut verifica și de ce.',
  }));
}

try { main(); } catch { /* nu blocăm niciodată din cauza unei erori proprii */ }
process.exit(0);
