require('dotenv').config();
const express = require('express');
const path = require('path');
const { respond, respondError } = require('./response');
const { getToken } = require('./token-manager');
const { startScheduler } = require('./token-manager');

const app = express();
const PORT = process.env.PORT || 5000;
const START_TIME = Date.now();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/search', require('./routes/search'));
app.use('/api/track', require('./routes/track'));
app.use('/api/album', require('./routes/album'));
app.use('/api/artist', require('./routes/artist'));
app.use('/api/playlist', require('./routes/playlist'));

app.get('/api/token', async (req, res) => {
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
      { method: 'GET', path: '/api/token', description: 'Get live Spotify access token' },
      { method: 'GET', path: '/api/health', description: 'API health check' },
      { method: 'GET', path: '/api/search?q=&type=&limit=&offset=', description: 'Search tracks, albums, artists, playlists' },
      { method: 'GET', path: '/api/track/:id', description: 'Track details by Spotify ID' },
      { method: 'GET', path: '/api/album/:id', description: 'Album details + tracklist' },
      { method: 'GET', path: '/api/artist/:id', description: 'Artist profile' },
      { method: 'GET', path: '/api/artist/:id/top-tracks', description: 'Artist top tracks' },
      { method: 'GET', path: '/api/playlist/:id', description: 'Playlist with tracks' },
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
