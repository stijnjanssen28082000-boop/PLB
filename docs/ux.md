# DEEL C — UX/UI-RICHTLIJNEN

Referentiedocument voor ontwikkeling, aanvullend op `docs/concept.md` en `docs/datamodel.md`. Dit is de invulling van fase 1, stap 1.3 (userflows) uit het stappenplan. Geef dit mee aan Claude Code bij elke schermopdracht.

---

## 1. Waarom UX hier zwaarder weegt dan bij een gemiddelde app

De gebruiker is een plaatsbeschrijver, op locatie, vaak onder tijdsdruk, soms buiten, soms in een slecht verlichte kelder, soms met de huurder en verhuurder er ongeduldig bij. De app moet sneller zijn dan een blocnote, niet trager. Elke seconde extra per ruimte, vermenigvuldigd over 8-10 ruimtes per inspectie en meerdere inspecties per dag, bepaalt of dit product wordt geadopteerd of na twee weken terug de kast in gaat.

**Kernprincipe**: elke ontwerpbeslissing wordt getoetst aan "maakt dit de plaatsbeschrijver sneller of trager op locatie" — niet aan "ziet dit er modern uit."

---

## 2. Ontwerpprincipes voor veldgebruik

1. **Duimbediening, één hand**: de plaatsbeschrijver houdt vaak het toestel in één hand (telefoon) of gebruikt een tablet op een oppervlak, terwijl de andere hand foto's neemt of iets vasthoudt. Belangrijkste acties (volgende ruimte, foto nemen, toestand kiezen) moeten met de duim bereikbaar zijn zonder de grip te verplaatsen — dus onderaan het scherm, niet bovenaan.
2. **Grote tikdoelen**: minimaal 48×48pt, met extra ruimte errond. Geen fijne dropdowns of kleine iconen — dit wordt gebruikt met dikke vingers, soms handschoenen in de winter.
3. **Leesbaar in fel zonlicht**: hoog contrast, geen dunne grijze tekst op witte achtergrond. Test het ontwerp letterlijk buiten in de zon vóór het als "af" geldt.
4. **Minimale tekstinvoer**: waar mogelijk kiezen uit vooraf ingestelde opties (toestand-knoppen, standaardformuleringen) in plaats van typen. Typen is traag en foutgevoelig onderweg. Vrije tekst blijft mogelijk maar is nooit de eerste, snelste weg.
5. **Altijd duidelijke offline/sync-status**: de plaatsbeschrijver moet op elk moment, zonder te moeten nadenken, weten: "is dit bewaard op mijn toestel? Is het al gesynct?" Onzekerheid hierover is de snelste manier om vertrouwen in de app te verliezen. Zie sectie 5.
6. **Voortgang altijd zichtbaar**: hoeveel ruimtes zijn klaar, hoeveel nog te doen — als een simpele voortgangsbalk of teller, permanent zichtbaar tijdens de inspectie.
7. **Onderbreken en hervatten zonder verlies**: een plaatsbeschrijver wordt gebeld, moet weg, komt terug — de app moet exact terugkeren waar hij was, zonder heropstart-frictie.
8. **Geen destructieve acties zonder bevestiging, maar niet overdreven**: "volgende ruimte" heeft geen bevestiging nodig; "inspectie verwijderen" wel.
9. **Consistente volgorde binnen een ruimte**: elk element in dezelfde vaste volgorde tonen (muren → plafond → vloer → ramen → ...) zodat een ervaren plaatsbeschrijver na een paar inspecties op autopilot kan werken.

---

## 3. Kernschermen en flows

**[v7]** Flows A t.e.m. E zijn de plaatsbeschrijver-flows op het toestel. Flow G is de partijen-flow (huurder/verhuurder, zonder account, via mail-link). Flow F is de backoffice-kant, waarschijnlijk web-based, opgesplitst in F.1 (plannen/toewijzen), F.2 (ruimtetemplates en rapport-inleiding), F.3 (gebruikersbeheer), F.4 (branding/mailondertekening/bewaartermijn/opmerkingenvenster), F.5 (bulk-import panden) en F.6 (opmerkingen van partijen opvolgen). Geen van deze zijn latere toevoegingen — het zijn stuk voor stuk dingen die nodig zijn zodra een klant zichzelf moet kunnen beheren zonder dat jij tussenkomt, en zodra partijen effectief gebruikmaken van het recht dat de wettelijke tekst hen al toezegt.

### Flow A — Nieuwe inspectie starten

1. **Startscherm**: lijst van geplande inspecties (uit ERP-koppeling, of aangemaakt door een dispatcher via Flow F, of handmatig aangemaakt) + knop "nieuwe inspectie" voor ad hoc gevallen zonder voorafgaande planning. Duidelijk onderscheid tussen "vandaag" en "later"; bovenaan de eerstvolgende afspraak.
2. **Pand kiezen**: zoeken op adres of kiezen uit geplande lijst. Als het pand al gekoppeld is aan de afspraak (via Flow F): automatisch ingevuld, geen extra stap.
3. **Type kiezen**: intrede / uittrede / tussentijds — groot, duidelijk, één tik. Bij uittrede: automatische melding "intrede-plaatsbeschrijving gevonden, gegevens worden overgenomen" (of, als er geen gekoppelde intrede is: expliciete waarschuwing, want dat is uitzonderlijk en foutgevoelig).
4. **Partijen bevestigen**: als een dispatcher de partijen al vooraf invulde (Flow F), bevestigt de plaatsbeschrijver dit enkel; anders vult hij ze hier zelf in — naam, e-mail, telefoon. Kan ook later/tijdens de inspectie, niet blokkerend om te starten.
5. **[v3] Taal van de inspectie kiezen**: standaard de taal van de plaatsbeschrijver (`users.language`), maar aanpasbaar per inspectie — relevant wanneer een Franstalige huurder/verhuurder aanwezig is bij een Nederlandstalige plaatsbeschrijver, of omgekeerd. Deze keuze bepaalt de taal van het rapport en de mails naar de partijen (niet noodzakelijk de taal die de plaatsbeschrijver zelf op zijn scherm ziet — zie C.3b).

### Flow B — Ruimte-inspectie (de kern, meest gebruikte flow)

Dit scherm wordt tientallen keren per dag gebruikt — hier zit de grootste tijdswinst of het grootste tijdsverlies.

1. **Ruimte-overzicht**: lijst van ruimtes (uit template of gekopieerd van intrede), met status per ruimte (niet gestart / bezig / afgerond) via kleur of icoon. Duidelijke "ruimte toevoegen"-knop voor niet-standaard ruimtes.
2. **Binnen een ruimte — element voor element**:
   - Bovenaan: welk element (bv. "Muren"), met duidelijke terug/volgende-navigatie tussen elementen binnen de ruimte
   - **Toestand kiezen**: 3-4 grote knoppen naast elkaar (goed / gebruikssporen / beschadigd / n.v.t.), telkens dezelfde plek op het scherm voor elk element — spierherinnering doet de rest na een paar keer
   - **Bij "goed"**: standaardtekst wordt automatisch voorgesteld, geen foto verplicht, plaatsbeschrijver kan meteen door naar het volgende element (één tik totaal als alles in orde is)
   - **Bij "gebruikssporen"/"beschadigd"**: foto-knop wordt prominent en verplicht gemarkeerd vóór men verder kan; tekstveld verschijnt, met de mogelijkheid om kort te typen of in te spreken (spraak-naar-tekst, fase 1.x)
   - **Sub-attributen** (materiaal, kleur): ingeklapt/optioneel, niet in de weg voor de snelle flow
3. **Foto's nemen**: rechtstreeks vanuit het element-scherm (geen aparte "camera-app" omweg), foto meteen zichtbaar als thumbnail gekoppeld aan dat element, mogelijkheid om meerdere foto's per element te nemen, makkelijk een foute foto verwijderen vóór verzenden.
4. **Ruimte afronden**: wanneer alle elementen een toestand hebben (en verplichte foto's aanwezig zijn), wordt de ruimte automatisch als "afgerond" gemarkeerd — geen aparte "klaar"-knop nodig, dat werkt frictieverhogend.

### Flow C — Uittrede: vergelijking met intrede

1. Binnen elk element bij een uittrede-inspectie: de intrede-vaststelling staat zichtbaar naast (of direct boven) het invoerveld — foto en beschrijving van toen, niet weggestopt achter een extra tik.
2. Plaatsbeschrijver bevestigt expliciet: "zelfde staat als intrede" (één tik, snelste pad — de meerderheid van elementen bij uittrede zijn immers ongewijzigd) of "verschil vastgesteld" (opent dan het volledige invoerveld).
3. Bij een vastgesteld verschil: aansprakelijkheidskeuze (huurder / verhuurder / normale slijtage) als duidelijke, verplichte stap — dit is juridisch het belangrijkste veld in de hele app en mag niet per ongeluk overgeslagen worden.

### Flow D — Ondertekening

1. Overzichtsscherm vóór ondertekening: samenvatting van alle ruimtes met een afwijkende toestand, zodat huurder/verhuurder in één oogopslag zien wat er is vastgesteld — niet elke ruimte apart moeten doorklikken.
2. Per partij: naam bevestigen, "gaat akkoord" ja/nee, optioneel opmerkingenveld (prominent zichtbaar als aparte, eigen sectie — nooit vermengd met de plaatsbeschrijver-tekst), handtekening op het scherm.
3. Duidelijke waarschuwing vóór het definitieve tikje: "na ondertekening kan dit niet meer gewijzigd worden" — één bevestigingsstap, niet meer.
4. Na ondertekening: onmiddellijke visuele bevestiging ("plaatsbeschrijving afgerond, wordt gesynchroniseerd zodra er verbinding is") — de plaatsbeschrijver mag hier geen twijfel over hebben.

### Flow E — Sync-status (permanent zichtbaar element, geen apart scherm)

- Een klein, altijd zichtbaar statusicoon (bv. in de header): **offline / synchroniseren / volledig gesynct**, met kleurcodering (grijs / oranje-pulserend / groen).
- Tikken op dit icoon toont een simpele lijst: welke inspecties nog wachten op sync, per stuk met status (data ok, foto's x van y geüpload).
- Bij een mislukte upload: duidelijke, niet-technische melding ("wordt opnieuw geprobeerd zodra er verbinding is") — nooit een technische foutcode tonen aan de plaatsbeschrijver.
- **Nooit** een actie blokkeren omdat er geen verbinding is, behalve waar het functioneel niet anders kan (bv. AI-suggesties, die sowieso pas na sync komen).

### C.3b — Meertaligheid, twee gescheiden niveaus [v3, nieuw]

Twee verschillende taalkeuzes, niet met elkaar te verwarren in de UX:

1. **De taal van de plaatsbeschrijver zelf** (`users.language`) — ingesteld bij het eerste gebruik (taalkeuzescherm bij eerste opstart) en aanpasbaar in een instellingenscherm. Bepaalt alle app-chrome: knoppen, meldingen, foutmeldingen. Wijzigt **nooit automatisch** tijdens een lopende inspectie — een plaatsbeschrijver die halverwege een inspectie zit, mag niet plots een andere interfacetaal krijgen.
2. **De taal van de inspectie/het rapport** (`inspections.language`, ingesteld in Flow A) — bepaalt de taal van de templates die de plaatsbeschrijver ziet tijdens het invullen (relevant als hij de vaststelling samen met een Franstalige huurder doorneemt), en de taal van het uiteindelijke PDF-rapport en de mails naar de partijen. Kan losstaan van de taal van de plaatsbeschrijver zelf.

**Praktisch scherm**: een eenvoudige taalkeuze (vlagicoon of taalcode NL/FR/EN, geen dropdown met volledige landsnamen — te traag voor veldgebruik) zichtbaar in de header tijdens Flow B, zodat de plaatsbeschrijver ter plekke kan wisselen zonder naar instellingen te moeten navigeren, mocht de huurder liever meelezen in zijn eigen taal.

**Regel voor Claude Code**: bouw de taalkeuze-toggle in Flow B mee vanaf de eerste versie van dat scherm — dit hoort niet als losse "instellingen"-taak achteraf, want net Flow B is waar de taalkeuze het meest gebruikt zal worden (huurder leest mee tijdens de rondgang).

**[verduidelijkt tijdens de bouw] Wat de toggle in Flow B precies wijzigt**: hierboven stonden twee taalniveaus beschreven zonder te zeggen welk niveau de header-toggle aanstuurt. Beslissing: de toggle wijzigt **`inspections.language`** — dus zowel de app-chrome als de elementnamen en standaardteksten op het scherm, én de taal van het PDF-rapport en de mails. Reden: het doel dat hierboven staat ("mocht de huurder liever meelezen in zijn eigen taal") wordt niet gehaald als enkel de knoppen vertalen en de vaststellingen zelf Nederlands blijven.

Gevolg voor reeds ingevulde beschrijvingen: bij een taalwissel worden enkel de beschrijvingen met `description_source = 'default'` (3.7) hervertaald. Tekst die de plaatsbeschrijver zelf typte of aanpaste (`manual`) blijft ongewijzigd — dat is zijn vaststelling, geen sjabloontekst. Zonder deze regel zou een Franstalig rapport Nederlandse standaardzinnen bevatten die de plaatsbeschrijver nooit geschreven heeft.

---

### Flow G — Partijen: rapport bekijken en opmerkingen geven [v7, nieuw]

Een derde publiek, naast de plaatsbeschrijver (A-E) en de backoffice (F.1-F.5): de **huurder, verhuurder of makelaar**, die via de afleveringsmail (na `approved` → `sent`, zie statusflow 3.4) een beveiligde link ontvangt naar een lichte webpagina — **geen app-installatie, geen account, geen wachtwoord**.

1. **Rapportoverzicht**: dezelfde structuur als het PDF-rapport — per ruimte, per windrichting, met foto's en beschrijvingen — maar dan als scrollbare webpagina, leesbaar op een telefoon.
2. **Opmerking per element**: bij elk element (bv. "Slaapkamer groot — Noordmuur") een kleine, duidelijk zichtbare knop "opmerking toevoegen". Tikken opent een klein tekstveld ter plaatse, geen aparte pagina — zo laag mogelijke drempel voor "zelfs het kleinste detail" te melden.
3. **Algemene opmerking**: één vast veld bovenaan/onderaan voor een opmerking die niet aan een specifiek element hangt.
4. **Versturen**: elke ingediende opmerking wordt meteen opgeslagen (`report_comments`, 3.15c) — geen verzamel-en-verstuur-stap nodig, elke opmerking staat op zich, zodat een partij niet alles in één keer moet schrijven.
5. **Bevestiging**: na elke opmerking een korte, geruststellende melding ("opmerking ontvangen, de organisatie neemt dit op"), geen twijfel of het aangekomen is.
6. **Venster gesloten**: na `organizations.comment_window_days` (standaard 14, zie 3.1) toont de pagina het rapport nog steeds (leesbaar blijft altijd), maar het opmerkingenveld is vervangen door een tekst die verwijst naar de andere kanalen uit de wettelijke tekst (aangetekend schrijven, e-mail) — consistent met wat er letterlijk in de juridische inleiding staat (3.5c).

**Regel voor Claude Code**: deze pagina is nadrukkelijk **niet** de plaatsbeschrijver-app en gebruikt geen Capacitor/mobiele shell — een gewone, lichte, responsive webpagina (dezelfde React-codebase kan herbruikt worden voor componenten, maar de build/deploy is apart, publiek toegankelijk zonder authenticatie, enkel beveiligd via het token uit `report_party_access`). Bij elke opmerking: een notificatie (mail of backoffice-melding) naar de dispatcher/admin van de organisatie, zodat niemand een binnenkomende opmerking mist — zie Flow F.6 hieronder.

### Flow F.6 — Backoffice: opmerkingen van partijen opvolgen [v7, nieuw]

Toegankelijk voor `dispatcher`/`admin`:

1. **Inbox-overzicht**: alle `report_comments` met status `open`, over alle inspecties, met filters op klant/pand/datum — nieuwste bovenaan.
2. **Detail per opmerking**: welke partij, welk element (met foto en oorspronkelijke beschrijving ernaast getoond), de opmerking zelf, tijdstip.
3. **Afhandelen**: status wijzigen naar `acknowledged` (gezien, nog niet opgelost) of `resolved` (met optionele `resolution_note`), en optioneel opnemen in `reports.addendum_text` als het een formele correctie van het rapport rechtvaardigt.

**Regel voor Claude Code**: bouw Flow G en F.6 samen — een opmerkingenkanaal zonder een plek waar iemand het ook effectief ziet en opvolgt, is een vertrouwensbreuk in de maak.

---

## 4. Backoffice-flows (Flow F)

### Flow F.1 — Backoffice: plannen en toewijzen [v4, nieuw]

Een echte organisatie werkt met twee gescheiden rollen: een **dispatcher** (office manager) die plaatsbeschrijvingen inplant en toewijst, en de **plaatsbeschrijver** die ze ter plaatse uitvoert. Dit is geen backoffice-verfijning voor later — het is hoe een inspectie überhaupt ontstaat, dus het hoort al in versie 1, zij het minimaal.

**Versie 1 — minimaal nodig (waarschijnlijk web, niet mobiel)**:
- Pand aanmaken/opzoeken (`properties`)
- Inspectie aanmaken: pand, type (intrede/uittrede), datum/uur, toegewezen plaatsbeschrijver (`dispatcher`-rol wijst een `plaatsbeschrijver`-gebruiker toe)
- Overzicht van alle inspecties met status, gefilterd op klant/pand/plaatsbeschrijver/datum
- Betrokken partijen (huurder/verhuurder/makelaar) al vooraf invullen, zodat de plaatsbeschrijver dit niet ter plaatse hoeft te doen (Flow A, stap 4 wordt dan een bevestiging in plaats van invoer vanaf nul)

Op het toestel van de plaatsbeschrijver (Flow A, stap 1) verschijnen dus **vooraf ingeplande inspecties** die de dispatcher aanmaakte, naast de mogelijkheid om zelf ad hoc een inspectie te starten (bv. bij een spoedgeval zonder voorafgaande planning).

### Flow F.2 — Ruimtetemplates en rapport-inleiding personaliseren [v5, nieuw — verplaatst van "later" naar v1-nodig]

**Waarom dit niet kan wachten tot v1.x**: zodra een tweede klantorganisatie instapt (niet enkel de werkgever), heeft die klant hoogstwaarschijnlijk eigen ruimtes die vaak voorkomen en niet in de standaardlijst staan, en wil hij zijn eigen bedrijfsvoorstelling in het rapport. Zonder dit scherm moet jij dat telkens handmatig in de databank invoeren voor elke nieuwe klant — dat schaalt niet voorbij de eerste pilot.

Toegankelijk enkel voor de `admin`-rol binnen een organisatie:

1. **Ruimtetemplates-overzicht**: lijst van actieve templates voor deze organisatie (eigen + gedupliceerde globale), met een knop "nieuw ruimtetype toevoegen" en "dupliceer van standaardlijst".
2. **Ruimtetype bewerken**: naam per taal (NL/FR/EN), lijst van elementen (uit de globale elementenbibliotheek te kiezen, of zelf een nieuwe naam typen), en per element de **standaardtekst per taal** die verschijnt bij toestand "goed" — dit is letterlijk de "standaard tekst" die je vraagt.
3. **Volgorde bepalen**: eenvoudige nummervelden voor sortering in v1 (geen drag-and-drop nodig), zodat de klant kan bepalen in welke volgorde ruimtes/elementen in het rapport verschijnen.
4. **Rapport-inleiding personaliseren**: apart tekstveld per taal (`organizations.custom_intro_translations`), met een duidelijk zichtbare waarschuwing in de UI zelf — bv. "Dit is jouw eigen inleidende tekst. De wettelijke bepalingen (proces-verbaal, klachtenprocedure) worden apart en onveranderd toegevoegd." — zodat een klant nooit denkt dat hij hier de wet aanpast.
5. **Voorbeeldweergave**: een "bekijk voorbeeldrapport"-knop die een korte PDF-preview toont met de huidige templates en inleiding — belangrijk, want een klant die blind tekst intikt zonder te zien hoe het rapport eruitziet, maakt sneller fouten.

**Regel voor Claude Code**: bouw stap 1-4 vóór de eerste externe klant (niet enkel de werkgever) een pilot start — dit hoeft niet gepolijst te zijn, maar moet functioneel werken zodat jij niet elke ruimte-aanpassing handmatig via Supabase moet doen.

### Flow F.3 — Gebruikersbeheer [v6, nieuw]

Toegankelijk voor `admin`:

1. **Gebruikerslijst**: alle gebruikers van de organisatie, met rol, status (actief/uitgenodigd/inactief), laatst actief.
2. **Uitnodigen**: e-mailadres + rol kiezen → mail met uitnodigingslink (`user_invitations`, zie 3.2b). Geen wachtwoord door de admin ingesteld — de genodigde stelt dat zelf in bij aanvaarding.
3. **Beheren**: rol wijzigen, gebruiker deactiveren (`is_active = false`, geen harde delete — historische inspecties blijven gekoppeld aan de naam), uitnodiging intrekken of opnieuw versturen.

**Regel voor Claude Code**: dit is de eerste backoffice-flow die je bouwt, nog vóór F.2 — zonder gebruikersbeheer kan een klant zelfs niet inloggen met meerdere mensen, dus dit is een harde vereiste, geen "self-service extra."

### Flow F.4 — Organisatie-instellingen: branding, mailondertekening, bewaartermijn [v6, nieuw]

Toegankelijk voor `admin`, één instellingenscherm:

1. **Logo uploaden** en **afzendernaam/-adres invullen** — opgeslagen en zichtbaar in een preview, met een duidelijke UI-tekst dat dit "vanaf versie 2" effectief in rapporten/mails verschijnt (géén valse belofte dat het al actief is).
2. **Afzenderadres-verificatie**: als een klant een eigen `report_sender_email` invult, toont de UI de status (`niet geverifieerd` / `in verificatie` / `geverifieerd`) — de eigenlijke verificatie bij de maildienst (Resend/Postmark, meestal een DNS-record) vraagt initieel jouw technische hulp; dit volledig zelfstandig maken is v2-werk.
3. **Mailondertekening**: kort tekstveld per taal (`mail_signature_translations`) — **dit is al actief in v1**, verschijnt onderaan elke automatische mail.
4. **Bewaartermijn**: numeriek veld met vaste grenzen (3-15 jaar, zie 3.1), met een korte uitleg waarom een minimum geldt.

### Flow F.5 — Bulk-import van panden (CSV) [v6, nieuw]

Toegankelijk voor `admin`/`dispatcher`:

1. **CSV uploaden** met een gepubliceerd sjabloon (kolommen: straat, huisnummer, bus, postcode, gemeente, land, pandtype, externe referentie).
2. **Voorbeeldweergave vóór import**: eerste 10 rijen tonen zoals ze geïnterpreteerd worden, met foutmarkering bij ontbrekende verplichte velden.
3. **Importeren**: enkel geldige rijen worden aangemaakt (`properties`); een samenvatting toont hoeveel gelukt/mislukt zijn, met een downloadbaar foutenrapport voor de mislukte rijen.

**Regel voor Claude Code**: geen ingewikkelde kolom-mapping-UI in v1 — vaste kolomvolgorde volgens het gepubliceerde sjabloon volstaat. Flexibele mapping is v1.x-werk.

**Versie 1.x/2 — rijkere backoffice, kan later**:
- Reviewscherm voor AI-suggesties — alle suggesties van een inspectie in één lijst, snel accepteren/aanpassen/verwerpen
- Reviewscherm voor sync-conflicten (zie datamodel 3.7) — welke elementen wachten op manuele keuze
- Drag-and-drop volgorde in plaats van nummervelden (Flow F.2, stap 3)
- Zelfstandige domeinverificatie voor het afzenderadres (Flow F.4, stap 2), zonder jouw tussenkomst
- Flexibele kolom-mapping bij CSV-import (Flow F.5)
- Planning-optimalisatie (route, beschikbaarheid plaatsbeschrijvers)

Voor de allereerste pilot bij de werkgever zelf mag het minimale backoffice-scherm nog rechtstreeks in Supabase's ingebouwde tabelbeheer gebeuren (jij bent dan zelf de dispatcher/admin) — maar Flow F.2 t.e.m. F.5 zijn nodig zodra een externe klant zichzelf moet kunnen beheren zonder dat jij tussenkomt.

---

## 5. Concreet voor Claude Code

- Bouw Flow B (ruimte-inspectie) eerst en apart testbaar, vóór de andere flows — dit is het scherm waar 80% van de gebruikstijd zit en waar UX-fouten het meest kosten.
- Test elk scherm expliciet met: één hand, gesimuleerd fel licht (hoog schermhelderheid + contrastcheck), en een onderbroken/hervatte sessie.
- Gebruik geen generieke component-library zonder aanpassing van tikdoelgroottes — standaard webcomponenten zijn vaak te klein voor veldgebruik (te vergelijken met bv. minimaal 48pt i.p.v. de gebruikelijke kleinere default van veel UI-kits).
- Kleurcodering voor toestand (goed/gebruikssporen/beschadigd) consistent houden door de hele app — dezelfde kleur betekent overal hetzelfde.

## 6. Werkwijze voor design-controles — verplichte stap per scherm

**Belangrijk**: de officiële Design-plugin (`/design:...`-commando's) werkt enkel in een lokale Claude Code CLI- of desktopsessie — niet in een remote/webse­ssie. Vertrouw dus niet blind op de plugin te zijn geïnstalleerd. Onderstaande controles zijn geformuleerd als **vraag in gewone taal**, die Claude Code met of zonder plugin kan uitvoeren (de plugin verpakt dezelfde soort controle enkel in een commando):

| Na het bouwen van... | Vraag dit (in gewone taal, of met `/design:...` als de plugin lokaal geïnstalleerd is) | Waarom, gekoppeld aan deze richtlijnen |
|---|---|---|
| Elk scherm | "Controleer dit scherm op toegankelijkheid: contrast, tikdoelgroottes minimaal 48pt, leesbaarheid in fel licht — volgens Deel C van dit document." (of `/design:accessibility-review`) | Toetst rechtstreeks principe 2 en 3 (grote tikdoelen, contrast/leesbaarheid in fel licht) — de twee principes die het makkelijkst sluipenderwijs verwateren tijdens het bouwen |
| Flow B (ruimte-inspectie) — na de eerste versie | "Geef gestructureerde kritiek op dit scherm: werkt de flow zo snel en duimvriendelijk als bedoeld in Deel C?" (of `/design:design-critique`) | Dit scherm draagt 80% van het gebruik; een structurele kritiek vóór verdere flows gebouwd worden, voorkomt dat een fout zich herhaalt door de hele app |
| Elk scherm met foutmeldingen, lege staten of statusteksten (vooral Flow E — sync-status) | "Herbekijk de teksten in dit scherm: niet-technisch, geruststellend, geen foutcodes zichtbaar voor de gebruiker." (of `/design:ux-copy`) | De sync-status-melding moet niet-technisch en geruststellend zijn (principe 5); dit toetst en verbetert precies dat soort microcopy |
| Na Flow A t.e.m. E, vóór de pilot | "Vergelijk alle schermen: is de kleurcodering voor toestand en de elementvolgorde overal consistent?" (of `/design:design-system`) | Controleert dat kleurcodering (goed/gebruikssporen/beschadigd) en de vaste elementvolgorde binnen een ruimte consistent zijn doorheen de hele app — principes 6 en 9 |
| Vóór de pilot start (fase 3/4 van het businessplan) | "Maak een opgeruimde schermspecificatie van deze flow, mocht ik dit later aan iemand anders doorgeven." (of `/design:design-handoff`) | Nuttig mocht je later een freelancer betrekken voor polish richting fase 5 |

**Regel voor Claude Code**: sla geen van deze controles over "om tijd te winnen" bij Flow B en Flow D (ondertekening) — dat zijn de twee schermen met respectievelijk de hoogste gebruiksfrequentie en de hoogste juridische gevoeligheid, dus fouten daar kosten het meest. Bij de overige schermen (A, C, E) volstaat minstens de toegankelijkheidscontrole. Dit geldt ongeacht of de Design-plugin lokaal geïnstalleerd is — de vraag in gewone taal is het uitgangspunt, de plugin-commando's zijn enkel een snelkoppeling ernaar wanneer beschikbaar.

---
