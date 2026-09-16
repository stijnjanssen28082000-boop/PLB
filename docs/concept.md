# DEEL A — CONCEPT


---

## Verwerkte council-feedback — samenvatting

De council oordeelde het concept **haalbaar en strategisch onderbouwd**, met de sterkste troef in de domeinkennis van de initiatiefnemer. Grootste risico dat ze identificeerden: **technische overambitie** — offline-sync én AI-features tegelijk bouwen als solo niet-developer. Hun hoofdadvies, hier verwerkt:

1. **Versie 1 wordt kleiner**: volledig zonder AI, zonder white-label — enkel de kernflow, robuust en foutloos. **[v3] Uitzondering: de interface wordt vanaf v1 volledig meertalig (NL/FR/EN) opgebouwd — een bewuste, expliciete keuze van de initiatiefnemer die afwijkt van de oorspronkelijke "NL-only"-aanbeveling. Dit is taalinfrastructuur, geen AI-experiment, en blijft dus binnen het risicoprofiel dat de council aanvaardbaar achtte — maar het voegt reële bouwtijd toe aan fase 2.**
2. **Conflictdetectie op elementniveau** inbouwen in het datamodel, ook al wordt volledige multi-device-ondersteuning pas later gebouwd.
3. **Externe tijdstempel (RFC 3161)** toevoegen aan de bewijsvoering, naast de bestaande sha256-hashes.
4. **Nederland vóór Frankrijk** als tweede markt — kleinere regelgevende en taalkundige drempel.
5. **Makelaars binnen 3–6 maanden** betrekken, niet pas na 12 maanden.
6. **Crashrapportage en lokaal databankherstel** vanaf dag één inbouwen — niet-onderhandelbaar bij een offline-first app gebouwd door een niet-developer.
7. **Realistischer tijdslijn**: 9–12 maanden tot eerste externe betalende klant, niet 6–9.
8. Onderschatte kosten expliciet benoemd: support (min. 15% van de tijd), AI-kosten, legal/compliance, app store-onderhoud.

---

## 1. Wie stelt dit voor

De initiatiefnemer werkt sinds 2019 bij een Belgisch vastgoedinspectiebedrijf (EPC-certificaten, asbestinventarissen, elektrische keuringen, plaatsbeschrijvingen, e.d.) in een rol die boekhouding, ERP-beheer en klantcontact combineert, en die tijdens de snelle groei van het bedrijf via meerdere overnames de functionele specificaties voor ontwikkelaars schreef. Geen formele ontwikkelaarsachtergrond, wel sterk IT-inzicht; ervaring met no-code (Lovable) en werkt nu met Claude Code voor codegeneratie onder begeleiding.

Het product wordt gebouwd en verkocht via een eigen vennootschap (een commanditaire vennootschap), los van de werkgever. De werkgever zou eerste klant en reseller worden; de eigendoms- en resellerafspraak wordt door de initiatiefnemer zelf met de zaakvoerder geregeld.

Langetermijndoel: onafhankelijkheid van een werkgever door een verkoopbare business met recurring revenue op te bouwen.

---

## 2. Het probleem

Een plaatsbeschrijving (FR: état des lieux) is een gedetailleerde, contradictoire vaststelling van de staat van een huurwoning bij intrede en bij uittrede. Ze bepaalt bij het einde van de huur wie verantwoordelijk is voor welke schade. In België is ze wettelijk verplicht bij verhuur; in Frankrijk eveneens, met strengere vormvereisten.

Vastgestelde pijnpunten in de praktijk:
- Vaak nog op papier of met generieke foto-apps; het rapport wordt achteraf op kantoor uitgetypt (dubbel werk, fouten).
- Geen betrouwbare offline werking bij bestaande digitale tools, terwijl kelders, nieuwbouw en landelijke woningen vaak geen dekking hebben.
- Bij uittrede moet de plaatsbeschrijver handmatig de intrede-vaststellingen naast de huidige staat leggen; verschillen worden gemist of onvolledig gedocumenteerd.
- Foto's zijn niet gestructureerd gekoppeld aan een specifiek element (welke muur, welke ruimte), wat bewijskracht ondergraaft bij geschillen.
- Rapporten komen laat bij huurder en verhuurder aan; geschillen ontstaan uit onduidelijkheid over wat precies is vastgesteld en ondertekend.

---

## 3. De oplossing in één alinea

Een mobiele app (iOS/Android) waarmee een plaatsbeschrijver een plaatsbeschrijving volledig offline uitvoert — ruimte per ruimte, met gestructureerde vaststellingen en foto's gekoppeld aan elk element — waarna huurder en verhuurder ter plaatse ondertekenen en eigen opmerkingen toevoegen. Bij verbinding synchroniseert alles naar een server, waarna een professioneel PDF-rapport wordt gegenereerd en automatisch naar alle partijen wordt gemaild. **[v2] AI-functies worden pas na een stabiele, bewezen kernversie gefaseerd toegevoegd** — eerst laag-risico toepassingen (meterstand-OCR, spraak-naar-tekst), pas daarna schadebeschrijving en verschilherkenning. **[v3] De interface zelf (NL/FR/EN) is vanaf versie 1 volledig meertalig** — dit is losgekoppeld van de marktvolgorde: eerst België (waar NL én FR al vanaf dag één nodig zijn, gezien de werkgever ook Brussel en Wallonië bedient), daarna Nederland, pas daarna Frankrijk als markt (met eigen wettelijke vormvereisten, niet enkel een taalkwestie).

---

## 4. Doelgroep en markt

**Primair (eerste 3–6 maanden) [v2: makelaars niet langer uitgesteld naar maand 12]**
- Vastgoedinspectiebedrijven in België (de werkgever als eerste, daarna — indien de eigendomsafspraak dit toelaat — andere inspectiebedrijven)
- Vastgoedmakelaars en syndici die zelf plaatsbeschrijvingen uitvoeren, actief betrokken vanaf maand 3–6 in plaats van pas na het eerste jaar: grotere volumemarkt, mogelijk snellere sales-cyclus

**Secundair**
- Rentmeesters, sociale huisvestingsmaatschappijen (veel volume, langere sales-cyclus)

**Later [v2: Nederland vóór Frankrijk]**
- Nederlandse markt (zelfde taal, vergelijkbaar rechtssysteem, lagere juridische en support-drempel)
- Franse markt pas daarna — vastgoedbeheerders, agences immobilières, onafhankelijke diagnostiqueurs; grotere markt maar gevestigde concurrenten en strengere, complexere vormvereisten

Marktinschatting (aanname, nog te valideren): België telt honderdduizenden huurcontracten per jaar met telkens twee plaatsbeschrijvingen (intrede/uittrede). Zelfs een klein marktaandeel bij professionele uitvoerders is economisch relevant.

**Realiteitscheck concurrenten-als-klant**: een inspectiebedrijf dat rechtstreeks concurreert met de werkgever zal zelden software kopen van iemand die er werkt. Reken dit kanaal niet hard in de omzetprojectie; behandel het als opportuniteit, niet als plan.

---

## 5. Beoogd onderscheid t.o.v. bestaande tools — gerangschikt naar commerciële waarde

1. **Echte offline-first werking** — tastbaarste dagelijkse pijnpunt; als dit foutloos werkt, is dit op zich al reden om te wisselen van papier of onbetrouwbare tools.
2. **Bewijskracht by design** — elke foto gehasht en gekoppeld aan een specifiek element, handtekeningen met hash van de exacte inhoud die getekend werd, onveranderbaar rapport met hash **[v2] + extern tijdstempel (RFC 3161)**. Rechtstreeks ROI-argument tegen geschillen.
3. **Vakkennis in de templates** — templates en formuleringen komen van ervaren plaatsbeschrijvers. Onderschatte troef: verlaagt onboardingdrempel en voelt "af" aan voor professionele gebruikers.
4. **AI-verschilherkenning intrede/uittrede** *(v2: verschoven naar latere fase)* — sterk marketingargument maar hoog risico bij onnauwkeurigheid; pas bouwen op een stabiel platform.
5. **AI-schadebeschrijving vanuit foto's** *(v2: verschoven naar latere fase)* — waardevol maar secundair.
6. **White-label rapporten en mails** *(v2: uit versie 1)* — tafelstakes, geen echt onderscheid; makelaars verwachten dit uiteindelijk wel.

---

## 6. Functionele scope [v2 — volledig herzien]

### Versie 1 — "Heroic MVP" (robuuste kern, geen AI)

Uitsluitend gericht op een foutloze offline-flow en betrouwbare bewijsvoering:

- Inspectie uitvoeren offline, ruimte per ruimte, via templates per ruimtetype (vaste basiselementen + uitbreidingen per type)
- Per element: toestand, beschrijving, sub-attributen, foto's (verplicht bij afwijking) — **structuur gekoppeld aan element, geen AI-interpretatie**
- Intrede én uittrede vanaf het begin; bij uittrede wordt de intrede-structuur gekopieerd en per element naast elkaar getoond
- Meterstanden en sleutels
- Betrokken partijen (huurder, verhuurder, vertegenwoordigers, makelaar)
- Ondertekening op het toestel met opmerkingenveld per ondertekenaar
- Vergrendeling na ondertekening
- **Robuuste sync met conflictdetectie op elementniveau** (zie sectie 7) — dit is de kern waar de meeste bouwtijd naartoe gaat
- PDF-rapport, automatische mailing naar alle partijen met logging
- **[v3] Volledig meertalige interface (NL/FR/EN) vanaf v1** — zowel de app-chrome (knoppen, meldingen, foutmeldingen) als de templates en rapporten; taalkeuze per gebruiker en per inspectie (zie datamodel 3.1-3.2 en UX-richtlijnen C.3). Geen white-label.
- **[v4] Backoffice: plannen en toewijzen** (Flow F) — dispatcher-rol maakt en wijst inspecties toe; niet enkel de mobiele app
- **[v5] Backoffice: klant stelt eigen ruimtetemplates en rapport-inleiding samen** (Flow F.2) — eigen ruimtes met eigen standaardtekst per taal toevoegen, eigen inleidende tekst naast de vaste wettelijke tekst (zie 3.5c-3.5d)
- **[v6] Backoffice: klant beheert zichzelf verder** — eigen medewerkers uitnodigen (Flow F.3), logo/afzendergegevens/mailondertekening invullen (Flow F.4, rendering van logo/afzender pas actief in v2), panden bulk-importeren via CSV (Flow F.5), eigen bewaartermijn instellen binnen een toegelaten marge
- **[v7] Opmerkingenkanaal voor partijen na aflevering** (Flow G + F.6) — huurder/verhuurder kan via een beveiligde link zonder account opmerkingen geven per element of algemeen, binnen een instelbaar venster (standaard 14 dagen); organisatie volgt dit op in de backoffice. Dit is geen extra maar wat de wettelijke tekst (3.5c) zelf al belooft ("via het ondertekenplatform")
- **Geen enkele AI-functie**

### Versie 1.x — gefaseerde AI-introductie (na bewezen, stabiele kern)

Volgorde, laag risico naar hoog risico:
1. **Meterstand-OCR** en **spraak-naar-tekst tijdens de rondgang** — hoge nauwkeurigheid, directe tijdswinst, laag risico (geen interpretatie, enkel transcriptie/lezing)
2. **AI-schadebeschrijving vanuit foto's** — als voorstel met verplichte menselijke goedkeuring, nooit automatisch overgenomen
3. **AI-verschilherkenning intrede/uittrede** — het "vlaggenschip"-argument, maar pas bouwen op een bewezen platform met voldoende pilotdata

### Versie 2+

- Koppeling met ERP-systemen van klanten
- Meerdere plaatsbeschrijvers op één inspectie (volledige multi-device-ondersteuning; het datamodel sluit dit vanaf v1 niet uit, zie sectie 7)
- White-label rapporten en mails (rendering — de gegevens zelf worden al in v1 verzameld via Flow F.4)
- Standaard clausule-bibliotheek voor snellere rapportaanpassing
- Digitale schets/plattegrond om schadelocaties visueel aan te duiden

### Bewust buiten scope (voorlopig)

**[v3] Let op het onderscheid**: de taal van de interface (NL/FR/EN) zit vanaf v1 in scope (zie hierboven) — wat hier buiten scope blijft is het **Frans wettelijk kader als markt** (état-des-lieux-specifieke vormvereisten, regionale regelgeving), niet de Franse taal zelf. Verder buiten scope: klantenportaal met login voor verhuurders/huurders, facturatie in de app, video-opname (opslag- en complexiteitskost te hoog voor de waarde in v1).

---

## 7. Technische architectuur [v2 — aangevuld]

**Frontend**: React + TypeScript + Vite, verpakt in Capacitor voor iOS en Android vanuit één codebase. **[v3]** i18n via `i18next`/`react-i18next` voor app-chrome (zie datamodel 3.5b); PDF-generatie en mailtemplates lezen dezelfde vertaalbestanden zodat rapport, app en mail nooit uit sync raken qua terminologie.

**Lokale opslag**: SQLite via Capacitor-plugin; foto's als gecomprimeerde JPEG-bestanden op het toestel (max 2048 px lange zijde, ~1,5 MB).

**Backend**: Supabase (Postgres, Auth, Storage, Edge Functions) in een EU-regio. Row Level Security per klantorganisatie (multi-tenant vanaf dag één).

**Sync**: lokale wachtrij (sync_queue) die elke wijziging registreert; bij verbinding wordt de wachtrij in vaste volgorde verwerkt (eerst data, dan bestanden), per item bevestigd, met retry.

**[v2] Conflictstrategie — herzien**: last-write-wins per rij volstaat niet als enige regel. Faalscenario dat de council aanhaalde: een plaatsbeschrijver valt uit (ziekte, technisch defect) en een collega zet de inspectie voort op een ander toestel — sync kan dan een beschadigd of onvolledig rapport opleveren. Nieuwe aanpak:
- Conflictdetectie op **elementniveau**: als twee toestellen hetzelfde `room_element` wijzigden vóór sync, wordt dit gemarkeerd als conflict in plaats van stilzwijgend overschreven.
- Conflicten verschijnen in een expliciet review-scherm; een admin/plaatsbeschrijver kiest welke versie geldig is vóór de inspectie verder kan naar `signed`.
- Het datamodel ondersteunt dit vanaf v1 (zie datamodel sectie 3.7 en 3.16), ook al is de volledige multi-device-UI pas gepland voor versie 2.

**[v2] Crashrapportage en herstel — nieuw, niet-onderhandelbaar**:
- Crash- en foutrapportage (bv. Sentry) vanaf de eerste testversie geïntegreerd — essentieel om offline-gerelateerde bugs te kunnen debuggen zonder dat de gebruiker het zelf moet uitleggen.
- Lokaal databankherstel-mechanisme: periodieke lichte back-up van de lokale SQLite-data (bv. naar het reguliere toestel-back-upsysteem van iOS/Android), puur als rampherstel bij databankcorruptie — niet als synchronisatiemechanisme.

**AI**: server-side via Claude API, uitsluitend na sync en uitsluitend vanaf versie 1.x (zie sectie 6). Output wordt als aparte suggestie-rij opgeslagen met model, promptversie en tokenkosten; de plaatsbeschrijver accepteert, bewerkt of verwerpt. Prompts verbieden expliciet uitspraken over oorzaak of schuld.

**PDF**: server-side generatie, hash opgeslagen.

**Mail**: transactionele maildienst met leverstatus-logging.

**Bewijsvoering [v2 — aangevuld]**: sha256 op elke foto en handtekening; hash van de volledige inspectiedata op het moment van tekenen, opgeslagen in elke handtekening; **extern, vertrouwd tijdstempel (RFC 3161) op de hash van het finale rapport** — bewijst niet enkel dat de data ongewijzigd is, maar ook wanneer ze bestond; audit log server-side via triggers; soft deletes overal. Gekwalificeerde elektronische handtekening (eIDAS) wordt niet gebouwd in v1 — vermoedelijk overkill — maar een kort juridisch consult (Belgisch vastgoedjurist) valideert deze aanpak vóór de pilot.

Datamodel (bijgewerkt, zie apart document): organizations, users, user_invitations, properties, inspections, room_templates, rooms, room_elements (met conflictvelden), photos, ai_suggestions, inspection_parties, signatures, meter_readings, keys, reports (met tijdstempelvelden), mail_log, report_party_access, report_comments, sync_queue (lokaal, met conflictstatus), audit_log (server).

---

## 8. AI-toepassing in detail [v2 — herordend naar risico, gefaseerd na v1]

| Fase | Touchpoint | Input | Output | Risico |
|---|---|---|---|---|
| 1.x-a | Meterstand-OCR | foto van meter | uitgelezen waarde ter bevestiging | laag — pure herkenning, geen interpretatie |
| 1.x-a | Spraak-naar-tekst | audio tijdens rondgang | transcript in beschrijvingsveld | laag — transcriptie, geen interpretatie |
| 1.x-b | Foto → schadebeschrijving | foto + ruimtetype + elementtype | JSON: toestand, beschrijving, zekerheid | middel — altijd voorstel, verplichte goedkeuring |
| 1.x-c | Verschilherkenning | intrede/uittrede-data + foto's | JSON: verschil ja/nee, samenvatting, ernst | hoger — pas bouwen op bewezen platform |

Harde regel, ongewijzigd: AI beschrijft enkel wat zichtbaar is. Aansprakelijkheid wordt uitsluitend door een mens ingevuld, nooit door AI.

Kostenbeheersing: enkel foto's bij elementen met een afwijkende toestand gaan naar de AI; Claude Vision-kosten worden per inspectie gemonitord met een harde drempelwaarde.

---

## 9. Businessmodel

**Prijsmodel**: hybride — een maandabonnement per organisatie met een inbegrepen aantal inspecties (tier-gebaseerd), plus een overage-tarief per extra inspectie boven de tier. Voorspelbare recurring revenue (belangrijk voor een latere verkoop) gecombineerd met bescherming tegen volumepieken in kosten (opslag, mailing).

**[v2] Onderschatte kosten, expliciet benoemd**:
- **Klantensupport**: reken minstens 15% van de beschikbare tijd na lancering — plaatsbeschrijvers bellen bij problemen, ze mailen niet.
- **AI-kosten**: Claude Vision is niet verwaarloosbaar; strikte monitoring en gebruiksdrempels per inspectie zijn niet optioneel.
- **Legal & compliance**: GDPR-verwerkersovereenkomsten, mogelijk beroepsaansprakelijkheidsverzekering.
- **App store-onderhoud**: jaarlijkse ontwikkelaarskosten en doorlooptijd van reviewprocessen bij elke update.

**Verkoopkanalen**, in volgorde: (1) werkgever als eerste klant en reseller, (2) makelaars en syndici — **[v2] vanaf maand 3–6, niet uitgesteld**, (3) andere inspectiebedrijven indien de eigendomsafspraak dit toelaat, (4) rentmeesters en sociale huisvesting, (5) Nederland, (6) Frankrijk.

**Exit-voorbereiding vanaf dag één**: zuivere eigendom van code en merk in de eigen vennootschap, maandelijkse cijfers (klanten, inspecties, omzet, kosten, churn), gedocumenteerde codebase, geen afhankelijkheid van één persoon voor technisch onderhoud.

---

## 10. Plan en tijdslijn [v9 — tijdlijn eerlijk herzien naar werkelijke v1-scope]

**Wat hier veranderde en waarom**: fase 2 beschreef tot nu toe enkel de oorspronkelijke Heroic MVP-kern. Sindsdien werden meertaligheid (v3), de volledige backoffice Flow F.1-F.6 (v4-v6) en de partijen-opmerkingenpagina Flow G (v7) allemaal als "versie 1" vastgelegd — zonder dat de tijdlijn dat weerspiegelde. Onderstaande cijfers doen dat nu wel.

| Fase | Inhoud | Richting |
|---|---|---|
| 0 | Eigendomsafspraak, validatiegesprekken, concurrentieanalyse, GDPR/verwerkersovereenkomst, naam, kort juridisch consult elektronische handtekening | 2–4 weken |
| 1 | MVP-scope (Heroic MVP + meertaligheid + backoffice, geen AI), datamodel incl. conflictvelden, userflows, templates | 1–2 weken |
| 2 | Technische basis via Claude Code — zie opsplitsing hieronder | **18–24 weken** *(4-6 maanden — eerlijk bijgesteld, was 8-12 weken vóór v3-v7)* |
| 3 | Pilot bij 2–3 klanten via werkgever, plus eerste makelaarscontacten opstarten, 6–8 weken, wekelijkse feedback, meting tijdswinst en geschillen | 4–8 weken |
| 4 | Afwerking, prijszetting, website, support, commercialisering België (inspectiebedrijven + makelaars) | 4–6 weken |
| 5 | Gefaseerde AI-introductie (OCR/spraak → foto-beschrijving → verschilherkenning), telkens op basis van stabiliteit en feedback | doorlopend, na fase 4 |
| 6 | Nederland | na 6+ maanden Belgische omzet |
| 7 | Frankrijk | na stabiele Nederlandse werking |

**[v9] Opsplitsing van fase 2** (18-24 weken), zodat de schatting navolgbaar is in plaats van één ondoorzichtig blok:

| Onderdeel | Richting |
|---|---|
| Kernflow plaatsbeschrijver (Flow A-E): lokale DB, inspectieflow, foto's, ondertekening, server-schema, sync met conflictdetectie, uittrede-koppeling, PDF, crashrapportage | 8–10 weken |
| Backoffice Flow F.1-F.6: plannen/toewijzen, ruimtetemplates + rapport-inleiding, gebruikersbeheer, branding/bewaartermijn/mailondertekening, CSV-import, opmerkingen opvolgen | 4–6 weken |
| Meertalige infrastructuur (NL/FR/EN): i18n-laag, vertaalde templates, meertalige PDF/mail | 2 weken |
| Flow G: partijen-opmerkingenpagina + koppeling met F.6 | 2–3 weken |
| Geïntegreerd testen (offline-scenario's, sync-conflicten, meertalige rapporten, volledige flow A t.e.m. G) | 2 weken |

Deze onderdelen lopen deels na elkaar (de kernflow moet eerst werken vóór de backoffice er zinvol tegenaan kan bouwen), deels parallel te plannen (meertalige infrastructuur kan je vroeg meenemen terwijl de kernflow nog groeit) — de 18-24 weken is de realistische som, niet een optimistische parallelle schatting.

Beschikbare tijd: 8–12 uur per week naast een voltijdse job. **[v9] Verwachte doorlooptijd tot eerste betalende klant buiten de werkgever: 11–15 maanden** (bijgesteld van 9–12 — de uitgebreide fase 2 alleen al voegt zo'n 10-12 weken toe t.o.v. de vorige schatting). Communiceer 11–15 maanden extern; behandel het onderste einde als intern stretch-doel, niet als belofte.

**[v9] Een eerlijke vraag om jezelf te stellen vóór je hieraan begint**: dit is nu een aanzienlijk groter eerste product dan wat een "MVP" doorgaans betekent. Dat is een geldige keuze — zelfbediening voor klanten heeft duidelijke waarde — maar het is de moeite waard om bewust te bevestigen dat 11-15 maanden aanvaardbaar is, in plaats van er tegen fase 3 achter te komen dat het tempo niet haalbaar blijkt.

---

## 11. Bekende risico's en aannames [v2 — aangevuld]

1. **Technische overambitie (hoofdrisico volgens de council)**: offline-sync én AI tegelijk bouwen als solo niet-developer is de meest waarschijnlijke faalfactor. Mitigatie: AI volledig uit v1, gefaseerde introductie pas na bewezen stabiliteit.
2. **Multi-device conflictscenario [v2 — nieuw]**: een plaatsbeschrijver valt uit, een collega neemt over op een ander toestel, sync levert een beschadigd of onvolledig rapport op. Mitigatie: conflictdetectie op elementniveau vanaf v1, ook zonder volledige multi-device-UI.
3. **Offline-first blijft technisch het zwaarste stuk**: sync-conflicten, mislukte uploads, volle toestellen, zwakke verbindingen op landelijke locaties. Mitigatie: vergrendeling na ondertekening, hervatbare uploads, expliciet testen met gethrottelde verbinding (niet enkel vliegtuigmodus aan/uit).
4. **Databankcorruptie op het toestel [v2 — nieuw]**: zonder herstelmechanisme kan een volledige inspectie verloren gaan. Mitigatie: periodieke lichte lokale back-up.
5. **AI-fouten in juridisch gevoelige context**: uitgesteld risico nu AI pas in latere fases komt, maar blijft relevant zodra ze geïntroduceerd wordt. Aansprakelijkheid nooit door AI.
6. **Concurrentie**: in Frankrijk gevestigde spelers; in België minder, maar instap door buitenlandse spelers mogelijk.
7. **Belangenconflict met werkgever**: contractueel te regelen.
8. **Juridische geldigheid van handtekening op toestel**: gewone elektronische handtekening; versterkt met RFC 3161-tijdstempel; te bevestigen met een kort juridisch consult.
9. **Aanname betalingsbereidheid**: te testen vóór fase 2 start, niet pas in de pilot — vraag nu al aan 2–3 potentiële klanten wat ze zouden betalen.
10. **Opslagkosten op lange termijn**: 10 jaar foto's bewaren. Mitigatie: compressie, tiered storage, eventueel meerprijs voor langere bewaring.
11. **Onderschatte supportlast en operationele kosten [v2 — nieuw]**: minstens 15% van de beschikbare tijd na lancering, plus legal/compliance en app store-onderhoud — expliciet meerekenen in de tijdsbudgettering.

---

## 12. Openstaande vragen vóór fase 2 start

1. Vraag aan 2–3 potentiële klanten (buiten de werkgever): "als dit bestond zoals hierboven beschreven — zonder AI, met een robuuste offline-flow en sterke bewijsvoering — wat zou je ervoor betalen per maand?" Dit antwoord vóór de volle 18-24 weken van fase 2 geïnvesteerd worden, is de belangrijkste validatie die nog ontbreekt.
2. **[v3]** Engels is toegevoegd naast NL/FR "ongeacht extra bouwtijd" — controleer vóór fase 2 of er een concrete, nabije reden is voor EN (bv. een internationale vastgoedspeler in het klantenbestand), of dat het voorlopig enkel infrastructuur is die klaarstaat maar leeg blijft. Dat verandert niets aan de architectuur (die is sowieso taal-agnostisch opgezet, zie 3.5/3.5b), maar wél aan hoeveel tijd je nu al steekt in het effectief vertalen van content naar het Engels versus dat uitstellen tot er een concrete klant is.

---
