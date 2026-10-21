#!/usr/bin/env node
// Poarta de la „gata”: hook Stop care nu lasă tura să se încheie dacă s-a modificat cod
// și nu s-a rulat nicio verificare după ultima modificare.
// Regula de aur: nu aruncă niciodată, iese mereu cu 0. O eroare aici nu blochează lucrul.
// Oprire: LEAN_POWERS_GATE=off.

import { readFileSync } from 'node:fs';
import { extname, basename } from 'node:path';

const CODE_EXT = new Set([
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx', '.vue', '.svelte', '.astro',
  '.py', '.rb', '.php', '.go', '.rs', '.java', '.kt', '.kts', '.swift', '.scala', '.dart',
  '.c', '.h', '.cc', '.cpp', '.hpp', '.cs', '.m', '.mm',
  '.sh', '.bash', '.zsh', '.ps1', '.sql', '.lua', '.ex', '.exs', '.ipynb',
]);

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

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

function isTurnStart(e) {
  if (e.type !== 'user' || e.isSidechain || e.isMeta) return false;
  const c = e.message?.content;
  if (typeof c === 'string') return true;
  return Array.isArray(c) && c.some((b) => b?.type === 'text') && !c.some((b) => b?.type === 'tool_result');
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

  let step = 0;
  let lastEdit = -1;
  let lastVerify = -1;
  const files = new Set();

  for (const e of entries.slice(start)) {
    if (e.type !== 'assistant' || e.isSidechain || !Array.isArray(e.message?.content)) continue;
    for (const b of e.message.content) {
      if (b?.type !== 'tool_use') continue;
      step++;
      const path = b.input?.file_path ?? b.input?.notebook_path;
      if (EDIT_TOOLS.has(b.name) && path && CODE_EXT.has(extname(path).toLowerCase())) {
        lastEdit = step;
        files.add(basename(path));
      } else if (b.name === 'Bash' && isVerify(b.input?.command)) {
        lastVerify = step;
      }
    }
  }

  if (lastEdit === -1 || lastVerify > lastEdit) return;

  const list = [...files].slice(0, 5).join(', ') + (files.size > 5 ? ` și încă ${files.size - 5}` : '');
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
