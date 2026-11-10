const express = require("express");
const {
  users,
  userById,
  findUserByEmail,
  presentUser,
  touch,
} = require("../data");
const {
  hashPassword,
  passwordMatches,
  destroyOtherSessions,
  requireAuth,
} = require("../auth");
const {
  fail,
  asBody,
  hasOwn,
  parseId,
  takeText,
  takeOptionalText,
  takeStringList,
  takePassword,
  normalizeEmail,
} = require("../http");

const router = express.Router();

router.get("/me", requireAuth, (req, res) => {
  return res.json(presentUser(req.user, { contacto: true }));
});

router.put("/me", requireAuth, (req, res) => {
  const body = asBody(req);
  if (!body) return fail(res, 400, "El cuerpo debe ser un objeto JSON");

  const detalles = [];
  if (hasOwn(body, "rol") || hasOwn(body, "password") || hasOwn(body, "passwordHash")) {
    detalles.push("El rol y la contraseña no se modifican desde el perfil");
  }

  const nombre = takeText(body, "nombre", detalles, { min: 2, max: 80 });
  const titulo = takeOptionalText(body, "titulo", detalles, 80);
  const bio = takeOptionalText(body, "bio", detalles, 500);
  const telefono = takeOptionalText(body, "telefono", detalles, 20);
  const habilidades = takeStringList(body, "habilidades", detalles, { maxItems: 20, maxLen: 40 });

  let email;
  if (hasOwn(body, "email")) {
    email = normalizeEmail(body.email);
    if (!email) detalles.push("email no es válido");
    else if (users.some((user) => user.email === email && user.id !== req.user.id)) {
      return fail(res, 409, "Ya existe una cuenta con ese correo");
    }
  }

  if (telefono && !/^[0-9+\-()\s]{7,20}$/.test(telefono)) {
    detalles.push("telefono solo puede contener dígitos, espacios y + - ( )");
  }
  if (detalles.length) return fail(res, 400, "Datos inválidos", detalles);

  const changes = {};
  if (nombre !== undefined) changes.nombre = nombre;
  if (titulo !== undefined) changes.titulo = titulo;
  if (bio !== undefined) changes.bio = bio;
  if (telefono !== undefined) changes.telefono = telefono;
  if (habilidades !== undefined) changes.habilidades = habilidades;
  if (email !== undefined) changes.email = email;

  if (!Object.keys(changes).length) {
    return fail(res, 400, "No hay campos para actualizar");
  }

  Object.assign(req.user, changes);
  touch(req.user);
  return res.json(presentUser(req.user, { contacto: true }));
});

router.patch("/me/password", requireAuth, (req, res) => {
  const body = asBody(req);
  if (!body) return fail(res, 400, "El cuerpo debe ser un objeto JSON");

  const detalles = [];
  const actual = takePassword(body.passwordActual, detalles, "passwordActual");
  const nueva = takePassword(body.passwordNueva, detalles, "passwordNueva");
  if (detalles.length || !actual || !nueva) {
    return fail(res, 400, "Datos inválidos", detalles);
  }
  if (actual === nueva) {
    return fail(res, 400, "La nueva contraseña debe ser distinta");
  }
  if (!passwordMatches(actual, req.user)) {
    return fail(res, 401, "La contraseña actual no es correcta");
  }

  req.user.passwordHash = hashPassword(nueva);
  touch(req.user);
  destroyOtherSessions(req.user.id, req.token);
  return res.json({ message: "Contraseña actualizada" });
});

router.get("/:id", (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return fail(res, 400, "Identificador inválido");

  const user = userById(id);
  if (!user) return fail(res, 404, "Usuario no encontrado");
  return res.json(presentUser(user));
});

module.exports = router;
