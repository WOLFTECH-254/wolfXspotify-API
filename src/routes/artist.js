const express = require('express');
const router = express.Router();
const { respond, respondError } = require('../response');
const {
  spotifyGraphQL, fetchEmbedEntity,
  mbLookupName, wdLookupName, searchAndMatchByUri,
  formatDuration, bestImage, idFromUri, SEARCH_HASH,
} = require('../spotify-graphql');

function mapArtistFromSearch(data, artistId) {
  const visuals = data?.visuals?.avatarImage?.sources || data?.visuals?.headerImage?.sources || [];
  return {
    id: idFromUri(data?.uri) || artistId,
    name: data?.profile?.name || '',
    thumbnail: bestImage(visuals),
    followers: data?.stats?.followers || 0,
    genres: data?.profile?.genres?.items?.map(g => g.genre) || [],
    verified: data?.profile?.verified || false,
    url: `https://open.spotify.com/artist/${idFromUri(data?.uri) || artistId}`,
    source: 'search',
  };
}

// Resolve artist name from MusicBrainz then Wikidata
async function resolveArtistName(artistId, spotifyUri) {
  // Try MusicBrainz first (1 req, returns entity with name)
  try {
    const mbEntity = await mbLookupName('artist', artistId, 'artist');
    if (mbEntity?.name) {
      const hit = await searchAndMatchByUri(mbEntity.name, spotifyUri, 'artist');
      if (hit?.data) return { name: mbEntity.name, searchData: hit.data };
      return { name: mbEntity.name, searchData: null };
    }
  } catch {}

  // Fallback: Wikidata SPARQL (P1902 = Spotify artist ID)
  try {
    const wdName = await wdLookupName('P1902', artistId);
    if (wdName) {
      const hit = await searchAndMatchByUri(wdName, spotifyUri, 'artist');
      if (hit?.data) return { name: wdName, searchData: hit.data };
      return { name: wdName, searchData: null };
    }
  } catch {}

  return null;
}

router.get('/:id', async (req, res) => {
  const artistId = req.params.id;
  if (!artistId || artistId.length < 10) return respondError(res, 400, 'Invalid artist ID');
  const spotifyUri = `spotify:artist:${artistId}`;

  const resolved = await resolveArtistName(artistId, spotifyUri);
  if (resolved?.searchData) {
    return respond(res, 200, { artist: mapArtistFromSearch(resolved.searchData, artistId) });
  }

  // If we have a name but no search data, return minimal info
  if (resolved?.name) {
    return respond(res, 200, {
      artist: {
        id: artistId,
        name: resolved.name,
        thumbnail: '',
        url: `https://open.spotify.com/artist/${artistId}`,
        source: 'db_lookup',
      },
    });
  }

  // Last resort: try embed
  try {
    const entity = await fetchEmbedEntity('artist', artistId);
    if (entity?.name || entity?.profile?.name) {
      const imgArr = entity.visualIdentity?.image || [];
      return respond(res, 200, {
        artist: {
          id: entity.id || artistId,
          name: entity.name || entity.profile?.name || '',
          thumbnail: imgArr[0]?.url || bestImage(entity.visuals?.avatarImage?.sources),
          followers: entity.stats?.followers || 0,
          url: `https://open.spotify.com/artist/${artistId}`,
          source: 'embed',
        },
      });
    }
  } catch {}

  respondError(res, 503, 'Artist info could not be retrieved for this ID.');
});

router.get('/:id/top-tracks', async (req, res) => {
  const artistId = req.params.id;
  if (!artistId || artistId.length < 10) return respondError(res, 400, 'Invalid artist ID');
  const spotifyUri = `spotify:artist:${artistId}`;

  const resolved = await resolveArtistName(artistId, spotifyUri);
  let artistName = resolved?.name || '';
  let artistInfo = resolved?.searchData || null;

  if (!artistName) {
    try {
      const entity = await fetchEmbedEntity('artist', artistId);
      artistName = entity?.name || entity?.profile?.name || '';
    } catch {}
  }

  if (!artistName) return respondError(res, 503, 'Could not resolve artist name for this ID.');

  try {
    const data = await spotifyGraphQL('searchDesktop', SEARCH_HASH, {
      searchTerm: `artist:${artistName}`,
      offset: 0,
      limit: 10,
      numberOfTopResults: 5,
      includeAudiobooks: false,
      includeArtistHasConcertsField: false,
      includePreReleases: true,
      includeLocalConcertsField: false,
    });

    const items = data?.data?.searchV2?.tracksV2?.items || [];
    const tracks = items
      .map(i => i?.item?.data || i)
      .filter(t => t?.uri || t?.id)
      .map(t => {
        const ms = t.duration?.totalMilliseconds || 0;
        const id = t.id || idFromUri(t.uri);
        return {
          id,
          title: t.name || '',
          artist: (t.artists?.items || []).map(a => a?.profile?.name || '').join(', '),
          album: t.albumOfTrack?.name || '',
          thumbnail: bestImage(t.albumOfTrack?.coverArt?.sources),
          duration: formatDuration(ms),
          duration_ms: ms,
          explicit: t.contentRating?.label === 'EXPLICIT',
          url: id ? `https://open.spotify.com/track/${id}` : '',
        };
      });

    if (!tracks.length) return respondError(res, 404, `No tracks found for artist: ${artistName}`);

    respond(res, 200, {
      artist: artistName,
      artist_id: artistId,
      artist_thumbnail: artistInfo ? bestImage(artistInfo.visuals?.avatarImage?.sources) : '',
      total: tracks.length,
      tracks,
    });
  } catch (err) {
    respondError(res, 500, err.message || 'Could not fetch top tracks');
  }
});

module.exports = router;
