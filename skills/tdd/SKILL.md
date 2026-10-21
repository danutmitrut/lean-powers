---
name: tdd
description: Folosește când adaugi sau schimbi comportamentul unui cod care are sau poate avea teste (funcționalitate nouă, reparație de bug, refactorizare). Testul întâi, văzut picând, apoi codul. Use when implementing a feature, bugfix or behavior change in testable code.
---

<!-- Derivat din superpowers/test-driven-development, Copyright (c) 2025 Jesse Vincent, MIT. Vezi LICENSE. -->

# Testul întâi

**Regula:** dacă nu ai văzut testul picând, nu știi dacă testează ce trebuie.

Ciclul, pentru fiecare comportament:

1. **Roșu.** Scrii un test mic pentru comportamentul dorit. Îl rulezi și îl vezi picând din motivul corect (funcționalitatea lipsește, nu o greșeală de scriere). Dacă trece din prima, testează ceva ce exista deja: îl schimbi.
2. **Verde.** Scrii codul minim care îl face să treacă. Rulezi toate testele relevante.
3. **Curățenie.** Refactorizezi doar cu testele verzi, și le rulezi din nou.

Un test bun: un singur comportament, un nume care spune ce verifică, cod real (mock-uri doar unde nu se poate altfel).

La un bug reparat, dovada completă e: testul pică fără reparație și trece cu ea.

**Când nu se aplică:** prototipuri de aruncat, configurări, scripturi de o singură folosire, cod generat. Decizi singur, dar spui că ai sărit testele și de ce, ca omul să știe.
