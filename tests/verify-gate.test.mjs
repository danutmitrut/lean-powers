import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GATE = join(dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'verify-gate.mjs');

// Construiește un transcript JSONL în formatul Claude Code. Fiecare intrare primește un
// timestamp: pornim cu 60 s în urmă și avansăm cu 1 s, deci tot transcriptul e în trecut.
let nextId = 0;
const userText = (text) => [{ type: 'user', isSidechain: false, message: { role: 'user', content: text } }];
function call(name, input, { sidechain = false } = {}) {
  const id = `t${nextId++}`;
  return [
    { type: 'assistant', isSidechain: sidechain, message: { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] } },
    { type: 'user', isSidechain: sidechain, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] } },
  ];
}
const edit = (file, opts) => call('Edit', { file_path: file, old_string: 'a', new_string: 'b' }, opts);
const bash = (command, opts) => call('Bash', { command }, opts);

// Un pas de verificare care se încheie în viitor, după orice modificare făcută pe disc de test.
function bashLater(command) {
  const [a, r] = bash(command);
  r.timestamp = new Date(Date.now() + 60_000).toISOString();
  return [a, r];
}

function stamp(entries) {
  const t0 = Date.now() - 60_000;
  return entries.flat().map((e, i) => ({ timestamp: new Date(t0 + i * 1000).toISOString(), ...e }));
}

const tempDir = () => mkdtempSync(join(tmpdir(), 'lean-powers-'));

function run(entries, { cwd = tempDir(), env = {}, ...extra } = {}) {
  const transcript = join(tempDir(), 't.jsonl');
  writeFileSync(transcript, stamp(entries).map((e) => JSON.stringify(e)).join('\n') + '\n');
  const input = JSON.stringify({ hook_event_name: 'Stop', transcript_path: transcript, cwd, stop_hook_active: false, ...extra });
  const r = spawnSync('node', [GATE], { input, encoding: 'utf8', env: { ...process.env, ...env } });
  assert.equal(r.status, 0, `hook-ul trebuie să iasă mereu cu 0, stderr: ${r.stderr}`);
  return r.stdout.trim() ? JSON.parse(r.stdout) : null;
}

function gitRepo() {
  const dir = tempDir();
  // commit-urile de pregătire sunt datate cu o oră în urmă, înaintea turei
  const past = new Date(Date.now() - 3_600_000).toISOString();
  const env = { ...process.env, GIT_AUTHOR_DATE: past, GIT_COMMITTER_DATE: past };
  const git = (...args) => execFileSync('git', ['-C', dir, ...args], { stdio: 'pipe', env });
  const gitNow = (...args) => execFileSync('git', ['-C', dir, ...args], { stdio: 'pipe' });
  git('init', '-q');
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 't');
  writeFileSync(join(dir, 'app.py'), 'x = 1\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'init');
  // fișierul comis există de dinaintea turei
  const old = new Date(Date.now() - 3_600_000);
  utimesSync(join(dir, 'app.py'), old, old);
  return { dir, git, gitNow };
}

// --- detectarea din transcript ---

test('blochează când s-a editat cod și nu s-a rulat nicio verificare', () => {
  const out = run([userText('repară'), edit('/p/app.ts')]);
  assert.equal(out?.decision, 'block');
  assert.match(out.reason, /app\.ts/);
});

test('lasă să treacă după un test rulat după ultima editare', () => {
  assert.equal(run([userText('repară'), edit('/p/app.ts'), bash('npm test')]), null);
});

test('blochează dacă testul a fost rulat înainte de ultima editare', () => {
  const out = run([userText('repară'), bash('pytest -q'), edit('/p/app.py')]);
  assert.equal(out?.decision, 'block');
});

test('nu blochează la fișiere care nu sunt cod', () => {
  const out = run([userText('scrie'), edit('/p/README.md'), call('Write', { file_path: '/p/pagina.html', content: '' })]);
  assert.equal(out, null);
});

test('se uită doar la tura curentă', () => {
  assert.equal(run([userText('a'), edit('/p/app.ts'), userText('b'), bash('ls')]), null);
});

test('nu blochează a doua oară (stop_hook_active)', () => {
  assert.equal(run([userText('repară'), edit('/p/app.ts')], { stop_hook_active: true }), null);
});

test('se poate opri cu LEAN_POWERS_GATE=off', () => {
  assert.equal(run([userText('repară'), edit('/p/app.ts')], { env: { LEAN_POWERS_GATE: 'off' } }), null);
});

test('recunoaște rularea scriptului editat ca verificare', () => {
  for (const cmd of ['python3 tool.py', 'node server.mjs', 'bash deploy.sh', './run.sh', 'cargo test', 'npx tsc --noEmit', 'npm run build']) {
    assert.equal(run([userText('x'), edit('/p/tool.py'), bash(cmd)]), null, `comanda „${cmd}” trebuia să conteze ca verificare`);
  }
});

test('comenzile care nu verifică nimic nu contează', () => {
  for (const cmd of ['ls -la', 'git status', 'cat app.ts', 'grep -r foo .']) {
    const out = run([userText('x'), edit('/p/app.ts'), bash(cmd)]);
    assert.equal(out?.decision, 'block', `comanda „${cmd}” nu trebuia să conteze ca verificare`);
  }
});

test('nu cade la intrare stricată și nu blochează', () => {
  const r = spawnSync('node', [GATE], { input: 'nu e json', encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), '');
});

// --- detectarea de pe disc ---

test('git: prinde un fișier de cod modificat printr-o comandă de terminal', () => {
  const { dir } = gitRepo();
  writeFileSync(join(dir, 'app.py'), 'x = 2\n'); // ca un sed -i
  const out = run([userText('schimbă'), bash(`sed -i '' 's/1/2/' ${dir}/app.py`)], { cwd: dir });
  assert.equal(out?.decision, 'block');
  assert.match(out.reason, /app\.py/);
});

test('git: lasă să treacă dacă verificarea s-a terminat după modificare', () => {
  const { dir } = gitRepo();
  writeFileSync(join(dir, 'app.py'), 'x = 2\n');
  assert.equal(run([userText('schimbă'), bash('sed -i x app.py'), bashLater('pytest -q')], { cwd: dir }), null);
});

test('git: prinde un fișier nou, încă necomis', () => {
  const { dir } = gitRepo();
  writeFileSync(join(dir, 'nou.ts'), 'export const a = 1;\n');
  const out = run([userText('adaugă')], { cwd: dir });
  assert.equal(out?.decision, 'block');
  assert.match(out.reason, /nou\.ts/);
});

test('git: prinde codul comis în timpul turei fără verificare', () => {
  const { dir, gitNow } = gitRepo();
  writeFileSync(join(dir, 'app.py'), 'x = 3\n');
  gitNow('commit', '-qam', 'schimbare');
  const out = run([userText('fă commit')], { cwd: dir });
  assert.equal(out?.decision, 'block');
  assert.match(out.reason, /app\.py/);
});

test('git: modificare, verificare, apoi commit nu blochează', () => {
  const { dir, gitNow } = gitRepo();
  writeFileSync(join(dir, 'app.py'), 'x = 4\n');
  // modificat după începutul turei (acum - 60 s), înainte ca verificarea să se termine (acum - 58 s)
  const t = new Date(Date.now() - 59_300);
  utimesSync(join(dir, 'app.py'), t, t);
  gitNow('commit', '-qam', 'după test'); // commit-ul are ora de acum, după verificare
  assert.equal(run([userText('repară și fă commit'), bash('pytest -q')], { cwd: dir }), null);
});

test('git: ignoră fișierele modificate înainte de începutul turei', () => {
  const { dir } = gitRepo();
  writeFileSync(join(dir, 'app.py'), 'x = 2\n');
  const old = new Date(Date.now() - 3_600_000);
  utimesSync(join(dir, 'app.py'), old, old);
  assert.equal(run([userText('întrebare')], { cwd: dir }), null);
});

test('git: respectă .gitignore', () => {
  const { dir, git } = gitRepo();
  writeFileSync(join(dir, '.gitignore'), 'gen/\n');
  git('add', '.gitignore');
  git('commit', '-qm', 'ignore');
  const old = new Date(Date.now() - 3_600_000);
  utimesSync(join(dir, '.gitignore'), old, old);
  mkdirSync(join(dir, 'gen'));
  writeFileSync(join(dir, 'gen', 'out.js'), '1');
  assert.equal(run([userText('build')], { cwd: dir }), null);
});

test('subagent: prinde editarea unui subagent, chiar dacă subagentul a rulat testele', () => {
  const { dir } = gitRepo();
  writeFileSync(join(dir, 'app.py'), 'x = 9\n');
  const out = run([userText('deleagă'), edit(join(dir, 'app.py'), { sidechain: true }), bash('pytest', { sidechain: true })], { cwd: dir });
  assert.equal(out?.decision, 'block');
});

test('fără git: prinde fișierele de cod noi și sare peste node_modules', () => {
  const dir = tempDir();
  mkdirSync(join(dir, 'node_modules', 'pkg'), { recursive: true });
  writeFileSync(join(dir, 'node_modules', 'pkg', 'index.js'), '1');
  assert.equal(run([userText('x')], { cwd: dir }), null);
  writeFileSync(join(dir, 'main.go'), 'package main\n');
  const out = run([userText('x')], { cwd: dir });
  assert.equal(out?.decision, 'block');
  assert.match(out.reason, /main\.go/);
});
