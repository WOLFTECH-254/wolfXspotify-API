const express = require('express');
const router = express.Router();
const { respond, respondError } = require('../response');
const { spotifyGraphQL, formatDuration, bestImage } = require('../spotify-graphql');

const SEARCH_HASH = '3c9d3f60dac5dea3876b6db3f534192b1c1d90032c4233c1bbaba526db41eb31';

const CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE = 500;
const cache = new Map();

function cacheGet(key) {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL) { cache.delete(key); return null; }
  return e.data;
}
function cacheSet(key, data) {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(key, { data, ts: Date.now() });
}

function idFromUri(uri) {
  return uri ? uri.split(':')[2] || '' : '';
}

function mapTrack(t) {
  const ms = t.duration?.totalMilliseconds || t.duration_ms || 0;
  const id = t.id || idFromUri(t.uri) || '';
  return {
    id,
    title: t.name || '',
    artist: (t.artists?.items || []).map(a => a.profile?.name || a.name || '').join(', '),
    artists: (t.artists?.items || []).map(a => a.profile?.name || a.name || ''),
    album: t.albumOfTrack?.name || t.album?.name || '',
    url: `https://open.spotify.com/track/${id}`,
    thumbnail: bestImage(t.albumOfTrack?.coverArt?.sources || t.album?.images),
    duration: formatDuration(ms),
    duration_ms: ms,
    release_date: t.albumOfTrack?.date?.year ? String(t.albumOfTrack.date.year) : (t.album?.release_date || ''),
    explicit: t.contentRating?.label === 'EXPLICIT' || t.explicit || false,
    track_number: t.trackNumber || 0,
  };
}

function mapAlbum(a) {
  const id = idFromUri(a.uri);
  return {
    id,
    name: a.name || '',
    artist: (a.artists?.items || []).map(x => x.profile?.name || x.name || '').join(', '),
    artists: (a.artists?.items || []).map(x => x.profile?.name || x.name || ''),
    url: `https://open.spotify.com/album/${id}`,
    thumbnail: bestImage(a.coverArt?.sources),
    release_date: a.date?.year ? String(a.date.year) : '',
    type: (a.type || '').toLowerCase(),
  };
}

function mapArtist(a) {
  const id = idFromUri(a.uri);
  return {
    id,
    name: a.profile?.name || a.name || '',
    url: `https://open.spotify.com/artist/${id}`,
    thumbnail: bestImage(a.visuals?.avatarImage?.sources),
  };
}

function mapPlaylist(p) {
  const id = idFromUri(p.uri);
  return {
    id,
    name: p.name || '',
    description: p.description || '',
    url: `https://open.spotify.com/playlist/${id}`,
    thumbnail: bestImage(p.images?.items?.[0]?.sources),
    owner: p.ownerV2?.data?.name || p.ownerV2?.data?.username || '',
  };
}

router.get('/', async (req, res) => {
  const { q, type = 'track', limit = 20, offset = 0 } = req.query;
  if (!q || !q.trim()) return respondError(res, 400, 'Missing query parameter: q');

  const validTypes = ['track', 'album', 'artist', 'playlist'];
  const requestedType = type.toLowerCase().split(',')[0].trim();
  if (!validTypes.includes(requestedType))
    return respondError(res, 400, `Invalid type. Valid values: ${validTypes.join(', ')}`);

  const parsedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 50);
  const parsedOffset = Math.max(parseInt(offset) || 0, 0);
  const cacheKey = `${q}|${requestedType}|${parsedLimit}|${parsedOffset}`;

  const cached = cacheGet(cacheKey);
  if (cached) return respond(res, 200, { query: q, type: requestedType, cached: true, ...cached });

  try {
    const data = await spotifyGraphQL('searchDesktop', SEARCH_HASH, {
      searchTerm: q.trim(),
      offset: parsedOffset,
      limit: parsedLimit,
      numberOfTopResults: 5,
      includeAudiobooks: false,
      includeArtistHasConcertsField: false,
      includePreReleases: true,
      includeLocalConcertsField: false,
    });

    const search = data?.data?.searchV2;
    if (!search) throw new Error('Empty response from Spotify GraphQL');

    let results = [];
    if (requestedType === 'track') {
      results = (search.tracksV2?.items || [])
        .map(i => i?.item?.data || i?.track || i)
        .filter(t => t?.id || t?.uri)
        .map(mapTrack);
    } else if (requestedType === 'album') {
      results = (search.albumsV2?.items || [])
        .map(i => i?.data || i)
        .filter(a => a?.uri)
        .map(mapAlbum);
    } else if (requestedType === 'artist') {
      results = (search.artists?.items || [])
        .map(i => i?.data || i)
        .filter(a => a?.uri)
        .map(mapArtist);
    } else if (requestedType === 'playlist') {
      results = (search.playlists?.items || [])
        .map(i => i?.data || i)
        .filter(p => p?.uri)
        .map(mapPlaylist);
    }

    if (results.length === 0)
      return respondError(res, 404, 'No results found for your query');

    const payload = { total: results.length, results };
    cacheSet(cacheKey, payload);
    respond(res, 200, { query: q, type: requestedType, cached: false, ...payload });

  } catch (err) {
    respondError(res, 500, err.message || 'Search failed');
  }
});

module.exports = router;
