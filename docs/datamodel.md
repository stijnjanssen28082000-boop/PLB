# DEEL B — DATAMODEL

Referentiedocument voor ontwikkeling. Elke module die gebouwd wordt, verwijst naar dit document. Wijzigingen aan het datamodel gebeuren eerst hier, daarna in de code.

**Wijzigingen in v2** (naar aanleiding van council-feedback op het conceptdocument):
- `room_elements` en `sync_queue`: conflictdetectie op elementniveau toegevoegd (last-write-wins alleen was onvoldoende bij een uitvalscenario met een tweede toestel).
- `reports`: velden voor een extern, vertrouwd tijdstempel (RFC 3161) toegevoegd, naast de bestaande sha256-hash.
- Nieuwe tabel `device_sync_sessions` voor eenvoudiger opvolging van welk toestel wanneer synchroniseerde — ondersteunt de conflictdetectie.
- Versie-1-bouwvolgorde (sectie 6) aangepast: AI-gerelateerde tabellen (`ai_suggestions`) worden pas vanaf fase 1.x gevuld; het schema bestaat vanaf v1 maar blijft leeg tot AI geïntroduceerd wordt.

Conventies:
- Tabel- en kolomnamen in het Engels, snake_case (standaard in Postgres/SQLite en leesbaar voor Claude Code)
- Elke tabel heeft `id` (UUID v4, gegenereerd op het toestel — nodig voor offline aanmaak), `created_at`, `updated_at`
- Alle timestamps in UTC, ISO 8601
- Enums worden als tekst opgeslagen (geen Postgres ENUM-type) zodat lokale SQLite en server identiek blijven
- Soft delete via `deleted_at` (nullable) — niets wordt fysiek verwijderd, belangrijk voor bewijsvoering bij geschillen

---

## 1. Overzicht en relaties

```
organizations 1──∞ users
organizations 1──∞ user_invitations
organizations 1──∞ properties
organizations 1──∞ room_templates (+ globale templates met organization_id = NULL)
properties    1──∞ inspections
inspections   1──∞ rooms
inspections   1──∞ signatures
inspections   1──∞ inspection_parties
inspections   1──∞ meter_readings
inspections   1──∞ keys
inspections   1──1 reports
inspections   ∞──1 inspections (linked_inspection_id: uittrede → intrede)
rooms         ∞──1 room_templates
rooms         1──∞ room_elements
room_elements 1──∞ photos
room_elements 1──∞ ai_suggestions
photos        1──∞ ai_suggestions
reports       1──∞ mail_log
reports       1──∞ report_party_access
reports       1──∞ report_comments
sync_queue    (lokaal, verwijst naar elke entiteit)
```

---

## 2. Multi-tenancy en beveiliging

Vanaf dag één multi-tenant: elke rij die klantdata bevat heeft `organization_id`. Op Supabase wordt Row Level Security (RLS) afgedwongen: een gebruiker ziet enkel rijen van zijn eigen `organization_id`.

Uitzondering: `room_templates` met `organization_id = NULL` zijn globale standaardtemplates (beheerd door Monét BV), leesbaar voor iedereen, niet bewerkbaar door klanten. Klanten kunnen ze kopiëren naar een eigen template.

---

## 3. Tabellen

### 3.1 `organizations` — klantorganisaties

| Kolom | Type | Verplicht | Beschrijving |
|---|---|---|---|
| id | uuid | ja | |
| name | text | ja | Bedrijfsnaam |
| vat_number | text | nee | Btw-nummer |
| country | text | ja | `BE` / `FR` — bepaalt standaardtemplates en taal |
| default_language | text | ja | `nl` / `fr` / `en` — standaardtaal voor nieuwe gebruikers en communicatie binnen deze organisatie |
| logo_url | text | nee | **[v6]** Zelf te uploaden via Flow F.4. Opgeslagen en zichtbaar in de backoffice-preview vanaf v1, maar pas effectief in het PDF-rapport/mails gebruikt vanaf v2 (white-label blijft uitgesteld) — zie regel hieronder |
| report_sender_name | text | nee | **[v6]** Zelf in te vullen via Flow F.4, zelfde uitstel-regel als `logo_url` |
| report_sender_email | text | nee | **[v6]** Zelf in te vullen; vereist een aparte verificatiestap bij de maildienst (Resend/Postmark) vóór het effectief als afzender gebruikt kan worden — tot dan verstuurt het systeem vanaf een platform-standaardadres. Zie regel hieronder |
| mail_signature_translations | jsonb | nee | **[v6]** `{ "nl": "...", "fr": "...", "en": "..." }` — korte eigen ondertekening onderaan automatische mails (bv. "Met vriendelijke groeten, team [Klant]"), los van volledige white-label. Bewerkbaar via Flow F.4, **wél al actief in v1** (dit is geen white-label, enkel een tekstblok) |
| custom_intro_translations | jsonb | nee | **[v5]** `{ "nl": "...", "fr": "...", "en": "..." }` — eigen, door de klant geschreven inleidende tekst (bedrijfsvoorstelling, werkwijze), ingevoegd in het rapport **naast** de vaste wettelijke tekst uit 3.5c, nooit in de plaats ervan. Bewerkbaar via Flow F.2 (backoffice) |
| retention_years | integer | ja | **[v6]** Bewaartermijn, standaard 10, zelf aanpasbaar via Flow F.4 binnen een toegelaten marge (`retention_years_min`/`retention_years_max` — zie constraint hieronder) |
| comment_window_days | integer | ja | **[v7]** Aantal dagen dat partijen opmerkingen kunnen geven na ontvangst van het rapport, standaard 14 (bedrijfsbeleid, geen wettelijke verplichting — zie 3.15b). Zelf aanpasbaar via Flow F.4, marge 7-30 dagen |
| plan | text | ja | `pilot` / `starter` / `pro` — voor facturatie/limieten |
| created_at, updated_at, deleted_at | timestamptz | | |

**[v6] Regel voor Claude Code — logo/afzender**: sla `logo_url`/`report_sender_name`/`report_sender_email` vanaf v1 al op en toon ze in de Flow F.4-preview, maar gebruik ze pas effectief in de PDF-template en de mail-headers zodra white-label (versie 2) gebouwd wordt. Dit ontkoppelt "gegevens verzamelen" van "functie activeren" — de klant kan alvast alles invullen, zonder dat je de PDF-rendering nu al hoeft te bouwen.

**[v6] Regel voor Claude Code — bewaartermijn**: databank-constraint `retention_years BETWEEN 3 AND 15` (3 jaar als praktisch wettelijk minimum voor de meeste geschillen, 15 als redelijk maximum — laat een jurist dit bevestigen vóór de eerste externe klant, zie fase 0). Flow F.4 toont deze grenzen in de UI, geen vrij invoerveld zonder validatie.

### 3.2 `users` — gebruikers (plaatsbeschrijvers, dispatchers, admins) [v4 — rollen verduidelijkt]

Koppelt aan Supabase Auth via `auth_user_id`. **[v4]** Twee duidelijk gescheiden gebruiksprofielen, bevestigd door hoe een echte organisatie werkt: een **office manager/planner** die plaatsbeschrijvingen inplant en toewijst (backoffice, waarschijnlijk web-interface), en de **plaatsbeschrijver** die ter plaatse de inspectie uitvoert (mobiele app). Dit is geen latere uitbreiding maar het fundamentele onderscheid in de rechtenstructuur vanaf v1.

| Kolom | Type | Verplicht | Beschrijving |
|---|---|---|---|
| id | uuid | ja | |
| auth_user_id | uuid | ja | Verwijzing naar Supabase auth.users |
| organization_id | uuid | ja | FK organizations |
| full_name | text | ja | |
| email | text | ja | |
| role | text | ja | `admin` / `dispatcher` / `plaatsbeschrijver` / `viewer` — **[v4]** `inspector` hernoemd naar `plaatsbeschrijver`; `dispatcher` toegevoegd voor de backoffice-planningsrol (kan inspecties aanmaken/toewijzen maar voert ze niet zelf uit) |
| language | text | ja | `nl` / `fr` / `en` — UI-taal, door gebruiker zelf instelbaar (zie UX-richtlijnen) |
| is_active | boolean | ja | |
| created_at, updated_at, deleted_at | | | |

### 3.2b `user_invitations` — zelf medewerkers uitnodigen [v6, nieuw]

Laat een `admin` binnen een organisatie zelf nieuwe dispatchers/plaatsbeschrijvers toevoegen, zonder tussenkomst van Monét BV.

| Kolom | Type | Verplicht | Beschrijving |
|---|---|---|---|
| id | uuid | ja | |
| organization_id | uuid | ja | |
| email | text | ja | |
| role | text | ja | `admin` / `dispatcher` / `plaatsbeschrijver` / `viewer` — rol die de gebruiker krijgt bij aanvaarding |
| invited_by_user_id | uuid | ja | |
| token | text | ja | Uniek, willekeurig — onderdeel van de uitnodigingslink |
| status | text | ja | `pending` / `accepted` / `expired` / `revoked` |
| expires_at | timestamptz | ja | Standaard 7 dagen na aanmaak |
| accepted_at | timestamptz | nee | |
| created_at, updated_at | | | |

**Regel voor Claude Code**: bij aanvaarding (klik op link + wachtwoord instellen via Supabase Auth) wordt een `users`-rij aangemaakt met `organization_id` en `role` uit de uitnodiging; de uitnodiging krijgt `status = accepted`. Een admin kan een `pending`-uitnodiging intrekken (`revoked`) of opnieuw versturen (nieuwe `token`, `expires_at` verlengd). RLS: een admin ziet enkel uitnodigingen van zijn eigen organisatie.

### 3.3 `properties` — panden

| Kolom | Type | Verplicht | Beschrijving |
|---|---|---|---|
| id | uuid | ja | |
| organization_id | uuid | ja | |
| external_reference | text | nee | Referentie in ERP van de klant (bv. erpve dossiernummer) |
| street | text | ja | |
| house_number | text | ja | |
| box | text | nee | Busnummer |
| postal_code | text | ja | |
| city | text | ja | |
| country | text | ja | `BE` / `FR` |
| region | text | nee | **[v4]** Bij `BE`: `vlaanderen` / `brussel` / `wallonie` — bepaalt de juridische inleidingstekst (elk gewest heeft eigen huurwetgeving, zie 3.5c). Verplicht wanneer `country = BE`. |
| property_type | text | ja | `apartment` / `house` / `studio` / `commercial` / `garage` / `other` |
| floor | text | nee | Verdieping (bij appartement) |
| notes | text | nee | Vrije notities over het pand |
| created_at, updated_at, deleted_at | | | |

Index op (`organization_id`, `postal_code`, `street`) voor zoeken.

### 3.4 `inspections` — plaatsbeschrijvingen

| Kolom | Type | Verplicht | Beschrijving |
|---|---|---|---|
| id | uuid | ja | |
| organization_id | uuid | ja | |
| property_id | uuid | ja | FK properties |
| type | text | ja | `entry` (intrede) / `exit` (uittrede) / `interim` (tussentijds) |
| linked_inspection_id | uuid | nee | Bij `exit`: de bijhorende `entry`-inspectie. Verplicht bij exit indien beschikbaar |
| status | text | ja | Zie statusflow hieronder |
| inspector_user_id | uuid | ja | Plaatsbeschrijver die uitvoert |
| scheduled_at | timestamptz | nee | Geplande datum/uur |
| started_at | timestamptz | nee | Effectieve start op het toestel |
| completed_at | timestamptz | nee | Moment van afronden op het toestel (vóór sync) |
| locked_at | timestamptz | nee | Moment van vergrendeling na ondertekening — daarna geen wijzigingen meer aan rooms/elements/photos |
| language | text | ja | Taal van het rapport (`nl` / `fr`) |
| template_set_version | integer | ja | Versie van de templateset gebruikt bij aanmaak (zie 3.5) |
| general_notes | text | nee | Algemene opmerkingen plaatsbeschrijver |
| weather_conditions | text | nee | Relevant voor vochtvaststellingen |
| is_furnished | boolean | nee | **[v4]** "Waren de lokalen gemeubeld?" — uit de echte rapportstructuur |
| lease_contract_date | date | nee | **[v4]** Datum van de huurovereenkomst |
| lease_start_date | date | nee | **[v4]** Ingangsdatum van de huur |
| device_id | text | ja | Toestel waarop de inspectie is aangemaakt |
| created_at, updated_at, deleted_at | | | |

**Statusflow** (enkel deze overgangen zijn toegelaten):

```
draft → in_progress → awaiting_signatures → signed → pending_sync → synced → ai_processing → review → approved → sent
                                                                                                          ↓
                                                                                                       archived
```

- `draft`: aangemaakt, nog niets ingevuld
- `in_progress`: plaatsbeschrijver is bezig
- `awaiting_signatures`: alle ruimtes afgewerkt, wacht op handtekeningen
- `signed`: alle vereiste partijen hebben getekend → `locked_at` wordt gezet
- `pending_sync`: klaar op toestel, wacht op upload
- `synced`: volledig op server (data én alle foto's)
- `ai_processing`: AI-suggesties worden gegenereerd
- `review`: plaatsbeschrijver/admin kijkt AI-suggesties en rapport na
- `approved`: rapport definitief, PDF gegenereerd, hash opgeslagen
- `sent`: mails verstuurd
- `archived`: bewaartermijn loopt

Regel: alles vanaf `signed` is onveranderbaar behalve AI-suggesties accepteren/verwerpen en rapport-goedkeuring. Correcties na ondertekening gebeuren via een nieuwe `interim`-inspectie of een addendum in `reports`.

### 3.5 `room_templates` — templates per ruimtetype [v3 — meertalige structuur]

Een template beschrijft welke elementen een ruimtetype heeft. Templates zijn geversioneerd: een inspectie onthoudt welke versie gebruikt werd zodat oude inspecties correct blijven renderen als een template later wijzigt.

**[v3] Vertalingen worden niet als aparte kolommen (`name_nl`, `name_fr`, ...) opgeslagen, maar als een `translations`-object per vertaalbaar veld** — zo kan een taal (bv. EN, of later een vierde taal) toegevoegd worden zonder schemawijziging, enkel door nieuwe sleutels aan bestaande jsonb-objecten toe te voegen.

| Kolom | Type | Verplicht | Beschrijving |
|---|---|---|---|
| id | uuid | ja | |
| organization_id | uuid | nee | NULL = globale template van Monét BV |
| country | text | ja | `BE` / `FR` / `ALL` |
| room_type | text | ja | **[v5]** Vrije slug, geen gesloten enum — zie 3.5d. De lijst hieronder is de globale startkit, geen limiet |
| name_translations | jsonb | ja | `{ "nl": "Slaapkamer", "fr": "Chambre", "en": "Bedroom" }` |
| version | integer | ja | Start op 1, verhoogt bij elke wijziging |
| is_active | boolean | ja | Enkel actieve templates worden aangeboden bij nieuwe inspecties |
| elements | jsonb | ja | Geordende lijst van elementdefinities (zie structuur) |
| sort_order | integer | ja | Volgorde in de UI |
| created_at, updated_at, deleted_at | | | |

**Ruimtetypes in de globale startkit** (`room_type`) **[v5 — uitbreidbaar per organisatie, zie 3.5d]**:
`entrance_hall`, `living_room`, `kitchen`, `bedroom`, `bathroom`, `toilet`, `hallway`, `storage`, `laundry`, `office`, `garage`, `cellar`, `attic`, `terrace`, `balcony`, `garden`, `exterior`, `common_area`, `technical_room`, `other` — plus elke eigen slug die een organisatie zelf aanmaakt (bv. `wasplaats`, `veranda`).

**Structuur van `elements` (jsonb) [v3 — meertalig]**:

```json
[
  {
    "key": "walls",
    "label_translations": { "nl": "Muren", "fr": "Murs", "en": "Walls" },
    "category": "base",
    "sort_order": 1,
    "condition_options": ["good", "traces_of_use", "damaged", "not_applicable"],
    "requires_photo_if": ["traces_of_use", "damaged"],
    "sub_attributes": [
      { "key": "material", "label_translations": { "nl": "Materiaal", "fr": "Matériau", "en": "Material" }, "type": "select",
        "options": ["paint", "wallpaper", "tiles", "plaster", "wood", "other"] },
      { "key": "color", "label_translations": { "nl": "Kleur", "fr": "Couleur", "en": "Color" }, "type": "text" }
    ],
    "default_description_translations": {
      "nl": "Muren in goede staat, geen zichtbare beschadigingen.",
      "fr": "Murs en bon état, sans dégradation visible.",
      "en": "Walls in good condition, no visible damage."
    }
  }
]
```

- `category`: `base` (in elke ruimte) of `extension` (specifiek voor dit ruimtetype)
- `requires_photo_if`: bij deze toestanden is minstens één foto verplicht vóór de ruimte als afgewerkt mag gelden
- `sub_attributes`: extra gestructureerde velden per element; `type` is `text` / `select` / `number` / `boolean`
- `default_description_translations`: standaardformulering die wordt ingevuld bij toestand `good`, aanpasbaar door plaatsbeschrijver, per taal
- **[v3] Regel voor Claude Code**: als een taal in `translations` ontbreekt voor een bepaald veld, valt de app terug op NL (nooit een lege string tonen). Bij het toevoegen van een nieuwe taal aan het systeem: bestaande templates blijven geldig, ontbrekende vertalingen worden zichtbaar gemarkeerd in het (toekomstige) templatebeheer zodat ze aangevuld kunnen worden.

**[v3] `condition_options`-labels en systeemteksten** (bv. "Goed" / "Gebruikssporen" / "Beschadigd") zijn geen onderdeel van een template maar van de **app-chrome-vertalingen** — zie de nieuwe tabel 3.5b hieronder — omdat deze overal identiek zijn, ongeacht klant of template.

### 3.5b `ui_translations` — app-chrome, vertaald, versiebeheerd in code (geen databanktabel)

**[v3]** In tegenstelling tot templates (die per klant/land kunnen verschillen en dus in de databank horen) zijn de vaste UI-teksten — knoppen, foutmeldingen, systeemstatussen, `condition_options`-labels ("Goed", "Gebruikssporen", ...) — **statische vertaalbestanden in de codebase**, niet in Postgres. Dit is een bewuste architecturale keuze:

- Sneller om te laden (geen extra databank-call per scherm), werkt ook zonder sync bij de allereerste opstart van de app
- Versiebeheerd samen met de code (een tekstwijziging is een gewone commit/review, geen aparte databankmigratie)
- Technisch: een i18n-library (bv. `i18next` / `react-i18next`) met JSON-bestanden per taal, bv. `locales/nl.json`, `locales/fr.json`, `locales/en.json`

**Regel voor Claude Code**: elke tekst die de gebruiker ziet — knoplabels, foutmeldingen, lege staten, de sync-statusmeldingen uit UX-richtlijnen C.3 Flow E — gaat via de i18n-library, nooit als hardcoded string in een component. Dit geldt vanaf het allereerste scherm dat gebouwd wordt, niet als een latere opkuisstap.

### 3.5c `legal_texts` — vaste juridische rapporttekst per gewest [v4, nieuw]

Een echt plaatsbeschrijvingsrapport bevat twee vaste, uitgebreide juridische secties vóór de eigenlijke inspectie-inhoud:

- **Inleiding**: proces-verbaal-tekst met verwijzing naar de toepasselijke wetgeving — en die wetgeving verschilt per Belgisch gewest (Vlaams Woninghuurdecreet 9/11/2018 in Vlaanderen, Ordonnantie 30/10/2017 in Brussel, Waals Decreet 15/03/2018 in Wallonië), plus contactgegevens van de opsteller en de termijn/procedure voor opmerkingen (14 dagen, aangetekend schrijven of e-mail).
- **Algemene Bepalingen**: vaste bepalingen over aansprakelijkheid, meubels, zichtbare schade, bewaring, etc. — grotendeels gewest-onafhankelijk, met kleine regionale variaties mogelijk.

Dit is **wetgeving, geen door de plaatsbeschrijver te schrijven tekst** — het hoort dus, net als `ui_translations` (3.5b), als statische, versiebeheerde content in de codebase, niet als een databanktabel:

- Bestandsstructuur: `legal_texts/{region}/{language}/inleiding.md`, `legal_texts/{region}/{language}/algemene_bepalingen.md`, met `region` = `vlaanderen` / `brussel` / `wallonie` / `fr_national` (voor later)
- Bij PDF-generatie wordt het juiste bestand geladen op basis van `properties.region` (zie 3.3) en `inspections.language`
- **Regel voor Claude Code**: nooit deze tekst laten genereren of parafraseren door AI — het is wetgeving, letterlijk overnemen uit het bronbestand. Wijzigingen aan deze teksten gebeuren via een codewijziging/review, nooit via een databank-update door een gebruiker.
- Elk bestand krijgt een `version`-commentaar bovenaan (bv. `<!-- v1, laatst nagekeken 2026-09 -->`) zodat je weet wanneer een juridische controle nodig is — wetgeving wijzigt, en een verouderde inleiding in een rapport is een reëel risico.

Dit sluit ook aan bij de company-tekst uit het echte rapport (naam opsteller, adres, ondernemingsnummer van de klantorganisatie) — die velden komen wél uit de databank (`organizations`), en worden in de vaste juridische tekst ingevoegd via templatevariabelen (bv. `{{organization.name}}`, `{{plaatsbeschrijver.name}}`).

**[v5] Verschil met `organizations.custom_intro_translations` (3.1)**: `legal_texts` is de wet, onveranderlijk, code-only. `custom_intro_translations` is eigen tekst van de klant (bedrijfsvoorstelling, werkwijze) die er in het rapport **naast** komt — bewerkbaar door de klant zelf via Flow F.2. In de PDF-layout staat dit visueel duidelijk gescheiden (bv. de wettelijke inleiding onder een vaste titel "Proces-verbaal", de klanttekst eronder onder "Over [organisatienaam]"), zodat er geen enkele twijfel bestaat over welk stuk wetgeving is en welk stuk marketing/uitleg. **Regel voor Claude Code**: bouw dit als twee duidelijk gescheiden secties in de PDF-template, nooit als één samengevoegd tekstblok — dat zou het risico geven dat een klant per ongeluk denkt dat hij de wettelijke tekst aanpast, of dat een wetswijziging per ongeluk de klanttekst overschrijft.

### 3.5d Ruimtetemplates zijn door de klant samen te stellen [v5, nieuw]

**Belangrijke koerswijziging t.o.v. v4**: `room_templates.room_type` (3.5) is **geen gesloten enum meer, maar een vrije tekstslug** (bv. `wasplaats`, `veranda`, `fietsenberging`) — een organisatie moet een volledig eigen ruimtetype kunnen aanmaken dat niet in de standaardlijst staat, met eigen elementen en eigen standaardtekst per taal, vanaf v1.

- De bestaande lijst van 20 ruimtetypes (3.5) en de basis-/uitbreidingselementen blijven bestaan als **globale, niet-bewerkbare startkit** (`room_templates.organization_id = NULL`), zodat een nieuwe klant niet van nul moet beginnen.
- Een organisatie **dupliceert** een globaal template (of start helemaal leeg) naar een eigen rij met `organization_id` ingevuld, en kan daarna vrij: de naam per taal wijzigen, elementen toevoegen/verwijderen/herschikken, en voor elk element een eigen `default_description_translations` intikken — exact de "standaardtekst" die de klant vraagt.
- Templates blijven geversioneerd (3.5, `version`-veld) — een klant die een template aanpast terwijl er al inspecties mee liepen, breekt de oude inspecties niet; die tonen de versie zoals ze gestart zijn.
- **Wie mag dit**: enkel de `admin`-rol binnen een organisatie (niet `dispatcher`, niet `plaatsbeschrijver`) — dit is instellingenbeheer, geen dagelijkse planning.

**Regel voor Claude Code**: dit hoort bij Flow F (backoffice), niet in de mobiele plaatsbeschrijver-app. Bouw het als formuliergebaseerd beheer (ruimte toevoegen → elementen kiezen uit een bibliotheek of zelf typen → standaardtekst per taal invullen), geen drag-and-drop-complexiteit in v1 — dat kan later.

**Basiselementen** (category `base`, in elk ruimtetype behalve buitenruimtes) **[v4 — gecorrigeerd naar echte rapportstructuur]**:

Een echt rapport beschrijft muren **per windrichting** (Noordmuur/Oostmuur/Zuidmuur/Westmuur), elk met eigen foto's en tekst — niet als één gecombineerd "muren"-element. Vaste conventie, letterlijk uit het rapport: **"Bij conventie wordt de straatzijde de Noordmuur genoemd"**, ongeacht de werkelijke kompasrichting. Dit moet dus vier aparte elementen zijn:

`wall_north`, `wall_east`, `wall_south`, `wall_west`, `ceiling`, `floor`, `skirting_boards`, `doors`, `windows`, `window_coverings`, `sockets_switches`, `lighting`, `heating`, `ventilation`

**Regel voor Claude Code**: bij het aanmaken van een `room` wordt in een apart veld op de `inspection` (of als eerste stap in Flow A) vastgelegd welke gevel/richting van het pand de straatzijde is — dat bepaalt welke muur `wall_north` heet voor de rest van die inspectie. Niet elke ruimte heeft 4 muren (een hoekruimte kan er 2 hebben, een rechthoekige gang kan er meer hebben door insprongen) — het template staat toe dat een plaatsbeschrijver een wand-element toevoegt of weglaat per ruimte, met de 4 windrichtingen als standaardset.

**[v4] Doorlopende fotonummering**: in het echte rapport zijn foto's doorlopend genummerd over de volledige inspectie (foto 1 t.e.m. 528), niet per element — en de tekst verwijst naar dat nummer (bv. "foto: 55"). Dit vraagt een extra veld op `photos`:

| Kolom | Type | Verplicht | Beschrijving |
|---|---|---|---|
| photo_number | integer | nee | **[v4]** Doorlopend volgnummer binnen de inspectie, toegekend bij rapportgeneratie (niet bij opname) — volgorde: exterieur-algemeen, dan per ruimte in vaste volgorde, dan meters/sleutels |

Dit veld hoort bij de `photos`-tabel in 3.8 (zie hieronder) en wordt pas ingevuld op het moment van PDF-generatie, niet tijdens de inspectie zelf (de plaatsbeschrijver werkt offline en kent het totale aantal foto's nog niet).

**Uitbreidingselementen per ruimtetype** (category `extension`):
- `kitchen`: `countertop`, `cabinets`, `sink_faucet`, `hob`, `oven`, `extractor_hood`, `dishwasher`, `fridge`, `freezer`, `water_connection`, `gas_connection`
- `bathroom`: `shower`, `bathtub`, `washbasin`, `faucets`, `toilet_unit`, `mirror`, `tiling`, `sealant_joints`, `water_heater`
- `toilet`: `toilet_unit`, `hand_basin`, `tiling`
- `laundry`: `washing_machine_connection`, `dryer_connection`, `sink`
- `bedroom`: `built_in_wardrobe`
- `entrance_hall`: `front_door`, `intercom`, `mailbox`, `alarm_system`
- `terrace` / `balcony`: `flooring`, `railing`, `drainage`
- `garden`: `lawn`, `plants_trees`, `fencing`, `garden_shed`, `paving`
- `exterior`: `facade`, `roof_visible`, `gutters`, `garage_door`, `driveway`
- `technical_room`: `boiler`, `electrical_panel`, `water_meter_location`, `fuse_box`
- `cellar` / `attic`: `moisture_signs`, `insulation_visible`

### 3.6 `rooms` — ruimtes binnen een inspectie

| Kolom | Type | Verplicht | Beschrijving |
|---|---|---|---|
| id | uuid | ja | |
| inspection_id | uuid | ja | |
| room_template_id | uuid | ja | |
| room_template_version | integer | ja | Versie op moment van aanmaak |
| name | text | ja | Weergavenaam, bv. "Slaapkamer 1", "Keuken" |
| sort_order | integer | ja | Volgorde van doorlopen |
| floor_level | text | nee | Verdieping |
| is_completed | boolean | ja | Alle verplichte elementen ingevuld + verplichte foto's aanwezig |
| general_notes | text | nee | Opmerkingen over de ruimte als geheel |
| linked_room_id | uuid | nee | Bij uittrede: de overeenkomstige ruimte in de intrede-inspectie |
| created_at, updated_at, deleted_at | | | |

Bij een uittrede worden de rooms van de gekoppelde intrede automatisch gekopieerd (naam, template, volgorde) met `linked_room_id` ingevuld, zodat de plaatsbeschrijver dezelfde structuur doorloopt.

### 3.7 `room_elements` — ingevulde elementen

Eén rij per element per ruimte. Wordt aangemaakt bij het aanmaken van de room, op basis van de template.

| Kolom | Type | Verplicht | Beschrijving |
|---|---|---|---|
| id | uuid | ja | |
| room_id | uuid | ja | |
| element_key | text | ja | Komt overeen met `key` in template |
| condition | text | nee | `good` / `traces_of_use` / `damaged` / `not_applicable` / `not_inspected` |
| description | text | nee | Definitieve beschrijving (door plaatsbeschrijver geschreven of AI-suggestie overgenomen) |
| description_source | text | nee | `manual` / `default` / `ai_accepted` / `ai_edited` — traceerbaarheid |
| sub_attribute_values | jsonb | nee | `{ "material": "paint", "color": "wit" }` |
| linked_element_id | uuid | nee | Bij uittrede: het overeenkomstige element in de intrede |
| has_change_vs_linked | boolean | nee | Bij uittrede: plaatsbeschrijver bevestigt of er een verschil is t.o.v. intrede |
| change_description | text | nee | Bij uittrede: beschrijving van het verschil |
| liability | text | nee | Bij uittrede: `tenant` / `landlord` / `normal_wear` / `undetermined` — ingevuld door plaatsbeschrijver, nooit door AI |
| sort_order | integer | ja | |
| device_id | text | ja | Toestel dat de laatste wijziging aan deze rij maakte |
| client_updated_at | timestamptz | ja | Timestamp gezet op het toestel bij wijziging — basis voor conflictdetectie, apart van `updated_at` (servertijd) |
| sync_conflict_status | text | ja | `none` / `pending_review` / `resolved` — default `none` |
| conflicting_payload | jsonb | nee | Bij `pending_review`: de volledige rij zoals aangeleverd door het tweede toestel, bewaard tot een mens kiest welke versie geldt |
| conflict_resolved_by_user_id | uuid | nee | |
| conflict_resolved_at | timestamptz | nee | |
| created_at, updated_at, deleted_at | | | |

Unieke constraint op (`room_id`, `element_key`).

**[v2] Conflictdetectie-logica**: bij sync vergelijkt de server `client_updated_at` van de binnenkomende rij met de reeds opgeslagen rij. Bij gelijke `room_id` + `element_key` maar een ander `device_id` én beide `client_updated_at`-waarden binnen een venster van elkaar (bv. dezelfde inspectiesessie, geen duidelijke "laatste" wijziging) wordt de rij niet overschreven maar krijgt ze `sync_conflict_status = pending_review`, met de binnenkomende versie in `conflicting_payload`. De inspectie kan pas naar `signed` als alle `room_elements` van die inspectie `sync_conflict_status = none` of `resolved` hebben. Bij een duidelijk latere `client_updated_at` (buiten het venster) geldt gewoon last-write-wins, geen conflict.

### 3.8 `photos` — foto's

| Kolom | Type | Verplicht | Beschrijving |
|---|---|---|---|
| id | uuid | ja | |
| organization_id | uuid | ja | |
| inspection_id | uuid | ja | Redundant maar handig voor queries en RLS |
| room_id | uuid | nee | |
| room_element_id | uuid | nee | NULL bij algemene foto's (bv. voorgevel, meterstand) |
| meter_reading_id | uuid | nee | Als de foto bij een meterstand hoort |
| local_path | text | nee | Pad op het toestel (enkel lokaal relevant, niet gesynct) |
| storage_path | text | nee | Pad in Supabase Storage na upload |
| thumbnail_storage_path | text | nee | Kleine versie voor lijstweergave |
| file_size_bytes | integer | nee | |
| width, height | integer | nee | |
| mime_type | text | ja | `image/jpeg` (altijd converteren naar JPEG bij compressie) |
| sha256 | text | ja | Hash van het gecomprimeerde bestand — bewijs van integriteit |
| taken_at | timestamptz | ja | Tijdstip van opname op het toestel |
| gps_lat, gps_lng | numeric | nee | Indien beschikbaar — bewijs van locatie |
| caption | text | nee | Bijschrift door plaatsbeschrijver |
| sort_order | integer | ja | |
| upload_status | text | ja | `pending` / `uploading` / `uploaded` / `failed` |
| upload_attempts | integer | ja | Aantal pogingen, voor retry-logica |
| created_at, updated_at, deleted_at | | | |

Compressieregels (in de app): lange zijde max 2048 px, JPEG-kwaliteit 80, doel ≤ 1,5 MB. Origineel wordt niet bewaard (opslagkost). Thumbnail 400 px lange zijde.

Opslagpad op server: `{organization_id}/{inspection_id}/{photo_id}.jpg` — nooit originele bestandsnamen gebruiken.

### 3.9 `ai_suggestions` — AI-output, gescheiden van de brondata

Elke AI-output is een aparte rij. Nooit rechtstreeks in `room_elements.description` schrijven; de plaatsbeschrijver accepteert of verwerpt.

| Kolom | Type | Verplicht | Beschrijving |
|---|---|---|---|
| id | uuid | ja | |
| inspection_id | uuid | ja | |
| room_element_id | uuid | nee | |
| photo_id | uuid | nee | |
| suggestion_type | text | ja | `photo_description` / `change_detection` / `report_summary` |
| model | text | ja | Modelnaam gebruikt (bv. `claude-sonnet-4-6`) |
| prompt_version | text | ja | Versie van de prompt-template — nodig om output te kunnen verklaren |
| input_summary | jsonb | nee | Welke input meegegeven werd (element_key, room_type, foto-ids) |
| output | jsonb | ja | Gestructureerde output, zie structuur per type |
| confidence | text | nee | `high` / `medium` / `low` zoals door het model aangegeven |
| status | text | ja | `pending` / `accepted` / `edited` / `rejected` |
| reviewed_by_user_id | uuid | nee | |
| reviewed_at | timestamptz | nee | |
| cost_input_tokens, cost_output_tokens | integer | nee | Voor kostenopvolging per inspectie |
| created_at, updated_at | | | |

**Outputstructuur per type**:

`photo_description`:
```json
{ "condition": "damaged", "description_nl": "...", "description_fr": "...", "visible_elements": ["crack", "discoloration"] }
```

`change_detection`:
```json
{ "change_detected": true, "summary_nl": "...", "summary_fr": "...", "severity": "minor|moderate|major" }
```

`report_summary`:
```json
{ "summary_nl": "...", "summary_fr": "..." }
```

Regel voor alle prompts: beschrijf enkel wat zichtbaar is; nooit oorzaak, schuld of aansprakelijkheid. `liability` in `room_elements` wordt altijd door een mens ingevuld.

### 3.10 `inspection_parties` — betrokken partijen

Wie is betrokken bij deze inspectie (huurder(s), verhuurder, vertegenwoordiger, makelaar).

| Kolom | Type | Verplicht | Beschrijving |
|---|---|---|---|
| id | uuid | ja | |
| inspection_id | uuid | ja | |
| party_type | text | ja | `tenant` / `landlord` / `landlord_representative` / `tenant_representative` / `agent` / `plaatsbeschrijver` |
| full_name | text | ja | |
| email | text | nee | Nodig voor mailing |
| phone | text | nee | |
| company_name | text | nee | |
| is_present | boolean | ja | Aanwezig bij de inspectie |
| must_sign | boolean | ja | Handtekening vereist vóór vergrendeling |
| receives_report | boolean | ja | Krijgt het rapport per mail |
| created_at, updated_at, deleted_at | | | |

### 3.11 `signatures` — handtekeningen

| Kolom | Type | Verplicht | Beschrijving |
|---|---|---|---|
| id | uuid | ja | |
| inspection_id | uuid | ja | |
| party_id | uuid | ja | FK inspection_parties |
| signature_image_path | text | ja | Lokaal pad / storage path (PNG) |
| signature_sha256 | text | ja | |
| party_remarks | text | nee | Opmerkingen van de ondertekenaar — bewust apart van de plaatsbeschrijver-tekst |
| agrees_with_report | boolean | ja | Ondertekenaar gaat akkoord met de inhoud; bij `false` zijn `party_remarks` verplicht |
| signed_at | timestamptz | ja | |
| device_id | text | ja | |
| ip_address | text | nee | Bij sync ingevuld |
| app_version | text | ja | |
| report_snapshot_sha256 | text | ja | Hash van de inspectiedata op het moment van tekenen — bewijst wat er getekend werd |
| created_at | | | |

Geen `updated_at`/`deleted_at`: een handtekening wordt nooit gewijzigd of verwijderd.

### 3.12 `meter_readings` — meterstanden [v4 — gecorrigeerd naar echte rapportstructuur]

| Kolom | Type | Verplicht | Beschrijving |
|---|---|---|---|
| id | uuid | ja | |
| inspection_id | uuid | ja | |
| meter_type | text | ja | `electricity_day` / `electricity_night` / `electricity_exclusive_night` / `electricity_injection_day` / `electricity_injection_night` / `gas` / `water` / `heating_calorimeter` / `other` — **[v4]** injectie nu gesplitst dag/nacht, zoals het echte rapport dat apart vermeldt |
| meter_number | text | nee | Meternummer (bv. `1SAG1105206357`) |
| ean_code | text | nee | **[v4]** EAN-code, apart veld — elk echt rapport vermeldt dit naast het meternummer |
| reading_value | numeric | ja | |
| unit | text | ja | `kWh` / `m3` / `other` |
| location_description | text | nee | Waar de meter zich bevindt |
| sort_order | integer | ja | |
| created_at, updated_at, deleted_at | | | |

Foto's van meterstanden koppelen via `photos.meter_reading_id`. Meerdere foto's per meter zijn gebruikelijk (close-up van display + overzichtsfoto van de meterkast).

### 3.13 `keys` — sleutels en toegangsmiddelen [v4 — gecorrigeerd naar echte rapportstructuur]

| Kolom | Type | Verplicht | Beschrijving |
|---|---|---|---|
| id | uuid | ja | |
| inspection_id | uuid | ja | |
| key_type | text | ja | `front_door` / `interior_doors` / `mailbox` / `garage` / `cellar` / `badge` / `remote` / `other` — **[v4]** `interior_doors` toegevoegd (echte rapporten tellen sleutels voor "binnendeuren" als aparte categorie, los van de voordeursleutel) |
| quantity | integer | ja | |
| quantity_uncertain | boolean | ja | **[v4]** Default `false`. Bij `true`: de plaatsbeschrijver kon het aantal niet met zekerheid vaststellen (bv. "mogelijk nog 1 extra", letterlijk voorbeeld uit een echt rapport) — het rapport toont dan expliciet dat voorbehoud in plaats van een hard getal |
| description | text | nee | |
| handed_over | boolean | ja | Overhandigd bij intrede / teruggegeven bij uittrede |
| created_at, updated_at, deleted_at | | | |

### 3.14 `reports` — gegenereerde rapporten

| Kolom | Type | Verplicht | Beschrijving |
|---|---|---|---|
| id | uuid | ja | |
| inspection_id | uuid | ja | Uniek |
| organization_id | uuid | ja | |
| version | integer | ja | Verhoogt bij hergeneratie (bv. na addendum) |
| pdf_storage_path | text | ja | |
| pdf_sha256 | text | ja | Onveranderbaarheidsbewijs |
| generated_at | timestamptz | ja | |
| generated_by_user_id | uuid | ja | Wie goedkeurde |
| language | text | ja | |
| includes_ai_summary | boolean | ja | |
| addendum_text | text | nee | Correcties na ondertekening — verschijnt als aparte sectie, wijzigt de originele inhoud niet |
| rfc3161_timestamp_token | bytea | nee | [v2] Het tijdstempel-token ontvangen van de tijdstempelautoriteit, over `pdf_sha256` |
| rfc3161_authority | text | nee | [v2] Naam/URL van de gebruikte tijdstempeldienst |
| rfc3161_timestamped_at | timestamptz | nee | [v2] Moment van tijdstempeling — bewijst wanneer het rapport bestond, niet enkel dat het ongewijzigd is |
| created_at | | | |

### 3.15 `mail_log` — verzonden mails

| Kolom | Type | Verplicht | Beschrijving |
|---|---|---|---|
| id | uuid | ja | |
| report_id | uuid | ja | |
| party_id | uuid | ja | |
| recipient_email | text | ja | |
| template_key | text | ja | `report_delivery_tenant` / `report_delivery_landlord` / `report_delivery_agent` |
| provider_message_id | text | nee | ID bij maildienst |
| status | text | ja | `queued` / `sent` / `delivered` / `bounced` / `failed` |
| sent_at | timestamptz | nee | |
| delivered_at | timestamptz | nee | |
| error_message | text | nee | |
| created_at, updated_at | | | |

### 3.15b `report_party_access` — beveiligde toegang voor partijen zonder account [v7, nieuw]

Elke partij (huurder, verhuurder, ...) krijgt in de afleveringsmail een unieke, beveiligde link naar een lichte webpagina (Flow G) waar ze het rapport kunnen bekijken en opmerkingen kunnen toevoegen — zonder account of wachtwoord.

| Kolom | Type | Verplicht | Beschrijving |
|---|---|---|---|
| id | uuid | ja | |
| report_id | uuid | ja | |
| party_id | uuid | ja | FK inspection_parties |
| token | text | ja | Uniek, lang en willekeurig — onderdeel van de link, nooit raadbaar |
| expires_at | timestamptz | ja | `sent_at` + `organizations.comment_window_days` (zie 3.1, default 14) |
| created_at | timestamptz | ja | |
| last_accessed_at | timestamptz | nee | |
| access_count | integer | ja | Default 0, verhoogt bij elk bezoek — nuttig om te zien of een partij het rapport effectief bekeken heeft |

**Regel voor Claude Code**: hergebruik dit token-mechanisme ook voor de rapport-downloadlink zelf (zie sectie 5, Bestandsopslag) — één consistente toegangslaag voor alles wat een partij zonder account mag zien, in plaats van twee aparte systemen.

### 3.15c `report_comments` — opmerkingen van partijen na ontvangst [v7, nieuw]

Dit is de digitale versie van het "binnen de 14 dagen opmerkingen formuleren"-recht uit de wettelijke tekst (3.5c) — en de reden waarom die tekst klopt met de werkelijkheid.

| Kolom | Type | Verplicht | Beschrijving |
|---|---|---|---|
| id | uuid | ja | |
| report_id | uuid | ja | |
| party_id | uuid | ja | FK inspection_parties — wie de opmerking gaf |
| room_element_id | uuid | nee | Specifiek element waarop de opmerking slaat — NULL bij een algemene opmerking |
| photo_id | uuid | nee | Optioneel: nog specifieker, gekoppeld aan één foto binnen het element |
| comment_text | text | ja | |
| status | text | ja | `open` / `acknowledged` / `resolved` — voor opvolging door de organisatie |
| resolved_by_user_id | uuid | nee | |
| resolved_at | timestamptz | nee | |
| resolution_note | text | nee | Interne notitie bij afhandeling, niet zichtbaar voor de partij |
| ip_address | text | nee | |
| created_at | timestamptz | ja | |

**Regel voor Claude Code**: `report_comments` wijzigt nooit de onderliggende, vergrendelde inspectiedata (`room_elements`, `photos`) — het is een volledig aparte, additieve laag. Bij een geschil toont het rapport dus altijd: de oorspronkelijke vaststelling (onveranderd, met hash) én de opmerkingen die erop kwamen (apart gelogd, met tijdstip en IP). Een `resolved`-opmerking kan, indien de organisatie dat wil, manueel opgenomen worden in `reports.addendum_text` (3.14) — dat blijft een bewuste, door een mens geschreven synthese, geen automatische copy-paste.

### 3.16 `sync_queue` — enkel lokaal (SQLite)

Bestaat niet op de server. Elke lokale wijziging maakt een rij aan; de sync-service verwerkt de rijen in volgorde.

| Kolom | Type | Verplicht | Beschrijving |
|---|---|---|---|
| id | integer | ja | Autoincrement — volgorde is belangrijk |
| entity_type | text | ja | Tabelnaam |
| entity_id | uuid | ja | |
| operation | text | ja | `upsert` / `soft_delete` / `upload_file` |
| payload | text (json) | nee | Volledige rij bij upsert |
| file_local_path | text | nee | Bij `upload_file` |
| device_id | text | ja | |
| client_updated_at | timestamptz | ja | |
| attempts | integer | ja | |
| last_error | text | nee | |
| status | text | ja | `pending` / `in_progress` / `done` / `failed` |
| created_at | timestamptz | ja | |

**Syncvolgorde** (afgedwongen door de sync-service): `organizations` (read-only download) → `room_templates` (download) → `properties` → `inspections` → `inspection_parties` → `rooms` → `room_elements` → `meter_readings` → `keys` → `photos` (metadata) → `photos` (bestanden) → `signatures` (metadata + bestand). Een inspectie krijgt status `synced` pas als alle rijen én alle bestanden bevestigd zijn.

**Conflictregel [v2 — herzien]**: standaard last-write-wins per rij (op basis van `client_updated_at`), behalve op `room_elements`, waar expliciete conflictdetectie geldt (zie 3.7) om het uitvalscenario met een tweede toestel op te vangen. De server weigert wijzigingen aan rijen van een inspectie met `locked_at` ingevuld, behalve op `ai_suggestions`, `reports` en `mail_log`. Een inspectie met een `room_element` in `sync_conflict_status = pending_review` kan niet naar `signed` totdat het conflict is opgelost.

### 3.16b `device_sync_sessions` — server-side, nieuw in v2

Houdt bij welk toestel wanneer synchroniseerde voor een inspectie; ondersteunt conflictdetectie en is nuttig bij support ("welk toestel heeft dit laatst geüpload").

| Kolom | Type | Verplicht | Beschrijving |
|---|---|---|---|
| id | uuid | ja | |
| inspection_id | uuid | ja | |
| device_id | text | ja | |
| user_id | uuid | ja | |
| sync_started_at | timestamptz | ja | |
| sync_completed_at | timestamptz | nee | NULL als de sync afbrak |
| rows_synced | integer | nee | |
| photos_synced | integer | nee | |
| conflicts_detected | integer | ja | Default 0 |
| app_version | text | ja | |
| created_at | | | |

Dit is puur informatief/diagnostisch — geen enkele businesslogica hangt hiervan af, enkel de conflictvelden op `room_elements` zelf bepalen het gedrag.

### 3.17 `audit_log` — server-side

| Kolom | Type | Beschrijving |
|---|---|---|
| id | bigint | |
| organization_id | uuid | |
| user_id | uuid | |
| entity_type, entity_id | | |
| action | text | `create` / `update` / `delete` / `status_change` / `lock` / `approve` / `send` |
| before, after | jsonb | |
| device_id, ip_address | text | |
| created_at | timestamptz | |

Wordt via database-triggers gevuld. Niet lokaal bijgehouden.

---

## 4. Lokaal vs. server — welke tabellen waar

| Tabel | Lokaal (SQLite) | Server (Postgres) |
|---|---|---|
| organizations | ja (read-only kopie van eigen org) | ja |
| users | ja (read-only kopie) | ja |
| user_invitations | nee (puur backoffice/web) | ja |
| properties | ja | ja |
| inspections | ja | ja |
| room_templates | ja (read-only kopie) | ja |
| rooms | ja | ja |
| room_elements | ja | ja |
| photos | ja | ja |
| ai_suggestions | ja (download na sync, voor review op toestel) | ja |
| inspection_parties | ja | ja |
| signatures | ja | ja |
| meter_readings | ja | ja |
| keys | ja | ja |
| reports | nee (enkel downloadlink) | ja |
| mail_log | nee | ja |
| report_party_access | nee | ja |
| report_comments | nee | ja |
| sync_queue | ja | nee |
| device_sync_sessions | nee | ja |
| audit_log | nee | ja |

---

## 5. Bestandsopslag (Supabase Storage)

Buckets:
- `photos` — privé, pad `{organization_id}/{inspection_id}/{photo_id}.jpg` en `.../thumb_{photo_id}.jpg`
- `signatures` — privé, pad `{organization_id}/{inspection_id}/{signature_id}.png`
- `reports` — privé, pad `{organization_id}/{inspection_id}/v{version}.pdf`
- `logos` — privé, pad `{organization_id}/logo.png`

Toegang enkel via signed URLs met korte geldigheid (bv. 1 uur), nooit publieke URLs. Downloadlinks in mails naar huurders wijzen naar een endpoint dat een signed URL genereert na een eenvoudige verificatie (bv. token in de link, 30 dagen geldig).

---

## 6. Regels voor de ontwikkelaar (Claude Code)

1. Genereer alle UUID's op het toestel — nooit vertrouwen op server-side generatie voor entiteiten die offline aangemaakt kunnen worden.
2. Elke schrijfactie in de app gebeurt via één datalaag (`repository`-patroon) die tegelijk de lokale rij schrijft én een `sync_queue`-rij aanmaakt. Nooit rechtstreeks SQL vanuit UI-componenten.
3. `updated_at` wordt altijd op het toestel gezet bij een wijziging, in UTC.
4. Statusovergangen van `inspections` gebeuren via één functie die de toegelaten overgangen afdwingt; ongeldige overgangen gooien een fout.
5. Vóór vergrendeling (`signed`): controleer dat elke `room` `is_completed = true` is en dat elke partij met `must_sign = true` een `signature` heeft.
6. Bij vergrendeling: bereken `report_snapshot_sha256` over een canonieke JSON-serialisatie van inspection + rooms + room_elements + photos (sha256's) + meter_readings + keys, en sla die op in elke signature.
7. Foto's altijd comprimeren vóór opslag in SQLite/bestandssysteem; sha256 berekenen op het gecomprimeerde bestand.
8. AI-output nooit rechtstreeks in `room_elements.description` schrijven — altijd via `ai_suggestions` en een expliciete acceptatie door de gebruiker.
9. Server-side: RLS op elke tabel met `organization_id`; edge functions gebruiken de service role enkel voor AI, PDF en mailing, nooit voor gebruikersacties.
10. Schemawijzigingen: migratiebestanden voor Postgres én een spiegelende migratie voor SQLite, met een `schema_version`-tabel lokaal.
11. [v2] Crashrapportage (bv. Sentry) integreren vanaf de eerste testversie — niet uitstellen tot na de pilot. Elke onafgevangen fout in de sync-laag moet gelogd worden met `inspection_id` en `device_id` voor reproduceerbaarheid.
12. [v2] Periodieke lichte lokale back-up van de SQLite-database (via het reguliere toestel-back-upsysteem) als ramherstel bij databankcorruptie — geen synchronisatiefunctie, puur herstel.
13. [v2] `ai_suggestions` en gerelateerde AI-velden blijven ongebruikt (schema aanwezig, geen schrijfacties) tot versie 1.x expliciet AI introduceert — bouw geen AI-aanroepen in de v1-pilot, ook niet "voor later klaar".
14. [v2] Bij het genereren van een `report`: eerst `pdf_sha256` berekenen, dan een RFC 3161-tijdstempel aanvragen bij een externe tijdstempelautoriteit over die hash, en het token opslaan vóór de mail verstuurd wordt. Als de tijdstempeldienst niet bereikbaar is: rapport toch versturen, maar met `rfc3161_timestamped_at = NULL` en een retry-taak inplannen — de tijdstempel mag de mailing niet blokkeren.
15. Elk scherm dat op basis van dit datamodel gebouwd wordt, volgt de UX-verplichtingen uit Deel C — in het bijzonder de Design-plugin-stappen in C.6. Een scherm dat functioneel correct is maar de accessibility-review niet doorstaan heeft, geldt niet als afgerond.

---

## 7. Open punten (te beslissen vóór bouw van de betreffende module)

- Meerdere plaatsbeschrijvers op één inspectie: voorlopig niet ondersteund; `device_id` op inspectie + serverweigering bij tweede toestel.
- Bewaring na einde klantrelatie: exportfunctie (ZIP met PDF's + foto's) vóór verwijdering; verwijdering enkel na bevestiging en na verstrijken `retention_years`.
- Franse verplichte velden (diagnostics, surface habitable, …): worden als extra `sub_attributes` in FR-templates opgenomen, niet als aparte tabellen — te valideren in fase 6.

---
