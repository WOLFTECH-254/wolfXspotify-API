const express = require('express');
const router = express.Router();
const { respond, respondError } = require('../response');
const { spotifyGraphQL, fetchEmbedEntity, formatDuration, bestImage, idFromUri } = require('../spotify-graphql');

const PLAYLIST_HASH = '7982b11e21535cd2594badc40030b745671b61a1fa66766e569d45e6364f3422';

function mapPlaylistEmbed(entity, playlistId) {
  const coverSources = entity.coverArt?.sources || [];
  const thumbnail = bestImage(coverSources);

  const tracks = (entity.trackList || []).map(t => {
    const trackId = idFromUri(t.uri || '') || t.uid || '';
    return {
      id: trackId,
      title: t.title || '',
      artist: t.subtitle || '',
      duration: formatDuration(t.duration || 0),
      duration_ms: t.duration || 0,
      explicit: t.isExplicit || false,
      preview_url: t.audioPreview?.url || '',
      url: trackId ? `https://open.spotify.com/track/${trackId}` : '',
    };
  });

  return {
    id: entity.id || idFromUri(entity.uri || '') || playlistId,
    name: entity.name || entity.title || '',
    description: entity.subtitle || entity.description || '',
    owner: (entity.authors || [])[0]?.name || '',
    total_tracks: tracks.length,
    thumbnail,
    images: coverSources.map(s => ({ url: s.url, width: s.width, height: s.height })),
    url: `https://open.spotify.com/playlist/${playlistId}`,
    tracks,
  };
}

async function enrichWithGraphQL(playlistId, embedPlaylist) {
  try {
    const data = await spotifyGraphQL('fetchPlaylistMetadata', PLAYLIST_HASH, {
      uri: `spotify:playlist:${playlistId}`,
      offset: 0,
      limit: 1,
      enableWatchFeedEntrypoint: false,
    });
    const pl = data?.data?.playlistV2;
    if (pl) {
      embedPlaylist.owner = pl.ownerV2?.data?.name || pl.ownerV2?.data?.username || embedPlaylist.owner;
      embedPlaylist.followers = pl.followers || 0;
      embedPlaylist.total_tracks = pl.content?.totalCount || embedPlaylist.total_tracks;
      if (pl.name) embedPlaylist.name = pl.name;
      if (pl.description) embedPlaylist.description = pl.description;
    }
  } catch {}
  return embedPlaylist;
}

router.get('/:id', async (req, res) => {
  const playlistId = req.params.id;
  if (!playlistId || playlistId.length < 10) return respondError(res, 400, 'Invalid playlist ID');

  // Primary: embed (gives full trackList with title, artist, duration)
  try {
    const entity = await fetchEmbedEntity('playlist', playlistId);
    if (entity && (entity.name || entity.title)) {
      const playlist = await enrichWithGraphQL(playlistId, mapPlaylistEmbed(entity, playlistId));
      return respond(res, 200, { source: 'embed', playlist });
    }
  } catch {}

  respondError(res, 503, 'Could not fetch playlist info. Please try again.');
});

module.exports = router;
