const express = require('express');
const router = express.Router();
const { respond, respondError } = require('../response');
const { spotifyGraphQL, bestImage, idFromUri, mbLookupName, wdLookupName, searchAndMatchByUri, SEARCH_HASH } = require('../spotify-graphql');

const DISCOGRAPHY_HASH = 'a3bf3fd21bc50c6a6a6d5c271cef5afe3e5d94a87491e2e4f4e0e11b96c618de';

async function resolveArtistName(artistId) {
  const spotifyUri = `spotify:artist:${artistId}`;
  try {
    const mb = await mbLookupName('artist', artistId, 'artist');
    if (mb?.name) {
      const hit = await searchAndMatchByUri(mb.name, spotifyUri, 'artist');
      return { name: mb.name, data: hit?.data || null };
    }
  } catch {}
  try {
    const wdName = await wdLookupName('P1902', artistId);
    if (wdName) {
      const hit = await searchAndMatchByUri(wdName, spotifyUri, 'artist');
      return { name: wdName, data: hit?.data || null };
    }
  } catch {}
  return null;
}

function mapAlbum(item) {
  const d = item?.data || item;
  const id = idFromUri(d?.uri) || d?.id || '';
  const artists = (d?.artists?.items || []).map(a => ({
    id: idFromUri(a?.uri || ''),
    name: a?.profile?.name || a?.name || '',
    url: a?.uri ? `https://open.spotify.com/artist/${idFromUri(a.uri)}` : '',
  }));
  return {
    id,
    name: d?.name || '',
    type: (d?.type || 'album').toLowerCase(),
    release_date: d?.date?.isoString || (d?.date?.year ? String(d.date.year) : ''),
    total_tracks: d?.tracks?.totalCount || 0,
    thumbnail: bestImage(d?.coverArt?.sources),
    artist: artists.map(a => a.name).join(', '),
    artists,
    url: id ? `https://open.spotify.com/album/${id}` : '',
  };
}

router.get('/:id/albums', async (req, res) => {
  const artistId = req.params.id;
  if (!artistId || artistId.length < 10) return respondError(res, 400, 'Invalid artist ID');

  const type = (req.query.type || 'album').toLowerCase();
  const validTypes = ['album', 'single', 'compilation', 'all'];
  if (!validTypes.includes(type))
    return respondError(res, 400, `Invalid type. Valid values: ${validTypes.join(', ')}`);

  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);

  // Try Spotify GraphQL discography endpoint first
  try {
    const discographyType = type === 'all' ? ['album', 'single', 'compilation'] : [type.toUpperCase()];
    const data = await spotifyGraphQL('queryArtistDiscographyAll', DISCOGRAPHY_HASH, {
      uri: `spotify:artist:${artistId}`,
      offset,
      limit,
    });
    const items = data?.data?.artistUnion?.discography?.all?.items || [];
    if (items.length > 0) {
      const albums = items
        .flatMap(i => i?.releases?.items || [i])
        .map(mapAlbum)
        .filter(a => a.id && (type === 'all' || a.type === type));
      if (albums.length > 0) {
        return respond(res, 200, {
          artist_id: artistId,
          type,
          total: albums.length,
          offset,
          limit,
          albums,
        });
      }
    }
  } catch {}

  // Fallback: search-based approach
  const resolved = await resolveArtistName(artistId);
  if (!resolved?.name) return respondError(res, 503, 'Could not resolve artist name for this ID.');

  try {
    // Fetch a larger pool to account for filtering losses
    const fetchLimit = Math.min(limit + 20, 50);
    const data = await spotifyGraphQL('searchDesktop', SEARCH_HASH, {
      searchTerm: resolved.name,
      offset: 0,
      limit: fetchLimit,
      numberOfTopResults: 5,
      includeAudiobooks: false,
      includeArtistHasConcertsField: false,
      includePreReleases: true,
      includeLocalConcertsField: false,
    });

    const spotifyUri = `spotify:artist:${artistId}`;
    const artistNameLower = resolved.name.toLowerCase();

    const rawAlbums = (data?.data?.searchV2?.albumsV2?.items || [])
      .map(i => i?.data || i)
      .filter(a => {
        if (!a?.uri) return false;
        const albumArtists = a?.artists?.items || [];
        return albumArtists.some(x => {
          const n = (x?.profile?.name || x?.name || '').toLowerCase();
          const uri = x?.uri || '';
          return uri === spotifyUri || n === artistNameLower || n.includes(artistNameLower) || artistNameLower.includes(n);
        });
      })
      .slice(offset, offset + limit);

    const albums = rawAlbums.map(a => {
      const id = idFromUri(a.uri);
      const artists = (a?.artists?.items || []).map(x => ({
        id: idFromUri(x?.uri || ''),
        name: x?.profile?.name || x?.name || '',
        url: x?.uri ? `https://open.spotify.com/artist/${idFromUri(x.uri)}` : '',
      }));
      return {
        id,
        name: a.name || '',
        type: (a.type || 'album').toLowerCase(),
        release_date: a.date?.isoString || (a.date?.year ? String(a.date.year) : ''),
        total_tracks: a.tracks?.totalCount || 0,
        thumbnail: bestImage(a.coverArt?.sources),
        artist: artists.map(x => x.name).join(', '),
        artists,
        url: id ? `https://open.spotify.com/album/${id}` : '',
      };
    }).filter(a => type === 'all' || a.type === type);

    if (!albums.length)
      return respondError(res, 404, `No ${type === 'all' ? '' : type + ' '}albums found for this artist.`);

    respond(res, 200, {
      artist_id: artistId,
      artist_name: resolved.name,
      type,
      total: albums.length,
      offset,
      limit,
      albums,
    });

  } catch (err) {
    respondError(res, 500, err.message || 'Could not fetch artist albums');
  }
});

module.exports = router;
