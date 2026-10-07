# MEDCNET

MEDCNET is a React/Vite medical dispatch and hospital-management dashboard backed by Express serverless API routes and MongoDB Atlas. Production deployment targets Vercel. There is no browser demo mode or local mock-data fallback: protected views require Discord OAuth and persisted API data.

## Repository layout

```text
MEDCNET/
├── frontend/              # React, TypeScript, Vite SPA
├── api/                   # Vercel Functions (Express adapter)
├── backend/               # Express routes, models, auth, services
├── bot/                   # Optional Discord bot process (host separately)
├── .env.example
├── vercel.json
├── package.json
└── pnpm-workspace.yaml
```

## Deploy to Vercel

1. Push the repository to GitHub and import it in Vercel. Keep the **Root Directory** at the repository root.
2. Keep the build command `npm run build` and output directory `frontend/dist` from `vercel.json`. The repository includes `pnpm-lock.yaml`; Vercel should use pnpm's frozen-lockfile install automatically.
3. Add the server-side variables listed below to the Vercel project for Production (and Preview if previews should be usable).
4. Set `FRONTEND_URL` to the canonical public origin, without a trailing slash, e.g. `https://medcnet.example.com`.
5. Set `DISCORD_REDIRECT_URI` to `https://medcnet.example.com/api/auth/callback`.
6. Add that exact callback URL to the OAuth2 Redirects in the Discord Developer Portal.
7. Set Vercel's build-time `VITE_API_URL` to `/api` (this is also the code default), then deploy.
8. Verify `https://<domain>/api/health`, sign in through Discord, then verify a direct route such as `https://<domain>/dispatch`.

`vercel.json` deploys the Express API as serverless functions and rewrites client-side routes to the Vite SPA. The API functions use the same origin as the site, so no public API hostname or localhost URL is embedded in the production frontend.

### Vercel Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string; server-side only |
| `MONGODB_DATABASE` | Yes | Atlas database name, e.g. `medcnet` |
| `JWT_SECRET` | Yes | At least 32 random characters; signs secure HttpOnly session cookies |
| `FRONTEND_URL` | Yes | Canonical HTTPS site origin, no trailing slash |
| `DISCORD_CLIENT_ID` | Yes | Discord OAuth2 application client ID |
| `DISCORD_CLIENT_SECRET` | Yes | Discord OAuth2 secret; never use a `VITE_` prefix |
| `DISCORD_REDIRECT_URI` | Yes | Exact HTTPS callback ending in `/api/auth/callback` |
| `DISCORD_GUILD_ID` | Yes | Discord server used for member and role authorization |
| `ADMIN_ROLE_ID` | Recommended | Discord role mapped to MEDCNET Admin |
| `MODERATOR_ROLE_ID` | Recommended | Discord role mapped to Moderator |
| `FIRE_ROLE_ID` | Optional | Discord role mapped to Feuerwehr |
| `POLICE_ROLE_ID` | Optional | Discord role mapped to Rettungsdienst |
| `MEMBER_ROLE_ID` | Optional | Discord role required for general server-member access |
| `VITE_API_URL` | No | Frontend build-time API base; use `/api` for Vercel same-origin deployment |

Generate `JWT_SECRET` with:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Do not commit `.env` files or place secrets in `VITE_*` variables. `.env.example` contains names and non-secret examples only.

### MongoDB Atlas

Create a dedicated database user with the minimum required permissions. Configure Atlas Network Access to allow connections from the Vercel runtime. The application creates its Mongoose collections on writes. Set `MONGODB_URI` and `MONGODB_DATABASE` in Vercel; missing or unavailable MongoDB produces explicit API errors rather than fake data.

### Discord OAuth2

In the Discord Developer Portal, enable OAuth2 and register the exact `DISCORD_REDIRECT_URI`. The application requests `identify` and `guilds.members.read`, checks guild membership, and maps configured role IDs to MEDCNET roles. Configure the guild's role IDs in Vercel. The Discord client secret stays server-side.

## API, routing and live updates

- Serverless API entry points: `api/index.js` and `api/[...path].js`; API handlers delegate to the Express app in `backend/`.
- MongoDB connections are reused between invocations when the serverless runtime stays warm.
- React Router routes such as `/dashboard`, `/dispatch`, `/hospital`, `/patients`, `/beds`, `/radio`, `/invoices`, `/vehicles`, `/profile`, and `/admin` are rewritten to the SPA entry point.
- Vercel Functions do not host persistent WebSocket connections. The radio UI instead uses authenticated REST requests and refreshes messages every 10 seconds, which works with serverless execution and needs no separate socket host.
- The optional Python Discord bot is independent of Vercel and only checks the public API health endpoint. Invite it with the `bot` and `applications.commands` OAuth scopes and deploy it as a separate always-on process; see `bot/`.

## Optional local development

Use Node.js 20 or later and pnpm:

```bash
corepack enable
pnpm install
Copy-Item .env.example .env
Copy-Item frontend/.env.example frontend/.env
$env:MEDCNET_API_PROXY_TARGET = "http://127.0.0.1:4000"
pnpm dev
```

The root example uses a Vercel origin; for local OAuth testing, set `FRONTEND_URL` and `DISCORD_REDIRECT_URI` to the local frontend/backend origins in your untracked `.env`, and register the local callback in Discord. MongoDB Atlas is still required for real data. No demo login or local in-memory database is provided.

The bot is optional and is installed/run separately:

```bash
python -m pip install -r bot/requirements.txt
```

Copy `bot/.env.example` to `bot/.env`, fill in the Discord bot token and deployed API URL, then run `python bot/bot.py`. Never run the bot as a Vercel Function or commit its token.
`DISCORD_BOT_TOKEN` and `MEDCNET_API_URL` belong in the separate bot host's environment, not in Vercel.

## Production limitations

MEDCNET is an operational software starter, not a certified medical device or clinically validated system. Before processing real patient data, establish applicable privacy/security controls, retention and deletion policy, backups, monitoring, least-privilege access, and clinical validation. The sample bot currently provides API-health status only; it does not create or modify dispatch, patient, radio, or invoice records.
