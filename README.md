# wolfXspotify-API

[![wolfXspotify](https://i.ibb.co/xqYMYMzf/og-image.png)](https://spotify.xwolf.space)

> **Free, unlimited Spotify music data API. No API key, no OAuth, no sign-up required.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Live-brightgreen)](https://spotify.xwolf.space)
[![Built by](https://img.shields.io/badge/Built%20by-Silent%20Wolf-00ff00)](https://github.com/WOLFTECH-254)
[![WOLF TECH](https://img.shields.io/badge/WOLF%20TECH-Open%20API-00cc44)](https://github.com/WOLFTECH-254)
[![Version](https://img.shields.io/badge/version-2.0.0-blue)](https://github.com/WOLFTECH-254/wolfXspotify-API/releases)

**Live API:** [https://spotify.xwolf.space](https://spotify.xwolf.space)

---

## What Is This?

**wolfXspotify-API** is a free public REST API that gives developers instant access to Spotify music catalogue data — tracks, albums, artists, playlists and search — without needing a Spotify developer account, API key, or OAuth flow.

It works by combining three data sources, falling through them in order until a result is found:

1. **Spotify Embed Scraping** — parses the open embed pages which are publicly accessible and carry full metadata including thumbnails, track lists, and preview URLs
2. **Spotify Partner GraphQL** — calls the internal Spotify GraphQL API using a TOTP-generated web-player token, used for search and richer playlist data (followers, owner info)
3. **MusicBrainz + Wikidata fallback** — for artist and album lookups, queries the MusicBrainz URL API and Wikidata SPARQL (P1902 for artists, P1729 for albums) to resolve IDs when direct embeds are unavailable

Built and maintained by **Silent Wolf** under **WOLF TECH**.

---

## Owner & Author

| | |
|---|---|
| **Name** | Silent Wolf |
| **Organisation** | WOLF TECH |
| **Country** | Kenya 🇰🇪 |
| **GitHub** | [@WOLFTECH-254](https://github.com/WOLFTECH-254) |
| **Role** | Founder & Lead Developer |

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check and uptime |
| GET | `/api/token` | Live Spotify web-player access token |
| GET | `/api/search` | Search tracks, albums, artists, playlists |
| GET | `/api/track/:id` | Full track metadata by Spotify ID |
| GET | `/api/album/:id` | Album details with complete track listing |
| GET | `/api/artist/:id` | Artist profile, genres and metadata |
| GET | `/api/artist/:id/top-tracks` | Artist top tracks |
| GET | `/api/artist/:id/albums` | Artist discography (albums, singles, compilations) |
| GET | `/api/playlist/:id` | Playlist info, owner, followers and all tracks |

---

## Quick Start

No setup, no keys. Call the API directly:

```bash
# Search for a track
curl "https://spotify.xwolf.space/api/search?q=Faded&type=track&limit=5"

# Get a track by Spotify ID
curl "https://spotify.xwolf.space/api/track/3n3Ppam7vgaVa1iaRUIOKE"

# Get album details (After Hours - The Weeknd)
curl "https://spotify.xwolf.space/api/album/4yP0hdKOZPNshxUOjY0cZj"

# Get artist profile (Alan Walker)
curl "https://spotify.xwolf.space/api/artist/7vk5e3vY1uw9plTHJAMwjN"

# Get artist top tracks
curl "https://spotify.xwolf.space/api/artist/7vk5e3vY1uw9plTHJAMwjN/top-tracks"

# Get artist discography
curl "https://spotify.xwolf.space/api/artist/7vk5e3vY1uw9plTHJAMwjN/albums?type=all&limit=20"

# Get a playlist (RapCaviar)
curl "https://spotify.xwolf.space/api/playlist/37i9dQZF1DX0XUsuxWHRQd"
```

---

## Search Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | Yes | — | Search query |
| `type` | string | No | `track` | `track`, `album`, `artist`, `playlist` |
| `limit` | number | No | 20 | Results count (max 50) |
| `offset` | number | No | 0 | Pagination offset |

## Artist Albums Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `type` | string | No | `album` | `album`, `single`, `compilation`, `all` |
| `limit` | number | No | 20 | Results count (max 50) |
| `offset` | number | No | 0 | Pagination offset |

---

## Response Format

All endpoints return a consistent envelope:

```json
{
  "provider": "WOLF TECH",
  "creator": "Silent Wolf",
  "success": true,
  "track": { ... }
}
```

Error responses:

```json
{
  "provider": "WOLF TECH",
  "creator": "Silent Wolf",
  "success": false,
  "error": "Description of what went wrong"
}
```

---

## Using the Token

The `/api/token` endpoint returns an anonymous Spotify web-player access token generated via a TOTP mechanism — the same method the Spotify web player uses internally. The token is automatically refreshed every 30 minutes.

### Token response shape

```json
{
  "provider": "WOLF TECH",
  "creator": "Silent Wolf",
  "success": true,
  "access_token": "BQD3v7...",
  "token_type": "Bearer"
}
```

### Calling Spotify's API directly with this token

Once you have the token you can call any of Spotify's public `/v1` endpoints yourself.

**bash / curl**

```bash
# Step 1: grab the token
TOKEN=$(curl -s https://spotify.xwolf.space/api/token | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).access_token))")

# Step 2: use it with Spotify's API
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.spotify.com/v1/search?q=Faded&type=track&limit=5"
```

**JavaScript (fetch)**

```js
async function getToken() {
  const res = await fetch('https://spotify.xwolf.space/api/token');
  const data = await res.json();
  return data.access_token;
}

async function searchSpotify(query) {
  const token = await getToken();
  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.json();
}
```

**Python**

```python
import requests

def get_token():
    r = requests.get('https://spotify.xwolf.space/api/token')
    return r.json()['access_token']

def search_spotify(query):
    token = get_token()
    r = requests.get(
        'https://api.spotify.com/v1/search',
        params={'q': query, 'type': 'track', 'limit': 10},
        headers={'Authorization': f'Bearer {token}'}
    )
    return r.json()
```

### Token caching (recommended)

The token is valid for ~1 hour. Cache it to avoid unnecessary requests:

```js
let _token = null;
let _expiresAt = 0;

async function getToken() {
  if (_token && Date.now() < _expiresAt) return _token;
  const res = await fetch('https://spotify.xwolf.space/api/token');
  const { access_token } = await res.json();
  _token = access_token;
  _expiresAt = Date.now() + (3600 - 60) * 1000; // refresh 60s before expiry
  return _token;
}
```

---

## Self-Hosting

### Requirements

- Node.js 18+
- npm 8+

### Environment Variables

Create a `.env` file (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Port to listen on |
| `REFRESH_INTERVAL_MINUTES` | `30` | Token auto-refresh interval |
| `GITHUB_TOKEN` | — | Optional: GitHub PAT with **`repo` scope only** — used to commit `tokens.json` |
| `GITHUB_REPO` | — | Optional: target repo for token storage (e.g. `WOLFTECH-254/wolfXspotify-API`) |
| `GITHUB_FILE_PATH` | `tokens.json` | Optional: file path within the repo |

### Run Locally

```bash
git clone https://github.com/WOLFTECH-254/wolfXspotify-API.git
cd wolfXspotify-API
npm install
npm start
```

### Deploy with PM2 (VPS)

```bash
npm install -g pm2
pm2 start src/index.js --name wolf-spotify-api
pm2 save
pm2 startup
```

### Token Auto-Refresh (VPS Cron)

To keep the token fresh and committed to GitHub every 30 minutes, add a cron job on your VPS:

```bash
# Edit crontab
crontab -e

# Add this line (adjust path as needed)
*/30 * * * * cd /path/to/wolfXspotify-API && node scripts/refresh.js >> /var/log/wolf-refresh.log 2>&1
```

This commits a fresh `tokens.json` to your configured `GITHUB_REPO` every 30 minutes — which is why a commit is always visible as "30 minutes ago" on GitHub. Requires `GITHUB_TOKEN` and `GITHUB_REPO` to be set in `.env`.

> **Token scope:** Generate a classic PAT at GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic). Enable the **`repo`** scope only — that is the only permission needed to push a single file to the repository.

---

## Project Structure

```
wolfXspotify-API/
├── src/
│   ├── index.js                  - Express server entry point and route registration
│   ├── token-manager.js          - Token cache, TOTP auth and refresh scheduler
│   ├── totp.js                   - Spotify TOTP token generation
│   ├── spotify-graphql.js        - Shared embed scraping and partner GraphQL helpers
│   ├── rate-limit-state.js       - Per-strategy backoff and rate-limit tracking
│   ├── github.js                 - GitHub token persistence (optional)
│   ├── response.js               - Standardised response helpers (WOLF TECH branding)
│   ├── crypto.js                 - Crypto utilities
│   └── routes/
│       ├── track.js              - GET /api/track/:id
│       ├── album.js              - GET /api/album/:id
│       ├── artist.js             - GET /api/artist/:id and /top-tracks
│       ├── artistAlbums.js       - GET /api/artist/:id/albums
│       ├── playlist.js           - GET /api/playlist/:id
│       └── search.js             - GET /api/search
├── public/
│   ├── index.html                - Interactive API documentation homepage
│   ├── terms.html                - Terms & Conditions
│   ├── disclaimer.html           - Disclaimer
│   ├── favicon.svg               - Site favicon
│   └── og.png                    - Social media preview image
├── scripts/
│   ├── refresh.js                - Token refresh + GitHub commit (run via VPS cron)
│   ├── raw-push.js               - Push source files to GitHub as-is
│   └── obfuscate-push.js         - Obfuscate source files and push to GitHub
├── tokens.json                   - Local token cache (auto-updated)
├── .env.example
├── CONTRIBUTING.md
├── DISCLAIMER.md
├── LICENSE
├── SECURITY.md
└── README.md
```

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a pull request.

## Security

Found a vulnerability? Please read our [Security Policy](SECURITY.md) for responsible disclosure guidelines.

## Disclaimer

This is an independent open-source project not affiliated with or endorsed by Spotify AB. Read the full [DISCLAIMER.md](DISCLAIMER.md).

## License

[MIT](LICENSE) © 2026 Silent Wolf · WOLF TECH

---

<div align="center">
  <strong>Built with passion in Kenya 🇰🇪 by <a href="https://github.com/WOLFTECH-254">Silent Wolf</a> &middot; WOLF TECH</strong>
</div>
