---
name: verification
description: Folosește înainte să spui că o lucrare e gata, reparată sau că trece testele, și înainte de commit sau PR. Cere dovadă proaspătă (comanda rulată acum, cu rezultatul citit) pentru orice afirmație de succes. Use before claiming work is done, fixed or passing.
---

<!-- Derivat din superpowers/verification-before-completion, Copyright (c) 2025 Jesse Vincent, MIT. Vezi LICENSE. -->

# Verificare înainte de „gata”

**Regula:** nicio afirmație de succes fără o verificare rulată după ultima modificare. „Ar trebui să meargă” nu e o stare.

Înainte să spui că ceva e gata:

1. Ce comandă dovedește afirmația? (testul, build-ul, scriptul rulat, cererea la server)
2. Rulează-o acum, complet, nu o rulare de dinainte de modificare.
3. Citește rezultatul: codul de ieșire, numărul de eșecuri.
4. Raportează ce arată rezultatul, cu dovada. Dacă nu confirmă, spune starea reală.

| Afirmația | Dovada | Nu e dovadă |
|---|---|---|
| Testele trec | ieșirea testelor, 0 eșecuri | o rulare veche |
| Build-ul merge | build cu cod de ieșire 0 | linter-ul a trecut |
| Bug-ul e reparat | simptomul inițial nu mai apare | codul s-a schimbat |
| Un subagent a terminat | diff-ul arată modificările, verificate | raportul lui de succes |
| Cerința e îndeplinită | fiecare punct verificat pe rând | testele trec |

Dacă nu există nicio verificare posibilă (lipsește mediul, accesul, datele), spune explicit ce nu ai putut verifica și de ce. Asta e un rezultat acceptabil; o afirmație nedovedită nu e.
