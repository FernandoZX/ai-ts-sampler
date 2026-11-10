const express = require("express");
const { createUser, findUserByEmail, presentUser } = require("../data");
const {
  hashPassword,
  passwordMatches,
  loginRetryAfter,
  recordLoginFailure,
  clearLoginFailures,
  createSession,
  destroySession,
  requireAuth,
  authPayload,
} = require("../auth");
const {
  catalogos,
  fail,
  asBody,
  takeText,
  takePassword,
  normalizeEmail,
} = require("../http");

const router = express.Router();

router.post("/registro", (req, res) => {
  const body = asBody(req);
  if (!body) return fail(res, 400, "El cuerpo debe ser un objeto JSON");

  const detalles = [];
  const nombre = takeText(body, "nombre", detalles, { min: 2, max: 80, required: true });
  const email = hasEmail(body, detalles);
  const password = takePassword(body.password, detalles, "password");
  const rol = body.rol == null ? "candidato" : body.rol;

  if (body.rol != null && !catalogos.rolesRegistro.includes(body.rol)) {
    detalles.push(`rol debe ser uno de: ${catalogos.rolesRegistro.join(", ")}`);
  }
  if (detalles.length || !nombre || !email || !password) {
    return fail(res, 400, "Datos inválidos", detalles);
  }
  if (findUserByEmail(email)) {
    return fail(res, 409, "Ya existe una cuenta con ese correo");
  }

  const user = createUser({
    nombre,
    email,
    passwordHash: hashPassword(password),
    rol,
  });

  return res.status(201).json(authPayload(user, createSession(user.id), presentUser));
});

router.post("/login", (req, res) => {
  const body = asBody(req);
  if (!body) return fail(res, 400, "El cuerpo debe ser un objeto JSON");

  const detalles = [];
  const email = hasEmail(body, detalles);
  const password = takePassword(body.password, detalles, "password");
  if (detalles.length || !email || !password) {
    return fail(res, 400, "Datos inválidos", detalles);
  }

  const locked = loginRetryAfter(req, email);
  if (locked) {
    res.setHeader("Retry-After", String(locked));
    return res.status(429).json({
      error: "Demasiados intentos de inicio de sesión",
      retryAfter: locked,
    });
  }

  const user = findUserByEmail(email);
  if (!passwordMatches(password, user)) {
    const retryAfter = recordLoginFailure(req, email);
    if (retryAfter) {
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: "Demasiados intentos de inicio de sesión",
        retryAfter,
      });
    }
    return fail(res, 401, "Credenciales incorrectas");
  }

  clearLoginFailures(req, email);
  return res.json(authPayload(user, createSession(user.id), presentUser));
});

router.post("/logout", requireAuth, (req, res) => {
  destroySession(req.token);
  return res.json({ message: "Sesión cerrada" });
});

router.get("/me", requireAuth, (req, res) => {
  return res.json(presentUser(req.user, { contacto: true }));
});

function hasEmail(body, detalles) {
  if (typeof body.email !== "string") {
    detalles.push("email es obligatorio");
    return null;
  }
  const email = normalizeEmail(body.email);
  if (!email) {
    detalles.push("email no es válido");
    return null;
  }
  return email;
}

module.exports = router;
