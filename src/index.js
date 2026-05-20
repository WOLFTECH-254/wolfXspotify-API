require('dotenv').config();
const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { respond, respondError } = require('./response');
const { getToken, startScheduler } = require('./token-manager');

const app = express();
const PORT = process.env.PORT || 5000;
const START_TIME = Date.now();

// ─────────────────────────────────────────────────────────────────
//  RATE LIMIT CONFIG — adjust these values as needed
// ─────────────────────────────────────────────────────────────────

const RATE_LIMITS = {
  // General API: applies to all /api/* routes
  // 200 requests per IP per 15 minutes
  general: { windowMs: 15 * 60 * 1000, max: 200 },

  // Search: slightly stricter to protect GraphQL calls
  // 60 searches per IP per 15 minutes
  search: { windowMs: 15 * 60 * 1000, max: 60 },

  // Token: loose — clients cache for an hour so hits are infrequent
  // 30 token fetches per IP per 15 minutes
  token: { windowMs: 15 * 60 * 1000, max: 30 },
};

// ─────────────────────────────────────────────────────────────────

function makeLimit({ windowMs, max }, message) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      respondError(res, 429, message || `Too many requests. Please slow down and try again later.`);
    },
  });
}

const generalLimiter = makeLimit(RATE_LIMITS.general, 'Rate limit exceeded. Max 200 requests per 15 minutes per IP.');
const searchLimiter  = makeLimit(RATE_LIMITS.search,  'Search rate limit exceeded. Max 60 searches per 15 minutes per IP.');
const tokenLimiter   = makeLimit(RATE_LIMITS.token,   'Token rate limit exceeded. Max 30 requests per 15 minutes per IP.');

// ── Middleware ──
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Apply general limiter to all /api routes
app.use('/api', generalLimiter);

// ── Routes ──
app.use('/api/search',   searchLimiter, require('./routes/search'));
app.use('/api/track',    require('./routes/track'));
app.use('/api/album',    require('./routes/album'));
app.use('/api/artist',   require('./routes/artist'));
app.use('/api/artist',   require('./routes/artistAlbums'));
app.use('/api/playlist', require('./routes/playlist'));

app.get('/api/token', tokenLimiter, async (req, res) => {
  try {
    const token = await getToken();
    if (!token) return respondError(res, 503, 'Access token unavailable. Try again shortly.');
    respond(res, 200, {
      note: 'Anonymous Spotify web-player token. Valid for ~1 hour. Use as: Authorization: Bearer <access_token>',
      access_token: token,
      token_type: 'Bearer',
      usage: {
        search: 'GET https://api.spotify.com/v1/search?q=Faded&type=track&limit=10',
        track: 'GET https://api.spotify.com/v1/tracks/{id}',
        album: 'GET https://api.spotify.com/v1/albums/{id}',
        artist: 'GET https://api.spotify.com/v1/artists/{id}',
        playlist: 'GET https://api.spotify.com/v1/playlists/{id}',
      },
    });
  } catch (err) {
    respondError(res, 500, err.message || 'Failed to fetch token');
  }
});

app.get('/api/health', (req, res) => {
  respond(res, 200, {
    status: 'ok',
    uptime_seconds: Math.floor((Date.now() - START_TIME) / 1000),
  });
});

app.get('/api', (req, res) => {
  respond(res, 200, {
    name: 'WOLF TECH · Silent Wolf API',
    version: '2.0.0',
    endpoints: [
      { method: 'GET', path: '/api/token',                              description: 'Get live Spotify access token' },
      { method: 'GET', path: '/api/health',                             description: 'API health check' },
      { method: 'GET', path: '/api/search?q=&type=&limit=&offset=',     description: 'Search tracks, albums, artists, playlists' },
      { method: 'GET', path: '/api/track/:id',                          description: 'Track details by Spotify ID' },
      { method: 'GET', path: '/api/album/:id',                          description: 'Album details + tracklist' },
      { method: 'GET', path: '/api/artist/:id',                         description: 'Artist profile' },
      { method: 'GET', path: '/api/artist/:id/top-tracks',              description: 'Artist top tracks' },
      { method: 'GET', path: '/api/artist/:id/albums?type=&limit=&offset=', description: 'Artist discography (albums, singles, compilations)' },
      { method: 'GET', path: '/api/playlist/:id',                       description: 'Playlist with tracks' },
    ],
  });
});

app.use((req, res) => {
  respondError(res, 404, 'Endpoint not found. Visit /api for available endpoints.');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Sportify API running on port ${PORT}`);
  const interval = parseInt(process.env.REFRESH_INTERVAL_MINUTES) || 30;
  startScheduler(interval);
});
