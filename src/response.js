const PROVIDER = 'WOLF TECH';
const CREATOR = 'Silent Wolf';

function respond(res, status, data) {
  return res.status(status).json({
    provider: PROVIDER,
    creator: CREATOR,
    success: true,
    ...data,
  });
}

function respondError(res, status, error) {
  return res.status(status).json({
    provider: PROVIDER,
    creator: CREATOR,
    success: false,
    error,
  });
}

module.exports = { respond, respondError, PROVIDER, CREATOR };
