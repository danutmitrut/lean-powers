---
name: debugging
description: Folosește la orice bug, test picat, eroare de build sau comportament neașteptat, înainte să propui o reparație. Găsești cauza, dovedită, apoi repari. Use for any bug, failing test or unexpected behavior, before proposing a fix.
---

<!-- Derivat din superpowers/systematic-debugging, Copyright (c) 2025 Jesse Vincent, MIT. Vezi LICENSE. -->

# Depanare: cauza întâi

**Regula:** nicio reparație înainte să poți arăta cauza. O reparație pe simptom nu e o reparație.

Ce trebuie să ai înainte de prima modificare:

- **Reproducerea.** Pașii exacți prin care apare problema. Dacă nu se reproduce sigur, strângi date, nu ghicești.
- **Dovada cauzei.** Linia de log, valoarea greșită sau diferența (față de o versiune care merge, față de un exemplu care merge) care arată unde se rupe. Într-un sistem cu mai multe componente, verifici ce intră și ce iese la fiecare graniță până găsești stratul care strică.
- **O ipoteză formulată.** „Cauza e X, pentru că Y.” O singură ipoteză testată pe rând, cu cea mai mică modificare posibilă.

Apoi:

1. Un test sau un script care reproduce problema și pică.
2. O singură reparație, la sursă. Fără „și dacă tot sunt aici”.
3. Verificarea: testul trece, simptomul inițial nu mai apare, nimic altceva nu s-a stricat.

**Oprirea:** dacă trei reparații la rând n-au mers, nu încerca a patra. Probabil e o problemă de arhitectură, nu de ipoteză. Spune ce ai încercat, ce ai aflat și discută cu omul înainte să continui.

Dacă nu înțelegi ceva, spune „nu înțeleg X”. Nu acoperi cu o reparație.
