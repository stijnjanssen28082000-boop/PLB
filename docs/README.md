# Plaatsbeschrijving-app — volledig referentiedocument voor Claude Code

Dit is het enige document dat je nodig hebt om dit project op te starten in Claude Code. Het bundelt vier delen die voorheen apart stonden:

- [**Deel A — Concept**](./concept.md): businesscontext, doelgroep, scope, architectuur, plan
- [**Deel B — Datamodel**](./datamodel.md): alle 18 tabellen, relaties, regels voor de ontwikkelaar
- [**Deel C — UX/UI-richtlijnen**](./ux.md): ontwerpprincipes, kernschermen, en hoe design-controles tijdens het bouwen gebruikt worden
- [**Deel D — Test- en productieomgeving**](./environments.md): hoe development, test en productie gescheiden blijven, inclusief mailing- en AI-kostenbeveiliging

**Instructie voor Claude Code, te volgen bij élke bouwopdracht in dit project:**

1. Raadpleeg Deel B voor datastructuur vóór je een tabel, model of sync-logica schrijft.
2. Raadpleeg Deel C vóór en tijdens het bouwen van elk scherm — de ontwerpprincipes in C.2 zijn harde eisen, geen suggesties (grote tikdoelen, hoog contrast, minimale tekstinvoer).
3. **Na het bouwen van elk scherm**, voer je onmiddellijk de bijhorende designcontroles uit zoals beschreven in C.6, vóór je verdergaat naar het volgende scherm. Dit is geen optionele nazorg-stap — het is onderdeel van "een scherm is klaar."
4. Bij twijfel tussen snelheid en zorgvuldigheid: dit is een pilotproduct voor een professionele gebruiker op locatie, geen consumenten-app. Betrouwbaarheid en snelheid van de kernflow (Deel C, Flow B) wegen zwaarder dan visuele afwerking elders.
5. **Werk standaard tegen de test-omgeving** (Deel D), nooit tegen productie, tenzij expliciet gevraagd. Elke mail die tijdens het testen verstuurd wordt, moet via de testomgeving-beveiliging in D.7 lopen — bouw die beveiliging vóór je de mailingfunctie voor het eerst test, niet erna.

---
---
