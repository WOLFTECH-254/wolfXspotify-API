let blockedUntil = 0;

function isBlocked() {
  return Date.now() < blockedUntil;
}

function getRemainingSeconds() {
  return Math.max(0, Math.ceil((blockedUntil - Date.now()) / 1000));
}

function setBlocked(retryAfterSeconds) {
  const until = Date.now() + retryAfterSeconds * 1000;
  if (until > blockedUntil) blockedUntil = until;
}

function clearBlock() {
  blockedUntil = 0;
}

module.exports = { isBlocked, getRemainingSeconds, setBlocked, clearBlock };
