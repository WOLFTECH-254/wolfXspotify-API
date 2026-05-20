const express = require('express');
const router = express.Router();
const { respond, respondError } = require('../response');
const {
  fetchEmbedEntity, mbLookupName, wdLookupName, searchAndMatchByUri,
  formatDuration, bestImage, idFromUri,
} = require('../spotify-graphql');

function mapAlbumFromEmbed(entity, albumId) {
  const imgArr = entity.visualIdentity?.image || [];
  const coverSources = entity.coverArt?.sources || [];
  const thumbnail = imgArr[0]?.url || bestImage(coverSources);

  // artists[] may be undefined in album embeds; derive from trackList subtitles
  let artists = (entity.artists || []).map(a => ({
    id: a.uri ? idFromUri(a.uri) : '',
    name: a.name || '',
    url: a.uri ? `https://open.spotify.com/artist/${idFromUri(a.uri)}` : '',
  }));
  if (!artists.length && entity.trackList?.length) {
    const subtitle = entity.trackList[0].subtitle || '';
    if (subtitle) artists = [{ id: '', name: subtitle, url: '' }];
  }
  const tracks = (entity.trackList || []).map((t, i) => {
    const trackId = idFromUri(t.uri || '') || t.uid || '';
    return {
      id: trackId,
      title: t.title || '',
      artist: t.subtitle || artists.map(a => a.name).join(', '),
      duration: formatDuration(t.duration || 0),
      duration_ms: t.duration || 0,
      track_number: i + 1,
      explicit: t.isExplicit || false,
      preview_url: t.audioPreview?.url || '',
      url: trackId ? `https://open.spotify.com/track/${trackId}` : '',
    };
  });
  const id = entity.id || idFromUri(entity.uri || '') || albumId;
  return {
    id,
    name: entity.name || entity.title || '',
    artist: artists.map(a => a.name).join(', '),
    artists,
    thumbnail,
    release_date: entity.releaseDate?.isoString || (entity.releaseDate?.year ? String(entity.releaseDate.year) : ''),
    total_tracks: entity.trackCount || tracks.length,
    type: (entity.type || 'album').toLowerCase(),
    url: `https://open.spotify.com/album/${id}`,
    tracks,
    source: 'embed',
  };
}

function mapAlbumFromSearch(data, albumId) {
  const coverSources = data?.coverArt?.sources || [];
  const thumbnail = bestImage(coverSources);
  const artists = (data?.artists?.items || []).map(a => ({
    id: a.uri ? idFromUri(a.uri) : '',
    name: a.profile?.name || '',
    url: a.uri ? `https://open.spotify.com/artist/${idFromUri(a.uri)}` : '',
  }));
  const id = idFromUri(data?.uri) || albumId;
  return {
    id,
    name: data?.name || '',
    artist: artists.map(a => a.name).join(', '),
    artists,
    thumbnail,
    release_date: data?.date?.isoString || (data?.date?.year ? String(data.date.year) : ''),
    total_tracks: data?.tracks?.totalCount || 0,
    type: (data?.type || 'album').toLowerCase(),
    url: `https://open.spotify.com/album/${id}`,
    tracks: [],
    source: 'search',
  };
}

router.get('/:id', async (req, res) => {
  const albumId = req.params.id;
  if (!albumId || albumId.length < 10) return respondError(res, 400, 'Invalid album ID');
  const spotifyUri = `spotify:album:${albumId}`;

  // Step 1: Try embed (works for some albums)
  try {
    const entity = await fetchEmbedEntity('album', albumId);
    if (entity && (entity.name || entity.title)) {
      return respond(res, 200, { album: mapAlbumFromEmbed(entity, albumId) });
    }
  } catch {}

  // Step 2: MusicBrainz URL lookup → name → Spotify search
  try {
    const mbEntity = await mbLookupName('album', albumId, 'release');
    if (mbEntity) {
      const name = mbEntity.title || '';
      const artistCredit = mbEntity['artist-credit']?.[0];
      const artistName = artistCredit?.artist?.name || artistCredit?.name || '';
      const searchTerm = artistName ? `${name} ${artistName}` : name;
      if (searchTerm) {
        const hit = await searchAndMatchByUri(searchTerm, spotifyUri, 'album');
        if (hit?.data) return respond(res, 200, { album: mapAlbumFromSearch(hit.data, albumId) });
      }
    }
  } catch {}

  // Step 3: Wikidata SPARQL (P1729 = Spotify album ID)
  try {
    const wdName = await wdLookupName('P1729', albumId);
    if (wdName) {
      const hit = await searchAndMatchByUri(wdName, spotifyUri, 'album');
      if (hit?.data) return respond(res, 200, { album: mapAlbumFromSearch(hit.data, albumId) });
      // Return minimal data if search didn't find exact match
      return respond(res, 200, {
        album: {
          id: albumId,
          name: wdName,
          url: `https://open.spotify.com/album/${albumId}`,
          tracks: [],
          source: 'db_lookup',
        },
      });
    }
  } catch {}

  respondError(res, 503, 'Album info could not be retrieved for this ID.');
});

module.exports = router;
