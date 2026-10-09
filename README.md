# MEDCNET

MEDCNET ist ein React-/Vite-Dashboard für Leitstelle, Rettungsdienst und Krankenhaus. Es verwendet eine Express-API, Mongoose/MongoDB Atlas und Discord OAuth2. Die API läuft lokal als Express-Server und auf Vercel als Serverless Function. Ein optionaler, klar isolierter Demo-Modus stellt bei nicht erreichbarer API fiktive Beispieldaten bereit.

## Projektstruktur

```text
MEDCNET/
├── frontend/                 # React, TypeScript, Vite und React Router
├── api/                      # Vercel Function-Handler
├── backend/                  # Express-Routen, Modelle, Auth und Services
├── bot/                      # Separat betriebener Discord-Bot
├── .env.example
├── frontend/.env.example
├── package.json              # npm Workspaces und Start-/Build-Befehle
├── package-lock.json         # reproduzierbare npm-Installation lokal und auf Vercel
└── vercel.json
```

## Installation nach dem GitHub-Clone

Voraussetzungen: Git, Node.js 20 oder neuer und npm.

```bash
git clone <GITHUB-REPOSITORY-URL>
cd MEDCNET
npm install
```

Die Installation benötigt nur versionierte Projektdateien und npm; es werden keine lokalen absoluten Pfade oder nicht versionierten Dependencies vorausgesetzt.

## Lokal starten

Kopiere die Vorlagen und trage für den echten Datenbetrieb deine MongoDB- und Discord-Werte ein. `.env` bleibt lokal und wird nicht versioniert.

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

In `.env` für lokale OAuth-Entwicklung setzen:

```dotenv
FRONTEND_URL=http://localhost:5173
DISCORD_REDIRECT_URI=http://localhost:4000/api/auth/callback
```

Starte Frontend und API jeweils in einem Terminal:

```bash
npm run dev
npm run server
```

Das Frontend läuft unter `http://localhost:5173`, die API unter `http://localhost:4000/api`. `npm run dev:all` startet beide Prozesse gemeinsam. Der Vite-Proxy auf die lokale API existiert ausschließlich im Dev-Server; im Production-Build verwendet die App standardmäßig den Same-Origin-Pfad `/api`.

Ohne Datenbank kann auf der Anmeldeseite **„Isolierten Demo-Modus starten“** ausgewählt werden. Der Demo-Banner bleibt sichtbar; Demo-Daten werden ausschließlich unter einem separaten Demo-Schlüssel im Browser gespeichert. Demo-Sitzungen rufen keine API auf und lesen oder verändern niemals MongoDB-Daten. Sie sind nur fiktive Beispieldaten, nicht für reale Patientendaten geeignet.

## Production Build und Tests

```bash
npm install
npm test
npm run build
```

Der Build erstellt `frontend/dist`. Die API wird in Produktion von Vercel Functions ausgeführt; ein dauerhafter Express-Prozess ist dort nicht erforderlich.

## Umgebungsvariablen

Die Root-Vorlage [`.env.example`](./.env.example) enthält ausschließlich Namen und Platzhalter. Die Frontend-Vorlage [`frontend/.env.example`](./frontend/.env.example) enthält nur die öffentliche API-Basisadresse.

| Variable | Benötigt | Verwendung |
| --- | --- | --- |
| `MONGODB_URI` | Ja für echte Daten | MongoDB-Atlas-Verbindungs-URI; ausschließlich serverseitig |
| `MONGODB_DATABASE` | Ja für echte Daten | Datenbankname, z. B. `medcnet` |
| `JWT_SECRET` | Ja für Anmeldung | Zufälliger, nicht erratbarer Wert, mindestens 32 Zeichen |
| `FRONTEND_URL` | Nein | Nur für den später reaktivierbaren Discord-OAuth-Code |
| `DISCORD_CLIENT_ID` | Nein | Discord-OAuth ist vorübergehend deaktiviert |
| `DISCORD_CLIENT_SECRET` | Nein | Discord-OAuth ist vorübergehend deaktiviert |
| `DISCORD_REDIRECT_URI` | Nein | Discord-OAuth ist vorübergehend deaktiviert |
| `DISCORD_GUILD_ID` | Nein | Discord-OAuth ist vorübergehend deaktiviert |
| `ADMIN_ROLE_ID` | Nein | Discord-Rollen-Mapping ist beim Dienstnummer-Login inaktiv |
| `MODERATOR_ROLE_ID` | Nein | Discord-Rollen-Mapping ist beim Dienstnummer-Login inaktiv |
| `FIRE_ROLE_ID` | Nein | Discord-Rollen-Mapping ist beim Dienstnummer-Login inaktiv |
| `POLICE_ROLE_ID` | Nein | Discord-Rollen-Mapping ist beim Dienstnummer-Login inaktiv |
| `MEMBER_ROLE_ID` | Nein | Discord-Rollen-Mapping ist beim Dienstnummer-Login inaktiv |
| `VITE_API_URL` | Nein | Frontend-Buildvariable; auf Vercel `/api`, dies ist auch der Standard |

`JWT_SECRET` erzeugen:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Keine Geheimnisse mit `VITE_`-Präfix versehen. `.env`, Bot-Tokens und MongoDB-URIs mit Zugangsdaten niemals committen.

## Administrator-Ersteinrichtung

Es gibt keinen öffentlichen Registrierungs- oder Bootstrap-Endpunkt. Richte die Backend-Umgebung lokal mit `MONGODB_URI`, `MONGODB_DATABASE` und einem sicheren `JWT_SECRET` ein. Das Bootstrap-Programm liest optional die nicht versionierte Root-Datei `.env`; alternativ können die Werte über eine sichere lokale Secret-Verwaltung in die Prozessumgebung gegeben werden.

Führe im Codespace-Terminal `npm run bootstrap:admin` aus. Das Programm verlangt ein interaktives Terminal, fragt Dienstnummer und Anzeigename ab und liest das Passwort ohne Echo zweimal ein. Es erstellt den ersten aktiven `Admin` mit bcrypt-Hash und Einmal-Marker in einer MongoDB-Transaktion. Existiert bereits ein Admin oder der Marker, wird das Setup abgelehnt. Das Passwort steht weder in Kommandozeilenargumenten noch in Logs oder API-Antworten.

Weitere Benutzer dürfen nur angemeldete Admins über `POST /api/admin/users` anlegen. Rollen/Aktivstatus laufen über `PATCH /api/admin/users/:id`, Passwort-Reset über `PATCH /api/admin/users/:id/password`. Passwörter werden dabei serverseitig gehasht. Generische Ressourcen-Endpunkte dürfen Benutzer nicht anlegen, löschen oder Passwortfelder ändern.

Das Bootstrap benötigt eine MongoDB-Atlas-Deployment-Umgebung, die Transaktionen unterstützt. Es verwendet die Collection `auth_bootstrap` und legt keine Daten an, wenn ein Administrator bereits existiert.

## MongoDB Atlas konfigurieren

1. In MongoDB Atlas einen Cluster und eine Datenbank mit dem Namen `medcnet` (oder einem eigenen Namen) anlegen.
2. Einen eigenen Datenbankbenutzer mit minimal erforderlichen Rechten erstellen.
3. Netzwerkzugriff für die Serverless-Runtime konfigurieren.
4. Die Atlas-URI als `MONGODB_URI` und den Datenbanknamen als `MONGODB_DATABASE` lokal in `.env` beziehungsweise in Vercel Environment Variables eintragen.

Die API verwendet Mongoose-Modelle für Benutzer/Mitarbeiter, Rollen, Patienten und Patientenakten, Vitalzeichen, Einsätze und Teamdaten, Fahrzeuge, Betten, Funkkanäle und Nachrichten, Rechnungen/Preiskatalog, Aktivitätsprotokolle und Benachrichtigungen. Fehlende oder nicht erreichbare MongoDB erzeugt einen expliziten API-Fehler; Produktivdaten werden nicht durch Beispieldaten ersetzt.

## Discord-OAuth (derzeit deaktiviert)

Die bisherigen Controller, API-Dateien und Umgebungsvariablen bleiben für eine spätere Rückkehr erhalten. Die Endpunkte `/api/auth/discord` und `/api/auth/callback` antworten aktuell mit `410 Gone`; sie sind kein Loginweg und erfordern keine Discord-Umgebungsvariablen.

## GitHub Workflow

```bash
git add .
git commit -m "MEDCNET Update"
git push
```

Vor dem Commit sicherstellen, dass keine `.env`-Datei oder Secrets hinzugefügt werden. `.gitignore` schließt Environment-Dateien aus und lässt nur die `.env.example`-Vorlagen zu. `package-lock.json` ist versioniert und wird lokal sowie auf Vercel mit npm verwendet.

## Vercel Deployment

1. GitHub-Repository in Vercel importieren; **Root Directory** ist das Repository-Verzeichnis.
2. Build Command: `npm run build`; Install Command: `npm ci`; Output Directory: `frontend/dist` (bereits in [`vercel.json`](./vercel.json) definiert).
3. Für den laufenden Betrieb `MONGODB_URI`, `MONGODB_DATABASE` und `JWT_SECRET` als serverseitige Environment Variables eintragen.
4. Discord-OAuth- und Rollenvariablen sind für den Dienstnummer-Login nicht erforderlich.
5. `VITE_API_URL=/api` ist optional; dies ist bereits der Standard.
6. Deployment starten und `/api/health`, `/api/auth/login`, `/api/auth/session` sowie einen direkten React-Seitenaufruf testen.

`api/index.js` bedient `/api`; `api/auth/*.js` ordnet die OAuth- und Session-Endpunkte explizit zu. `api/[...path].js` leitet weitere API-Pfade an denselben Express-Handler weiter. Die SPA-Rewrite-Regel schließt `/api` und alle `/api/...`-Pfade aus; direkte sowie unbekannte React-Routen werden auf die Vite-`index.html` zurückgeführt. Für API- und Frontend-Aufrufe wird dieselbe Vercel-Origin verwendet.

### Vercel Environment Variables

**Serverseitig erforderlich:** `MONGODB_URI`, `MONGODB_DATABASE`, `JWT_SECRET`.

**Discord:** `FRONTEND_URL`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`, `DISCORD_GUILD_ID` und Rollen-IDs bleiben optional und werden derzeit nicht verwendet.

**Frontend Build:** `VITE_API_URL=/api`. Keine anderen Geheimnisse als Vercel-Variablen mit `VITE_`-Präfix verfügbar machen.

## Discord-Bot separat betreiben

Der Python-Bot ist unabhängig von der Vercel-Anwendung und läuft auf einem separaten, dauerhaften Bot-Host. Bot-Token und API-Adresse gehören nur in dessen Secret-/Environment-Konfiguration. Installation:

```bash
python -m pip install -r bot/requirements.txt
```

`bot/.env.example` als `bot/.env` kopieren, Werte setzen und anschließend `python bot/bot.py` starten. Der Beispielbot bietet einen API-Health-Status; er schreibt keine Einsätze, Patienten oder Rechnungen.

## Echtzeit und Betriebsgrenzen

Vercel Functions halten keine dauerhaften WebSocket-Verbindungen. Funk-Nachrichten verwenden daher REST und periodisches Aktualisieren statt eines WebSocket-Servers. Eine spätere Socket.IO-Erweiterung muss als eigener persistenter Dienst betrieben werden.

MEDCNET ist kein zertifiziertes Medizinprodukt. Vor dem Umgang mit echten Gesundheitsdaten sind Datenschutz, Zugriffskontrollen, Aufbewahrung/Löschung, Backups, Monitoring und klinische Validierung verbindlich zu prüfen.
