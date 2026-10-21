import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GATE = join(dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'verify-gate.mjs');

// Construiește un transcript JSONL în formatul Claude Code.
const userText = (text) => ({ type: 'user', isSidechain: false, message: { role: 'user', content: text } });
const toolUse = (name, input) => ({
  type: 'assistant', isSidechain: false,
  message: { role: 'assistant', content: [{ type: 'tool_use', id: 'x', name, input }] },
});
const toolResult = () => ({
  type: 'user', isSidechain: false,
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: 'ok' }] },
});
const edit = (file) => toolUse('Edit', { file_path: file, old_string: 'a', new_string: 'b' });
const bash = (command) => toolUse('Bash', { command });

function run(entries, extra = {}, env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'lean-powers-'));
  const transcript = join(dir, 't.jsonl');
  writeFileSync(transcript, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
  const input = JSON.stringify({ hook_event_name: 'Stop', transcript_path: transcript, stop_hook_active: false, ...extra });
  const r = spawnSync('node', [GATE], { input, encoding: 'utf8', env: { ...process.env, ...env } });
  assert.equal(r.status, 0, `hook-ul trebuie să iasă mereu cu 0, stderr: ${r.stderr}`);
  return r.stdout.trim() ? JSON.parse(r.stdout) : null;
}

test('blochează când s-a editat cod și nu s-a rulat nicio verificare', () => {
  const out = run([userText('repară'), edit('/p/app.ts'), toolResult()]);
  assert.equal(out?.decision, 'block');
  assert.match(out.reason, /app\.ts/);
});

test('lasă să treacă după un test rulat după ultima editare', () => {
  const out = run([userText('repară'), edit('/p/app.ts'), toolResult(), bash('npm test'), toolResult()]);
  assert.equal(out, null);
});

test('blochează dacă testul a fost rulat înainte de ultima editare', () => {
  const out = run([userText('repară'), bash('pytest -q'), toolResult(), edit('/p/app.py'), toolResult()]);
  assert.equal(out?.decision, 'block');
});

test('nu blochează la fișiere care nu sunt cod', () => {
  const out = run([userText('scrie'), edit('/p/README.md'), toolResult(), toolUse('Write', { file_path: '/p/date.json', content: '{}' }), toolResult()]);
  assert.equal(out, null);
});

test('se uită doar la tura curentă', () => {
  const out = run([userText('a'), edit('/p/app.ts'), toolResult(), userText('b'), bash('ls'), toolResult()]);
  assert.equal(out, null);
});

test('nu blochează a doua oară (stop_hook_active)', () => {
  const out = run([userText('repară'), edit('/p/app.ts'), toolResult()], { stop_hook_active: true });
  assert.equal(out, null);
});

test('se poate opri cu LEAN_POWERS_GATE=off', () => {
  const out = run([userText('repară'), edit('/p/app.ts'), toolResult()], {}, { LEAN_POWERS_GATE: 'off' });
  assert.equal(out, null);
});

test('recunoaște rularea scriptului editat ca verificare', () => {
  for (const cmd of ['python3 tool.py', 'node server.mjs', 'bash deploy.sh', './run.sh', 'cargo test', 'npx tsc --noEmit', 'npm run build']) {
    const out = run([userText('x'), edit('/p/tool.py'), toolResult(), bash(cmd), toolResult()]);
    assert.equal(out, null, `comanda „${cmd}” trebuia să conteze ca verificare`);
  }
});

test('comenzile care nu verifică nimic nu contează', () => {
  for (const cmd of ['ls -la', 'git status', 'cat app.ts', 'grep -r foo .']) {
    const out = run([userText('x'), edit('/p/app.ts'), toolResult(), bash(cmd), toolResult()]);
    assert.equal(out?.decision, 'block', `comanda „${cmd}” nu trebuia să conteze ca verificare`);
  }
});

test('ignoră intrările subagenților (isSidechain)', () => {
  const side = { ...edit('/p/app.ts'), isSidechain: true };
  const out = run([userText('x'), side, toolResult()]);
  assert.equal(out, null);
});

test('nu cade la intrare stricată și nu blochează', () => {
  const r = spawnSync('node', [GATE], { input: 'nu e json', encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), '');
});
