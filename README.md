# Weather Anomalie

Eine Webanwendung, die aktuelles und historisches Wetter mit der Klimanormalperiode 1961–1990 vergleicht — für einen einzelnen Ort oder global auf der Weltkarte. Entstanden als Abschlussprojekt im Full-Stack-Bootcamp der WBS Coding School.

## Motivation

Statt bei "früher war's doch auch schon mal heiß" auf Anekdoten angewiesen zu sein, liefert die App echte Zahlen: Wie viele Hitze-, Frost-, Starkregen- und Sturmtage gab es in einem Jahr im Vergleich zum langjährigen Mittel, und wie hat sich das über die letzten Jahrzehnte entwickelt?

## Features

### Local Mode

Klick auf einen Ort auf der Karte öffnet drei Tabs:

- **Verlauf** — monatliche Durchschnittstemperaturen für zwei frei wählbare Jahre im Vergleich, als Diagramm und Tabelle
- **Extremwetter** — Anzahl der Hitze-/Frost-/Starkregen-/Sturmtage für ein wählbares Jahr, verglichen mit dem Schnitt der Klimanormalperiode 1961–1990, inklusive:
  - Tages-Kalender im GitHub-Contribution-Stil (zeigt, an welchen Tagen z.B. ein Hitzetag war)
  - längste zusammenhängende Serie (z.B. längste Hitzewelle)
- **Langzeitverlauf** — ein Kästchen pro Jahr (1940 bis heute), gruppiert nach Jahrzehnt und eingefärbt nach Anzahl der Extremtage, zeigt den Trend auf einen Blick

### Global Mode

Weltkarte mit Temperaturanomalien pro Rasterzelle zwischen zwei wählbaren Jahren.

## Tech-Stack

- **Frontend:** Next.js (App Router), React, Leaflet (Karte), TypeScript
- **Backend:** Express, TypeScript
- **Datenbank:** MongoDB (Mongoose) — cached historische Wetterdaten, damit nicht bei jeder Anfrage erneut bei Open-Meteo abgefragt werden muss
- **Wetterdaten:** [Open-Meteo Archive API](https://open-meteo.com/)
- **Monorepo:** Turborepo + pnpm Workspaces

## Projektstruktur

```text
apps/
  backend/    Express-API, Mongoose-Modelle, Open-Meteo-Anbindung
  frontend/   Next.js-App
packages/
  ui/         Geteilte React-Komponenten (Karte, Panels, Diagramme, ...)
```

## Setup

Voraussetzungen: Node.js ≥ 18, pnpm, eine MongoDB-Instanz (z.B. [MongoDB Atlas](https://www.mongodb.com/atlas))

```bash
pnpm install
```

Backend-Env anlegen (`apps/backend/.env`, Vorlage: `apps/backend/.env.example`):

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster-host>/<db-name>?retryWrites=true&w=majority
PORT=3001
```

Frontend-Env anlegen (`apps/frontend/.env.local`, Vorlage: `apps/frontend/.env.example`):

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

Dev-Server starten (Frontend auf Port 3000, Backend auf Port 3001):

```bash
pnpm dev
```

## Scripts

| Befehl | Beschreibung |
| --- | --- |
| `pnpm dev` | Startet Backend + Frontend im Watch-Modus |
| `pnpm build` | Production-Build beider Apps |
| `pnpm lint` | ESLint über das gesamte Repo |
| `pnpm check-types` | TypeScript-Check über das gesamte Repo |
| `pnpm --filter backend warm-global-grid` | Wärmt den Cache für den Global-Mode-Raster vor (optional, spart Ladezeit beim ersten Aufruf) |

## API-Endpunkte (Backend)

Alle Routen unter `/api/weather`:

| Endpoint | Beschreibung |
| --- | --- |
| `GET /current` | Aktuelle Temperatur für einen Ort |
| `GET /history` | Monatsmittel für zwei Jahre im Vergleich |
| `GET /global` | Temperaturanomalie-Raster für die Weltkarte |
| `GET /global/progress` | Ladefortschritt für `/global` |
| `GET /extremes` | Extremtage-Zählung für ein Jahr vs. Klimanormalperiode |
| `GET /extremes/daily` | Tägliche Extremtage-Flags für ein Jahr (Kalenderansicht) |
| `GET /extremes/history` | Extremtage-Zählung für jedes Jahr seit 1940 (Langzeitverlauf) |

Wetterdaten stammen von [Open-Meteo](https://open-meteo.com/), Reverse-Geocoding von [Nominatim/OpenStreetMap](https://nominatim.org/), Kartenkacheln von [CARTO](https://carto.com/).
