const express = require('express');
const router = express.Router();
const { respond, respondError } = require('../response');
const { fetchEmbedEntity, fetchOEmbed, formatDuration } = require('../spotify-graphql');

function mapTrackEmbed(entity, trackId) {
  // Thumbnail lives in visualIdentity.image[]
  const imgArr = entity.visualIdentity?.image || [];
  const thumbnail = imgArr[0]?.url || '';

  // Artists are plain objects: { name, uri }
  const artists = (entity.artists || []).map(a => ({
    id: a.uri ? a.uri.split(':').pop() : '',
    name: a.name || '',
    url: a.uri ? `https://open.spotify.com/artist/${a.uri.split(':').pop()}` : '',
  }));

  return {
    id: entity.id || trackId,
    title: entity.name || entity.title || '',
    artist: artists.map(a => a.name).join(', '),
    artists,
    thumbnail,
    duration: formatDuration(entity.duration || 0),
    duration_ms: entity.duration || 0,
    release_date: entity.releaseDate?.isoString || '',
    explicit: entity.isExplicit || false,
    preview_url: entity.audioPreview?.url || '',
    url: `https://open.spotify.com/track/${entity.id || trackId}`,
  };
}

function mapTrackOEmbed(oembed, trackId) {
  const parts = (oembed.title || '').split(' by ');
  return {
    id: trackId,
    title: parts[0]?.trim() || oembed.title || '',
    artist: parts[1]?.trim() || '',
    artists: parts[1] ? [{ name: parts[1].trim() }] : [],
    thumbnail: oembed.thumbnail_url || '',
    url: `https://open.spotify.com/track/${trackId}`,
  };
}

router.get('/:id', async (req, res) => {
  const trackId = req.params.id;
  if (!trackId || trackId.length < 10) return respondError(res, 400, 'Invalid track ID');

  try {
    const entity = await fetchEmbedEntity('track', trackId);
    if (entity && (entity.name || entity.id))
      return respond(res, 200, { source: 'embed', track: mapTrackEmbed(entity, trackId) });
  } catch {}

  try {
    const oembed = await fetchOEmbed('track', trackId);
    if (oembed && oembed.title)
      return respond(res, 200, { source: 'oembed', track: mapTrackOEmbed(oembed, trackId) });
  } catch {}

  respondError(res, 503, 'Could not fetch track info. Please try again.');
});

module.exports = router;
