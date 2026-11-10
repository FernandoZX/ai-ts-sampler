const { randomBytes, scryptSync, timingSafeEqual } = require("crypto");
const { users } = require("./data");

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 8;
const sessions = new Map();
const failures = new Map();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const DUMMY_HASH = hashPassword("clave-de-relleno-para-tiempos");

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;

  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(actual, expected);
}

function passwordMatches(password, user) {
  const matches = verifyPassword(password, user?.passwordHash || DUMMY_HASH);
  return Boolean(user) && matches;
}

function failureKey(req, email) {
  return `${req.ip || "local"}:${email}`;
}

function loginRetryAfter(req, email) {
  const entry = failures.get(failureKey(req, email));
  if (!entry) return null;

  const elapsed = Date.now() - entry.start;
  if (elapsed > WINDOW_MS) {
    failures.delete(failureKey(req, email));
    return null;
  }

  if (entry.count < MAX_FAILS) return null;
  return Math.max(1, Math.ceil((WINDOW_MS - elapsed) / 1000));
}

function recordLoginFailure(req, email) {
  const key = failureKey(req, email);
  const now = Date.now();
  let entry = failures.get(key);

  if (!entry || now - entry.start > WINDOW_MS) {
    entry = { start: now, count: 0 };
    failures.set(key, entry);
  }

  entry.count += 1;
  if (entry.count < MAX_FAILS) return null;
  return Math.max(1, Math.ceil((entry.start + WINDOW_MS - now) / 1000));
}

function clearLoginFailures(req, email) {
  failures.delete(failureKey(req, email));
}

function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  sessions.set(token, { userId, creadoEn: new Date().toISOString() });
  return token;
}

function destroySession(token) {
  return sessions.delete(token);
}

function destroyOtherSessions(userId, currentToken) {
  for (const [token, session] of sessions) {
    if (session.userId === userId && token !== currentToken) {
      sessions.delete(token);
    }
  }
}

function readSession(req) {
  const header = req.headers.authorization;
  if (!header) return { status: "missing" };
  if (!header.startsWith("Bearer ")) return { status: "invalid" };

  const token = header.slice("Bearer ".length).trim();
  if (!token) return { status: "invalid" };

  const session = sessions.get(token);
  const user = session && users.find((item) => item.id === session.userId);
  if (!user) return { status: "invalid" };
  return { status: "ok", user, token };
}

function optionalAuth(req, _res, next) {
  const result = readSession(req);
  if (result.status === "ok") {
    req.user = result.user;
    req.token = result.token;
  }
  next();
}

function requireAuth(req, res, next) {
  const result = readSession(req);
  if (result.status === "missing") {
    return res.status(401).json({ error: "Debes iniciar sesión" });
  }
  if (result.status !== "ok") {
    return res.status(401).json({ error: "Sesión inválida o expirada" });
  }

  req.user = result.user;
  req.token = result.token;
  return next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ error: "No tienes permiso para esta acción" });
    }
    return next();
  };
}

function authPayload(user, token, presentUser) {
  return {
    token,
    tipo: "Bearer",
    usuario: presentUser(user, { contacto: true }),
  };
}

module.exports = {
  hashPassword,
  passwordMatches,
  loginRetryAfter,
  recordLoginFailure,
  clearLoginFailures,
  createSession,
  destroySession,
  destroyOtherSessions,
  optionalAuth,
  requireAuth,
  requireRole,
  authPayload,
};
