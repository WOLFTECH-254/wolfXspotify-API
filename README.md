# Sportify API

> **Free, unlimited Spotify music data API. No API key, no OAuth, no sign-up required.**

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Live-brightgreen)](https://sportify.xcasper.space)
[![Built by](https://img.shields.io/badge/Built%20by-TRABY%20CASPER-7c3aed)](https://xcasper.space)
[![CASPER TECH](https://img.shields.io/badge/CASPER%20TECH-Open%20API-a855f7)](https://xcasper.space)
[![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://github.com/Casper-Tech-ke/sportify-api/releases/tag/v1.0.0)

**Live API:** [https://sportify.xcasper.space](https://sportify.xcasper.space)

---

## What Is This?

Sportify API is a free public REST API that gives developers instant access to Spotify music catalogue data — tracks, albums, artists, playlists and search — without needing a Spotify developer account, API key, or OAuth flow.

It works by combining three data sources, falling through them in order until a result is found:

1. **Spotify Embed Scraping** — parses the open embed pages which are publicly accessible and carry full metadata including thumbnails, track lists, and preview URLs
2. **Spotify Partner GraphQL** — calls the internal Spotify GraphQL API using a TOTP-generated web-player token, used for search and richer playlist data (followers, owner info)
3. **MusicBrainz + Wikidata fallback** — for artist and album lookups, queries the MusicBrainz URL API and Wikidata SPARQL (properties P1902 for artists, P1729 for albums) to resolve IDs when direct embeds are unavailable

Built and maintained by **TRABY CASPER** under the **CASPER TECH** umbrella.

---

## Owner & Author

| | |
|---|---|
| **Name** | TRABY CASPER |
| **Organisation** | CASPER TECH |
| **Country** | Kenya |
| **Website** | [xcasper.space](https://xcasper.space) |
| **GitHub** | [@Casper-Tech-ke](https://github.com/Casper-Tech-ke) |
| **Role** | Founder & Lead Developer |

CASPER TECH is a Kenyan tech initiative building free, accessible developer tools and APIs for African and global developers. Sportify API is part of the CASPER TECH API Hub — home to 150+ free API endpoints at [apis.xcasper.space](https://apis.xcasper.space).

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check and uptime status |
| GET | `/api/token` | Current Spotify web-player access token |
| GET | `/api/search` | Search tracks, albums, artists, playlists |
| GET | `/api/track/:id` | Full track metadata by Spotify ID |
| GET | `/api/album/:id` | Album details with complete track listing |
| GET | `/api/playlist/:id` | Playlist info, owner, followers and all tracks |
| GET | `/api/artist/:id` | Artist profile, genres and metadata |
| GET | `/api/artist/:id/top-tracks` | Artist top tracks |

---

## Quick Start

No setup, no keys. Call the API directly:

```bash
# Search for a track
curl "https://sportify.xcasper.space/api/search?q=Faded&type=track&limit=5"

# Get a track by Spotify ID
curl "https://sportify.xcasper.space/api/track/3n3Ppam7vgaVa1iaRUIOKE"

# Get album details (After Hours - The Weeknd)
curl "https://sportify.xcasper.space/api/album/4yP0hdKOZPNshxUOjY0cZj"

# Get artist profile (Alan Walker)
curl "https://sportify.xcasper.space/api/artist/7vk5e3vY1uw9plTHJAMwjN"

# Get artist top tracks
curl "https://sportify.xcasper.space/api/artist/7vk5e3vY1uw9plTHJAMwjN/top-tracks"

# Get a playlist (RapCaviar)
curl "https://sportify.xcasper.space/api/playlist/37i9dQZF1DX0XUsuxWHRQd"
```

---

## Search Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | Yes | - | Search query |
| `type` | string | Yes | - | `track`, `album`, `artist`, `playlist` |
| `limit` | number | No | 10 | Results count (max 50) |
| `offset` | number | No | 0 | Pagination offset |

---

## Response Format

All endpoints return a consistent envelope:

```json
{
  "provider": "CASPER TECH",
  "creator": "TRABY CASPER",
  "success": true,
  "track": { ... }
}
```

Error responses:

```json
{
  "provider": "CASPER TECH",
  "creator": "TRABY CASPER",
  "success": false,
  "error": "Description of what went wrong"
}
```

---

## Using the Token

The `/api/token` endpoint returns an anonymous Spotify web-player access token generated internally via a TOTP mechanism — the same method the Spotify web player uses. The token is automatically refreshed every 30 minutes.

### Token response shape

```json
{
  "provider": "CASPER TECH",
  "creator": "TRABY CASPER",
  "success": true,
  "token": "BQD3v7...",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

| Field | Description |
|-------|-------------|
| `token` | The Bearer access token string |
| `expiresIn` | Seconds until expiry (typically 3600 = 1 hour) |
| `tokenType` | Always `"Bearer"` |

### Calling Spotify's API directly with this token

Once you have the token you can call any of Spotify's public `/v1` endpoints yourself — no developer account or app registration needed.

**bash / curl**

```bash
# Step 1: grab the token
TOKEN=$(curl -s https://sportify.xcasper.space/api/token \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# Step 2: use it with Spotify's API
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.spotify.com/v1/search?q=Faded&type=track&limit=5"

curl -H "Authorization: Bearer $TOKEN" \
  "https://api.spotify.com/v1/tracks/3n3Ppam7vgaVa1iaRUIOKE"

curl -H "Authorization: Bearer $TOKEN" \
  "https://api.spotify.com/v1/artists/7vk5e3vY1uw9plTHJAMwjN"

curl -H "Authorization: Bearer $TOKEN" \
  "https://api.spotify.com/v1/albums/4yP0hdKOZPNshxUOjY0cZj"
```

**JavaScript (fetch)**

```js
async function getToken() {
  const res = await fetch('https://sportify.xcasper.space/api/token');
  const data = await res.json();
  return data.token;
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
    r = requests.get('https://sportify.xcasper.space/api/token')
    return r.json()['token']

def search_spotify(query):
    token = get_token()
    r = requests.get(
        'https://api.spotify.com/v1/search',
        params={'q': query, 'type': 'track', 'limit': 10},
        headers={'Authorization': f'Bearer {token}'}
    )
    return r.json()
```

### Token caching

The token is valid for ~1 hour. Cache it and only re-fetch when it expires to avoid unnecessary requests:

```js
let _token = null;
let _expiresAt = 0;

async function getToken() {
  if (_token && Date.now() < _expiresAt) return _token;
  const res = await fetch('https://sportify.xcasper.space/api/token');
  const { token, expiresIn } = await res.json();
  _token = token;
  _expiresAt = Date.now() + (expiresIn - 60) * 1000; // refresh 60s before expiry
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
| `PORT` | `3007` | Port to listen on |
| `REFRESH_INTERVAL_MINUTES` | `30` | Token auto-refresh interval |
| `GITHUB_TOKEN` | - | Optional: persist token across restarts |
| `GITHUB_REPO` | - | Optional: repo for token storage (e.g. `user/repo`) |

### Run Locally

```bash
git clone https://github.com/Casper-Tech-ke/sportify-api.git
cd sportify-api
npm install
npm start
```

### Deploy with PM2

```bash
npm install -g pm2
pm2 start src/index.js --name sportify-api
pm2 save
pm2 startup
```

---

## Project Structure

```
sportify-api/
├── src/
│   ├── index.js              - Express server entry point and route registration
│   ├── token-manager.js      - Token cache, TOTP auth and refresh scheduler
│   ├── totp.js               - Spotify TOTP token generation
│   ├── spotify-graphql.js    - Shared embed scraping and partner GraphQL helpers
│   ├── rate-limit-state.js   - Per-strategy backoff and rate-limit tracking
│   ├── github.js             - GitHub token persistence (optional)
│   ├── response.js           - Standardised response helpers
│   ├── crypto.js             - Crypto utilities
│   └── routes/
│       ├── track.js          - GET /api/track/:id
│       ├── album.js          - GET /api/album/:id
│       ├── artist.js         - GET /api/artist/:id and /top-tracks
│       ├── playlist.js       - GET /api/playlist/:id
│       └── search.js         - GET /api/search
├── public/
│   ├── index.html            - Interactive API documentation page
│   ├── terms.html            - Terms & Conditions
│   ├── disclaimer.html       - Disclaimer
│   ├── favicon.svg           - Site favicon
│   └── og.png                - Social media preview image
├── scripts/
│   ├── refresh.js            - Manual token refresh
│   └── raw-push.js           - GitHub file push utility
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

[MIT](LICENSE) © 2025 TRABY CASPER · CASPER TECH

---

<div align="center">
  <strong>Built with passion in Kenya by <a href="https://xcasper.space">TRABY CASPER</a> &middot; CASPER TECH</strong>
</div>
