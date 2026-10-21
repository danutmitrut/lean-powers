---
name: review-feedback
description: Folosește când primești observații de code review (de la om, de la un agent sau de la un tool), înainte să le implementezi. Verifici fiecare observație pe cod, nu o accepți din politețe. Use when receiving code review feedback, before implementing it.
---

<!-- Derivat din superpowers/receiving-code-review, Copyright (c) 2025 Jesse Vincent, MIT. Vezi LICENSE. -->

# Observațiile de review

**Regula:** o observație se verifică pe codul real înainte să fie implementată. Corectitudinea tehnică contează mai mult decât acordul.

Pentru fiecare observație:

1. O reformulezi tehnic, pe scurt. Dacă nu e clară, întrebi înainte să atingi ceva, și pentru celelalte observații, pentru că pot fi legate.
2. O verifici: e adevărată pentru codul ăsta? Strică ceva existent? Există un motiv pentru forma actuală? Recenzentul are contextul complet?
3. Răspunzi cu una din trei: o implementezi, o contești cu argumentul tehnic, sau spui că nu o poți verifica fără X.

Ordinea de implementare: întâi ce strică ceva sau ține de securitate, apoi reparațiile simple, apoi restul. Una câte una, cu verificare după fiecare.

Nu adaugi funcționalitate „ca să fie făcut cum trebuie” dacă nimeni n-o folosește: verifici întâi dacă e folosită.

Fără „ai perfectă dreptate” sau „excelentă observație”. Treci direct la verificare sau la lucru.

Dacă o observație contrazice o decizie luată de om, te oprești și întrebi.
