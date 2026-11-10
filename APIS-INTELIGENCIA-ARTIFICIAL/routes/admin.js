const express = require("express");
const { users, companies, jobs, applications, userById, presentUser, touch } = require("../data");
const { requireAuth, requireRole } = require("../auth");
const {
  catalogos,
  fail,
  asBody,
  parseId,
  parsePagination,
  paginate,
  takeQueryEnum,
  takeQueryText,
} = require("../http");

const router = express.Router();

router.use(requireAuth, requireRole("admin"));

router.get("/resumen", (_req, res) => {
  return res.json({
    usuarios: {
      total: users.length,
      porRol: countBy(users, "rol"),
    },
    empresas: companies.length,
    trabajos: {
      total: jobs.length,
      porEstado: countBy(jobs, "estado"),
    },
    postulaciones: {
      total: applications.length,
      porEstado: countBy(applications, "estado"),
    },
  });
});

router.get("/usuarios", (req, res) => {
  const page = parsePagination(req.query);
  const filtros = [];
  const rol = takeQueryEnum(req.query.rol, catalogos.roles, "rol", filtros);
  const q = takeQueryText(req.query.q, "q", 100, filtros);
  const detalles = [...page.detalles, ...filtros];
  if (detalles.length) return fail(res, 400, "Parámetros inválidos", detalles);

  let list = users.slice();
  if (rol) list = list.filter((user) => user.rol === rol);
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((user) => `${user.nombre} ${user.email}`.toLowerCase().includes(needle));
  }
  list.sort((left, right) => right.creadoEn.localeCompare(left.creadoEn));

  return res.json(
    paginate(
      list.map((user) => presentUser(user, { contacto: true })),
      page.pagina,
      page.limite
    )
  );
});

router.patch("/usuarios/:id", (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return fail(res, 400, "Identificador inválido");

  const user = userById(id);
  if (!user) return fail(res, 404, "Usuario no encontrado");
  if (user.id === req.user.id) return fail(res, 400, "No puedes cambiar tu propio rol");

  const body = asBody(req);
  if (!body) return fail(res, 400, "El cuerpo debe ser un objeto JSON");
  if (!catalogos.roles.includes(body.rol)) {
    return fail(res, 400, `rol debe ser uno de: ${catalogos.roles.join(", ")}`);
  }

  if (user.rol === "admin" && body.rol !== "admin") {
    const admins = users.filter((item) => item.rol === "admin").length;
    if (admins <= 1) return fail(res, 409, "Debe quedar al menos un administrador");
  }

  user.rol = body.rol;
  touch(user);
  return res.json(presentUser(user, { contacto: true }));
});

function countBy(list, key) {
  const counts = {};
  for (const item of list) {
    counts[item[key]] = (counts[item[key]] || 0) + 1;
  }
  return counts;
}

module.exports = router;
