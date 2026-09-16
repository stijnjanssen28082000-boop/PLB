# DEEL D — TEST- EN PRODUCTIEOMGEVING

## D.1 Waarom dit vanaf het begin wordt opgezet, niet achteraf

Dit is geen consumenten-app waar een bug in productie enkel vervelend is — hier staan echte adressen, echte huurders/verhuurders, echte handtekeningen en (na de pilot) echte klantfacturatie. Zonder scheiding tussen test en productie loop je concrete risico's: een testinspectie die per ongeluk in het echte dossier van een klant terechtkomt, een testmail die naar een echte huurder gaat, of AI-testkosten die oplopen omdat er geen apart, beperkt budget is. Zet de scheiding op vóór de eerste pilot-klant, niet erna.

## D.2 Drie omgevingen, niet twee

| Omgeving | Doel | Wie gebruikt ze |
|---|---|---|
| **Development (lokaal)** | Dagelijks bouwen en itereren met Claude Code | Enkel jij, op je eigen toestel/simulator |
| **Test/staging** | Functioneel testen, jezelf en later de pilot-klanten die bewust "test" gebruiken, interne demo's | Jij + eventueel 1-2 vertrouwde testers bij de werkgever |
| **Productie** | Echte klanten, echte plaatsbeschrijvingen, echte data | Pilot-klanten (fase 4) en alle klanten daarna |

Twee omgevingen (enkel test+productie) is te weinig omdat je anders tijdens dagelijks ontwikkelen al tegen de "test is ook een beetje heilig"-spanning aanloopt. Development is bewust wegwerpbaar: database mag je gerust platgooien en herbeginnen.

## D.3 Backend: aparte Supabase-projecten per omgeving

Maak **twee Supabase-projecten** aan (development draait lokaal via de Supabase CLI, dus die heeft geen apart cloud-project nodig):

- `plaatsbeschrijving-test` — eigen Postgres-database, eigen Storage-buckets, eigen Auth
- `plaatsbeschrijving-productie` — volledig gescheiden, andere API-keys, EU-regio

**Waarom volledig aparte projecten, geen "test"-schema binnen één project**: één ontbrekende `WHERE environment = 'test'` in een query, en testdata lekt in productie of omgekeerd. Twee aparte projecten maken dat structureel onmogelijk — de API-key zelf bepaalt al met welke database je praat.

Elk project krijgt zijn eigen migratiehistoriek, maar **exact hetzelfde schema** (zie Deel B) — migraties worden altijd eerst op test uitgevoerd, pas na verificatie op productie. Claude Code past het schema aan in `supabase/migrations/`, en jij voert `supabase db push` uit tegen het gewenste project (via de `--project-ref`-vlag of door van omgeving te wisselen met de Supabase CLI).

## D.4 Configuratie en secrets per omgeving

- Twee `.env`-bestanden in de repo: `.env.test` en `.env.production` (nooit gecommit — in `.gitignore`), met telkens de eigen Supabase-URL, anon key, en indien nodig de Anthropic API-key voor AI-calls.
- Capacitor ondersteunt build-varianten: bouw de app met een build-flag (bv. `--configuration=test` / `--configuration=production`) zodat één codebase naar beide omgevingen kan wijzen zonder de code zelf aan te passen per build.
- **Regel voor Claude Code**: nooit een Supabase-key hardcoded in de broncode — altijd via de environment-configuratie, ook niet "tijdelijk om te testen."

## D.5 Duidelijk visueel onderscheid in testbuilds

Een testbuild moet **onmogelijk te verwarren zijn met productie**, zelfs voor jezelf na een lange dag:
- Een permanente, opvallende banner bovenaan elk scherm in de testbuild (bv. rode achtergrond, "TESTOMGEVING"), die nooit in de productiebuild verschijnt.
- Een ander app-icoon voor de testversie (bv. met een duidelijke kleur-overlay), zodat je op je toestel in één oogopslag ziet welke app je opent.
- De app-naam op het toestel zelf verschilt (bv. "Plaatsbeschrijving TEST" vs. "Plaatsbeschrijving").

## D.6 Mobiele distributie: test vs. productie

| | iOS | Android |
|---|---|---|
| **Test** | TestFlight — tot 100 interne testers zonder App Store-review, updates verschijnen binnen enkele minuten | Google Play **interne testtrack** — vergelijkbaar, geen publieke review nodig |
| **Productie** | App Store — volle review (1-3 dagen), publiek zichtbaar | Google Play **productietrack** — review (meestal < 1 dag), publiek zichtbaar |

Voor de pilot (fase 4) gebruik je **TestFlight en de interne Android-testtrack** — je klanten bij de werkgever installeren dus een testbuild, geen publieke App Store-versie. Dat is bewust: zo kan je razendsnel fixes uitrollen tijdens de pilot zonder telkens op een store-review te wachten. Pas bij fase 5 (commercialisering) ga je naar de publieke stores.

**Praktisch**: je hebt sowieso een Apple Developer-account (99 USD/jaar) en een Google Play Developer-account (eenmalig 25 USD) nodig, op naam van Monét BV — dit is een kost die in fase 5 van het businessplan al vermeld staat onder "app store-onderhoud", maar de account zelf moet je al vóór de pilot aanmaken, want de goedkeuring van een nieuw Apple-ontwikkelaarsaccount kan enkele dagen duren.

## D.7 Mailing: nooit een risico op een echte huurder in de testomgeving

Dit is het punt waar het structureel het vaakst misloopt bij een offline/sync-app met automatische mailing:

- In de **testomgeving** wordt de maildienst (Resend/Postmark) in **sandbox-modus** gebruikt, of gekoppeld aan een apart test-domein/API-key met een harde whitelist van toegestane ontvangers (bv. enkel jouw eigen e-mailadres en dat van je zaakvoerder).
- **Regel voor Claude Code**: de mail-verstuurfunctie controleert bij elke aanroep welke omgeving actief is; in test wordt elke uitgaande mail automatisch omgeleid naar het whitelisted testadres, met de oorspronkelijke ontvanger zichtbaar in het onderwerp (bv. "[TEST — origineel voor: jan@voorbeeld.be] Uw plaatsbeschrijving"). Dit voorkomt dat een testinspectie ooit een echte huurder bereikt, zelfs bij een menselijke vergissing tijdens het testen.
- Pas in productie gaat een mail naar het werkelijke e-mailadres van de partij.
- **[v6]** De mailtemplate voegt `organizations.mail_signature_translations` (3.1) onderaan toe, ook in de testomgeving — test dus met een ingevulde signature om te controleren dat de opmaak klopt vóór de eerste externe klant.
- **[v7]** Dit geldt ook voor de Flow G-link (opmerkingenpagina voor partijen) — in de testomgeving wordt ook die link omgeleid/beperkt tot de whitelist, zodat een testinspectie nooit een echte huurder een werkende opmerkingenlink stuurt.

## D.8 AI-kosten onder controle houden in de testomgeving

- Aparte Anthropic API-key voor test, met een lager, hard ingesteld uitgavenplafond (via de Anthropic Console) dan de productie-key.
- Tijdens dagelijks ontwikkelen en testen van de AI-touchpoints (fase 1.x) hoeft niet elke test een echte API-call te zijn — overweeg een eenvoudige "mock-modus" die vaste voorbeeldresponses teruggeeft, zodat je de flow honderden keren kan doorlopen tijdens het bouwen zonder telkens te betalen. Enkel de laatste verificatie vóór een release gebeurt met de echte API.

## D.9 Promotieflow: van development naar test naar productie

1. Je bouwt en test lokaal (development) met Claude Code, tegen een lokale Supabase-instantie (`supabase start`).
2. Zodra een module werkt: migraties en code naar de **test**-omgeving, zelf en eventueel met een collega-plaatsbeschrijver grondig uittesten — inclusief de offline-scenario's uit Deel C.
3. Pas na een stabiele periode in test (richting fase 4, de pilot) promoveer je dezelfde, geverifieerde migraties en build naar **productie**.
4. **Nooit** rechtstreeks vanuit development naar productie promoveren — test is de verplichte tussenstap, ook als "het maar een kleine fix is."

## D.10 Samenvatting — wat je concreet moet aanmaken vóór je met bouwen start

- [ ] Supabase-project `plaatsbeschrijving-test` (EU-regio)
- [ ] Supabase-project `plaatsbeschrijving-productie` (EU-regio) — mag later, niet dringend vóór fase 2
- [ ] Apple Developer-account op naam van Monét BV
- [ ] Google Play Developer-account op naam van Monét BV
- [ ] Maildienst-account met sandbox/test-modus (Resend of Postmark)
- [ ] Aparte Anthropic API-keys voor test en productie, met uitgavenplafonds ingesteld
- [ ] `.env.test` en `.env.production` template in de repo (leeg/placeholder, echte waarden nooit gecommit)

## D.11 Praktische implementatie met GitHub

### Branch-structuur

- **`main`** → weerspiegelt altijd wat in **productie** staat
- **`develop`** → weerspiegelt altijd wat in **test** staat
- **feature-branches** (bv. `feature/ruimte-inspectie-scherm`) → waar Claude Code per taak aan werkt, samengevoegd in `develop` via een pull request

### Secrets per omgeving: GitHub Environments

Gebruik de ingebouwde "Environments"-functie van GitHub (repo-instellingen → Environments). Maak twee environments aan, **test** en **productie**, en zet daar per omgeving de geheime waarden (Supabase-URL, Supabase-key, mail-API-key, Anthropic API-key) — nooit in code, nooit in een gecommit `.env`-bestand. Een workflow die naar test deployt heeft enkel toegang tot de test-secrets; een workflow die naar productie deployt enkel tot de productie-secrets. Dit is de praktische, afdwingbare versie van de scheiding uit D.3-D.4.

### Automatische deploys: twee GitHub Actions-workflows

In `.github/workflows/`:

- **`deploy-test.yml`** — triggert bij elke merge naar `develop`: voert `supabase db push` uit tegen het test-project (met de test-environment-secrets) en bouwt een nieuwe testversie van de app.
- **`deploy-productie.yml`** — triggert bij elke merge naar `main` (of bij het aanmaken van een versietag — voorzichtiger, want expliciet): dezelfde stappen, tegen het productieproject.

### Dagelijkse flow

1. Claude Code werkt op een feature-branch aan een specifieke taak.
2. Pull request naar `develop`.
3. Bij samenvoegen: `deploy-test.yml` pusht automatisch de databankmigraties naar test en bouwt een nieuwe testversie.
4. Testen op een echt toestel via TestFlight/Play interne testtrack.
5. Werkt het: pull request van `develop` naar `main` → `deploy-productie.yml` deployt automatisch naar productie.

### Nuance: mobiele builds zijn het lastigste stukje CI/CD hier

Het Supabase-gedeelte (migraties pushen) automatiseer je vlot met een GitHub Action. De iOS/Android-app zelf bouwen en naar TestFlight/Play sturen vanuit een Action is ook haalbaar, maar vraagt certificaten en signing-sleutels correct als GitHub secrets te zetten (typisch via Fastlane) — dat is het meest foutgevoelige onderdeel om als eerste te automatiseren.

**Aanbeveling voor de eerste maanden**: automatiseer enkel de Supabase-migraties via GitHub Actions; bouw en upload de mobiele app in het begin handmatig via Xcode/Android Studio. Voeg Fastlane pas toe zodra je vaker gaat releasen, richting de pilot (fase 4).

### Eerste concrete opdracht voor Claude Code

Dit kan los van de eigenlijke app-schermen als allereerste stap: "Zet een GitHub Actions-workflow op die bij een merge naar develop de migraties naar mijn test-Supabase-project pusht, volgens Deel D van dit document." Dat legt meteen de scheiding tussen test en productie vast vóór er ook maar één scherm gebouwd wordt.

## D.12 Gefaseerde platformuitrol: eerst Android, iOS pas tegen fase 5 [v8, nieuw]

**Aanleiding**: de initiatiefnemer heeft momenteel geen Mac. Xcode (verplicht voor iOS-builds) draait enkel op macOS. In plaats van dit meteen op te lossen, wordt de behoefte zelf uitgesteld tot het moment dat ze er echt is.

**Kernredenering — waarom dit kan zonder risico**:
- Enkel de **plaatsbeschrijver-app** (Flow A-E) heeft een native iOS/Android-build nodig. De backoffice (Flow F.1-F.6) en de opmerkingenpagina voor partijen (Flow G) zijn pure webpagina's — die vragen nooit een App Store of Play Store, op geen enkel moment.
- Tijdens fase 2 (bouwen) en fase 4 (pilot bij de werkgever) bepaalt **de werkgever zelf welk toestel** de plaatsbeschrijvers gebruiken. Als dat Android is, hoeft er in die fases geen enkele iOS-build te bestaan.
- iOS wordt pas een harde vereiste vanaf **fase 5** (publieke commercialisering), zodra klanten hun eigen personeel met eigen toestellen laten werken en je niet langer kan voorschrijven welk platform ze gebruiken. Makelaars en hun medewerkers gebruiken in de praktijk vaak wél iPhones, dus dit mag niet blijven liggen — het is uitgesteld, niet geschrapt.

**Concrete fasering**:

| Fase | Platform | Wat je nodig hebt |
|---|---|---|
| 2 (bouwen) | Android + browser | Android Studio (werkt op elk besturingssysteem), `npm run dev` voor snelle webtests |
| 4 (pilot, werkgever) | Android (indien de werkgever daarvoor kiest) | Zelfde als hierboven — geen Mac |
| Vóór fase 5 (commercialisering) | iOS toevoegen | Zie hieronder |

**Wat je vóór fase 5 concreet regelt voor iOS** (geen Mac-aankoop nodig):

Gebruik een cloud-CI-dienst die de Xcode-build in de cloud draait, gekoppeld aan je GitHub-repo (zelfde soort automatisering als de GitHub Actions uit D.11, maar dan met een macOS-machine inbegrepen):
- **Codemagic** — heeft een gratis tier, specifiek gebouwd voor dit soort projecten (Capacitor/React Native), beheert certificaten/signing via je Apple Developer-account, kan automatisch naar TestFlight uploaden.
- Alternatief: GitHub Actions' eigen macOS-runners + Fastlane — werkt ook, vraagt meer eigen configuratie.

**Regel voor Claude Code**: bouw de Capacitor-iOS-configuratie wel al vroeg mee op (het kost weinig extra tijd als je toch de Android-configuratie opzet), maar activeer/test de iOS-pijplijn pas wanneer dat nodig wordt. Zo sta je niet voor een verrassing wanneer fase 5 nadert.
