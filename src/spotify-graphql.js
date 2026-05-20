const { getToken, getClientToken } = require('./token-manager');

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';
const WD_UA = 'Sportify-API/1.0 (https://sportify.xcasper.space)';
const APP_VERSION = '1.2.84.359.g17db506e';
const GRAPHQL_URL = 'https://api-partner.spotify.com/pathfinder/v2/query';
const SEARCH_HASH = '3c9d3f60dac5dea3876b6db3f534192b1c1d90032c4233c1bbaba526db41eb31';

async function spotifyGraphQL(operationName, sha256Hash, variables) {
  const accessToken = await getToken();
  if (!accessToken) throw new Error('Could not obtain Spotify access token');

  const clientToken = await getClientToken();
  const headers = {
    'accept': 'application/json',
    'accept-language': 'en-GB',
    'app-platform': 'WebPlayer',
    'authorization': `Bearer ${accessToken}`,
    'content-type': 'application/json;charset=UTF-8',
    'spotify-app-version': APP_VERSION,
    'User-Agent': UA,
    'Referer': 'https://open.spotify.com/',
    'Origin': 'https://open.spotify.com',
  };
  if (clientToken) headers['client-token'] = clientToken;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST', headers,
    body: JSON.stringify({
      variables,
      operationName,
      extensions: { persistedQuery: { version: 1, sha256Hash } },
    }),
    signal: ctrl.signal,
  }).finally(() => clearTimeout(t));

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GraphQL ${operationName} failed: ${res.status} — ${body.slice(0, 120)}`);
  }
  return res.json();
}

// Extract __NEXT_DATA__ entity from Spotify embed page (works for tracks + playlists)
async function fetchEmbedEntity(type, id) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  const res = await fetch(`https://open.spotify.com/embed/${type}/${id}`, {
    headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' },
    signal: ctrl.signal,
  }).finally(() => clearTimeout(t));

  if (!res.ok) throw new Error(`Embed fetch failed: ${res.status}`);
  const html = await res.text();
  const m = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('No __NEXT_DATA__ in embed page');
  const json = JSON.parse(m[1]);
  const entity = json?.props?.pageProps?.state?.data?.entity;
  if (!entity) throw new Error(`No entity found for ${type}/${id}`);
  return entity;
}

// Fetch oEmbed (works for tracks only)
async function fetchOEmbed(type, id) {
  const url = `https://open.spotify.com/oembed?url=https://open.spotify.com/${type}/${id}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal }).finally(() => clearTimeout(t));
  if (!res.ok) throw new Error(`oEmbed failed: ${res.status}`);
  return res.json();
}

// MusicBrainz: Spotify URL → entity info
// Uses crowd-sourced mappings; covers many popular artists/releases
async function mbLookupName(spotifyType, spotifyId, mbRelType) {
  const spotifyUrl = encodeURIComponent(`https://open.spotify.com/${spotifyType}/${spotifyId}`);
  const url = `https://musicbrainz.org/ws/2/url?resource=${spotifyUrl}&inc=${mbRelType}-rels&fmt=json`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  const res = await fetch(url, {
    headers: { 'User-Agent': WD_UA, Accept: 'application/json' },
    signal: ctrl.signal,
  }).finally(() => clearTimeout(t));
  if (!res.ok) return null;
  const data = await res.json();
  for (const rel of data?.relations || []) {
    const entity = rel[mbRelType] || rel['release'];
    if (entity) return entity;
  }
  return null;
}

// Wikidata SPARQL: Spotify ID → entity label (name)
// P1902 = Spotify artist ID, P1729 = Spotify album ID
async function wdLookupName(wdProperty, spotifyId) {
  const sparql = `SELECT ?item ?label WHERE { ?item wdt:${wdProperty} "${spotifyId}". ?item rdfs:label ?label. FILTER(LANG(?label) = "en") } LIMIT 1`;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  const res = await fetch(url, {
    headers: { 'User-Agent': WD_UA, Accept: 'application/sparql-results+json' },
    signal: ctrl.signal,
  }).finally(() => clearTimeout(t));
  if (!res.ok) return null;
  const data = await res.json();
  return data?.results?.bindings?.[0]?.label?.value || null;
}

// Search Spotify GraphQL and find item matching the given Spotify URI
async function searchAndMatchByUri(searchTerm, spotifyUri, resultType) {
  const data = await spotifyGraphQL('searchDesktop', SEARCH_HASH, {
    searchTerm,
    offset: 0,
    limit: 10,
    numberOfTopResults: 5,
    includeAudiobooks: false,
    includeArtistHasConcertsField: false,
    includePreReleases: true,
    includeLocalConcertsField: false,
  });

  const sv2 = data?.data?.searchV2;
  if (!sv2) return null;

  if (resultType === 'artist') {
    const items = sv2?.artists?.items || [];
    for (const item of items) {
      if (item?.data?.uri === spotifyUri) return { type: 'artist', data: item.data };
    }
    return items[0]?.data ? { type: 'artist', data: items[0].data } : null;
  }

  if (resultType === 'album') {
    const items = sv2?.albumsV2?.items || [];
    for (const item of items) {
      if (item?.data?.uri === spotifyUri) return { type: 'album', data: item.data };
    }
    return items[0]?.data ? { type: 'album', data: items[0].data } : null;
  }

  return null;
}

function formatDuration(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function bestImage(sources) {
  if (!sources || !sources.length) return '';
  return [...sources].sort((a, b) => (b.height || b.width || 0) - (a.height || a.width || 0))[0]?.url || '';
}

function idFromUri(uri) {
  return uri ? uri.split(':').pop() || '' : '';
}

module.exports = {
  spotifyGraphQL,
  fetchEmbedEntity,
  fetchOEmbed,
  mbLookupName,
  wdLookupName,
  searchAndMatchByUri,
  formatDuration,
  bestImage,
  idFromUri,
  UA,
  SEARCH_HASH,
};
