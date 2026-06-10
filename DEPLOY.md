# Deploying Poker Night

The app deploys as a **single service**: the Node/Express server serves the
built React client *and* runs the Socket.IO game server from one URL. One thing
to deploy, no CORS wiring.

- **Build:** `npm run build` — installs server + client deps and builds the client to `client/dist`.
- **Start:** `npm start` — runs the server, which serves `client/dist` and the WebSocket API.
- **Port:** the server uses `process.env.PORT` (hosts set this automatically), falling back to `3001`.

> Heads-up: room/game state is held **in memory**, so a restart or scale-to-zero
> ends any games in progress. Fine for casual play; see "Persistence" below to
> harden it later.

## Prerequisite: push to GitHub (Render & Railway deploy from a repo)

```bash
git remote add origin https://github.com/<you>/poker-night.git
git push -u origin feature/deploy-prep      # or merge to main first
```

---

## Option A — Render (recommended, simplest)

1. Push the repo to GitHub (above).
2. Render dashboard → **New +** → **Blueprint** → select the repo.
   Render reads [`render.yaml`](./render.yaml) and configures the service.
3. Click **Apply / Deploy**. No env vars required (Render injects `PORT`).
4. Open the `…onrender.com` URL.

Free plan spins down when idle (~30s cold start on first hit).

## Option B — Railway

1. Push the repo to GitHub.
2. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
3. Railway reads [`railway.json`](./railway.json) (Nixpacks: `npm run build` → `npm start`)
   and injects `PORT`. Deploy, then open the generated domain
   (Settings → Networking → **Generate Domain** if needed).

Usage-based pricing after the trial credit.

## Option C — Fly.io (Docker)

Needs the [flyctl CLI](https://fly.io/docs/flyctl/install/).

```bash
fly auth login
fly launch --copy-config --no-deploy   # reads fly.toml; may rename app to keep it unique
fly deploy
fly open
```

Uses [`Dockerfile`](./Dockerfile) + [`fly.toml`](./fly.toml) (internal port 8080,
HTTPS forced, scale-to-zero when idle).

---

## Environment variables

All optional for a single-service deploy — see [`.env.example`](./.env.example).

| Var | Default | When to set |
|-----|---------|-------------|
| `PORT` | `3001` | Host injects it; rarely set manually. |
| `CLIENT_ORIGIN` | `*` | Only if hosting the client separately — lock CORS to its URL. |
| `VITE_SERVER_URL` | *(same origin)* | Build-time; only if the client is hosted apart from the API. |

## Local production smoke test

```bash
npm run build
PORT=3001 npm start
# open http://localhost:3001  — the server now serves the built client too
```

## Persistence (future hardening)

Games live in server memory and reset on restart. To survive restarts/multiple
instances, move room state to a shared store (e.g. Redis) and add a Socket.IO
Redis adapter. Not required for casual single-instance play.
