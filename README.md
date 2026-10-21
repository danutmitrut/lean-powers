# lean-powers

Disciplina de verificare din [superpowers](https://github.com/obra/superpowers), fără procesul impus. Modelul planifică și lucrează cum crede de cuviință, cu uneltele native din Claude Code (plan mode, subagenți, workflow-uri). Singurul lucru pe care nu-l poate face: să spună că a terminat fără dovadă.

## Ce conține

**Patru skill-uri scurte**, care se declanșează după descriere, nu printr-o regulă care obligă modelul să le caute la fiecare pas:

| Skill | Regula |
|---|---|
| `verification` | nicio afirmație de succes fără o verificare rulată după ultima modificare |
| `debugging` | nicio reparație înainte să poți arăta cauza; după trei reparații eșuate, te oprești |
| `tdd` | testul întâi, văzut picând, apoi codul |
| `review-feedback` | observațiile de review se verifică pe cod înainte să fie implementate |

**Un hook `Stop`** (`hooks/verify-gate.mjs`): dacă în tura curentă s-a modificat cod și nu s-a rulat nicio verificare după ultima modificare (teste, build, type-check, linter, rularea scriptului), tura nu se încheie. Modelul primește mesajul și trebuie fie să verifice, fie să spună explicit ce n-a putut verifica. Poarta se aplică o singură dată pe tură, deci nu poate intra în buclă.

Modificările se află din două surse: editările din transcript și fișierele de cod modificate pe disc de la începutul turei, oricum ar fi fost modificate (editor, `sed`, script, subagent). În proiectele git se uită la fișierele schimbate, la cele noi neignorate și la cele comise în timpul turei. Verificările contează doar dacă le-a rulat agentul principal: ce a rulat un subagent nu se vede, deci agentul principal verifică încă o dată.

Ce nu conține, față de superpowers: injecția de la pornire (`using-superpowers`), brainstorming, planificare, execuție de planuri, subagent-driven-development, worktrees.

## Folosire

Pentru o singură sesiune, fără instalare:

```
claude --plugin-dir "/cale/către/lean-powers"
```

Oprirea porții pentru o sesiune: `LEAN_POWERS_GATE=off claude ...`

## Limite cunoscute

- „Cod” înseamnă extensiile din `CODE_EXT`. HTML, CSS, Markdown, JSON și YAML nu declanșează poarta.
- Recunoașterea verificării e după tipare de comenzi (`VERIFY`). O comandă de test neobișnuită poate să nu fie recunoscută; atunci modelul primește mesajul o dată și poate răspunde.
- În proiectele fără git, scanarea discului se oprește la 5.000 de fișiere și sare peste folderele de dependențe și build (`node_modules`, `dist`, `.venv` etc.) și peste folderele ascunse. Într-un folder foarte mare, o modificare făcută prin terminal poate scăpa; editările din transcript sunt prinse oricum.
- Un fișier de cod modificat de om în timpul turei e tratat ca orice modificare și cere verificare.

## Teste

```
node --test tests/verify-gate.test.mjs
```

## Licență

MIT. Skill-urile din `skills/` derivă din superpowers, Copyright (c) 2025 Jesse Vincent. Vezi `LICENSE`.
