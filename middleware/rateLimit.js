const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;
const LIMIT_HEADER = String(MAX_REQUESTS);
const REMAINING_HEADERS = Array.from(
  { length: MAX_REQUESTS + 1 },
  (_, remaining) => String(remaining)
);

const hits = new Map();
const expiryKeys = [];
const expiryStarts = [];
let expiryHead = 0;

// La cola sigue el orden de inicio. Lo vencido es siempre un prefijo,
// y cada clave se elimina una sola vez: O(1) amortizado por petición.
function pruneExpired(deadline) {
  const keys = expiryKeys;
  const starts = expiryStarts;
  let head = expiryHead;
  const end = starts.length;

  while (head < end && starts[head] <= deadline) {
    const entry = hits.get(keys[head]);
    if (entry && entry.start === starts[head]) hits.delete(keys[head]);
    keys[head] = undefined;
    head += 1;
  }

  if (head > 1024 && head * 2 > end) {
    keys.splice(0, head);
    starts.splice(0, head);
    expiryHead = 0;
    return;
  }

  expiryHead = head;
}

function remainingFor(count) {
  return count > MAX_REQUESTS ? 0 : MAX_REQUESTS - count;
}

function setLimitHeaders(res, remaining) {
  res.setHeader("X-RateLimit-Limit", LIMIT_HEADER);
  res.setHeader("X-RateLimit-Remaining", REMAINING_HEADERS[remaining]);
}

function startWindow(key, entry, now) {
  if (entry === undefined) {
    hits.set(key, { start: now, count: 1 });
  } else {
    entry.start = now;
    entry.count = 1;
  }

  expiryKeys.push(key);
  expiryStarts.push(now);
}

function rejectLimited(res, entry, now) {
  const retryAfter = Math.ceil((entry.start + WINDOW_MS - now) / 1000);

  res.setHeader("Retry-After", String(retryAfter));
  return res.status(429).json({
    error: "Demasiadas peticiones a /",
    retryAfter,
  });
}

function countHit(entry, res, next, now) {
  const count = ++entry.count;

  setLimitHeaders(res, remainingFor(count));
  if (count <= MAX_REQUESTS) return next();
  return rejectLimited(res, entry, now);
}

function rateLimitRoot(req, res, next) {
  const now = Date.now();
  const deadline = now - WINDOW_MS;

  if (expiryStarts[expiryHead] <= deadline) pruneExpired(deadline);

  const key = req.ip;
  const entry = hits.get(key);

  if (entry !== undefined && entry.start > deadline) {
    return countHit(entry, res, next, now);
  }

  startWindow(key, entry, now);
  setLimitHeaders(res, remainingFor(1));
  return next();
}

module.exports = rateLimitRoot;
