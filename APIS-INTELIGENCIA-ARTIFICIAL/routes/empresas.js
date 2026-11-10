const express = require("express");
const {
  companies,
  jobs,
  companyById,
  userById,
  canManageCompany,
  presentCompany,
  presentJob,
  createCompany,
  removeCompany,
  touch,
} = require("../data");
const { optionalAuth, requireAuth, requireRole } = require("../auth");
const { fail, asBody, parseId, parsePagination, paginate, takeText, takeOptionalText, takeUrl, takeId, takeQueryText } = require("../http");
const { queryJobs } = require("../jobQuery");

const router = express.Router();

router.get("/", optionalAuth, (req, res) => {
  const page = parsePagination(req.query);
  const filtros = [];
  const q = takeQueryText(req.query.q, "q", 100, filtros);
  const ubicacion = takeQueryText(req.query.ubicacion, "ubicacion", 80, filtros);
  const sector = takeQueryText(req.query.sector, "sector", 40, filtros);
  const detalles = [...page.detalles, ...filtros];
  if (detalles.length) return fail(res, 400, "Parámetros inválidos", detalles);

  let list = companies.slice();
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((company) =>
      `${company.nombre} ${company.descripcion}`.toLowerCase().includes(needle)
    );
  }
  if (ubicacion) {
    const needle = ubicacion.toLowerCase();
    list = list.filter((company) => company.ubicacion.toLowerCase().includes(needle));
  }
  if (sector) {
    const needle = sector.toLowerCase();
    list = list.filter((company) => company.sector.toLowerCase() === needle);
  }

  list.sort((left, right) => right.creadoEn.localeCompare(left.creadoEn));
  const payload = paginate(
    list.map((company) => presentCompany(company, req.user)),
    page.pagina,
    page.limite
  );
  return res.json(payload);
});

router.get("/mias", requireAuth, requireRole("empleador", "admin"), (req, res) => {
  const page = parsePagination(req.query);
  if (page.detalles.length) return fail(res, 400, "Parámetros inválidos", page.detalles);

  const source =
    req.user.rol === "admin"
      ? companies
      : companies.filter((company) => company.propietarioId === req.user.id);
  const list = source
    .slice()
    .sort((left, right) => right.creadoEn.localeCompare(left.creadoEn));

  return res.json(
    paginate(
      list.map((company) => presentCompany(company, req.user)),
      page.pagina,
      page.limite
    )
  );
});

router.get("/:id", optionalAuth, (req, res) => {
  const company = findCompany(req, res);
  if (!company) return undefined;
  return res.json(presentCompany(company, req.user));
});

router.get("/:id/trabajos", optionalAuth, (req, res) => {
  const company = findCompany(req, res);
  if (!company) return undefined;

  const page = parsePagination(req.query);
  const queried = queryJobs(
    jobs.filter((job) => job.empresaId === company.id),
    req.query,
    { allowAnyEstado: canManageCompany(req.user, company) }
  );
  const detalles = [...page.detalles, ...queried.detalles];
  if (detalles.length) return fail(res, 400, "Parámetros inválidos", detalles);

  return res.json(
    paginate(
      queried.list.map((job) => presentJob(job, req.user)),
      page.pagina,
      page.limite
    )
  );
});

router.post("/", requireAuth, requireRole("empleador", "admin"), (req, res) => {
  const body = asBody(req);
  if (!body) return fail(res, 400, "El cuerpo debe ser un objeto JSON");
  const parsed = parseCompany(body);
  if (parsed.detalles.length) return fail(res, 400, "Datos inválidos", parsed.detalles);

  let propietarioId = req.user.id;
  if (req.user.rol === "admin" && parsed.data.propietarioId != null) {
    const owner = userById(parsed.data.propietarioId);
    if (!owner || owner.rol !== "empleador") {
      return fail(res, 400, "propietarioId debe ser un empleador existente");
    }
    propietarioId = owner.id;
  }

  const company = createCompany({
    nombre: parsed.data.nombre,
    descripcion: parsed.data.descripcion,
    ubicacion: parsed.data.ubicacion,
    sector: parsed.data.sector || "",
    sitioWeb: parsed.data.sitioWeb || "",
    logoUrl: parsed.data.logoUrl || "",
    propietarioId,
  });

  return res.status(201).json(presentCompany(company, req.user));
});

router.put("/:id", requireAuth, (req, res) => {
  const company = findCompany(req, res);
  if (!company) return undefined;
  if (!canManageCompany(req.user, company)) {
    return fail(res, 403, "No tienes permiso para editar esta empresa");
  }

  const body = asBody(req);
  if (!body) return fail(res, 400, "El cuerpo debe ser un objeto JSON");
  const parsed = parseCompany(body, { partial: true });
  if (parsed.detalles.length) return fail(res, 400, "Datos inválidos", parsed.detalles);
  if (!Object.keys(parsed.data).length) {
    return fail(res, 400, "No hay campos para actualizar");
  }

  if (parsed.data.propietarioId != null) {
    if (req.user.rol !== "admin") {
      return fail(res, 403, "Solo un administrador puede cambiar el propietario");
    }
    const owner = userById(parsed.data.propietarioId);
    if (!owner || (owner.rol !== "empleador" && owner.rol !== "admin")) {
      return fail(res, 400, "propietarioId debe ser un empleador o administrador");
    }
  }

  Object.assign(company, parsed.data);
  touch(company);
  return res.json(presentCompany(company, req.user));
});

router.delete("/:id", requireAuth, (req, res) => {
  const company = findCompany(req, res);
  if (!company) return undefined;
  if (!canManageCompany(req.user, company)) {
    return fail(res, 403, "No tienes permiso para eliminar esta empresa");
  }

  const removed = removeCompany(company.id);
  if (removed.conflict) {
    return fail(
      res,
      409,
      "La empresa tiene trabajos asociados. Elimínalos antes de borrar la empresa"
    );
  }

  return res.json(presentCompany(removed.company, req.user));
});

function findCompany(req, res) {
  const id = parseId(req.params.id);
  if (!id) {
    fail(res, 400, "Identificador inválido");
    return null;
  }

  const company = companyById(id);
  if (!company) {
    fail(res, 404, "Empresa no encontrada");
    return null;
  }

  return company;
}

function parseCompany(body, { partial = false } = {}) {
  const detalles = [];
  const data = {};
  const nombre = takeText(body, "nombre", detalles, { min: 2, max: 80, required: !partial });
  const descripcion = takeText(body, "descripcion", detalles, {
    min: 10,
    max: 2000,
    required: !partial,
  });
  const ubicacion = takeText(body, "ubicacion", detalles, { min: 2, max: 80, required: !partial });
  const sector = takeOptionalText(body, "sector", detalles, 40);
  const sitioWeb = takeUrl(body, "sitioWeb", detalles);
  const logoUrl = takeUrl(body, "logoUrl", detalles);
  const propietarioId = takeId(body, "propietarioId", detalles);

  if (nombre !== undefined) data.nombre = nombre;
  if (descripcion !== undefined) data.descripcion = descripcion;
  if (ubicacion !== undefined) data.ubicacion = ubicacion;
  if (sector !== undefined) data.sector = sector;
  if (sitioWeb !== undefined) data.sitioWeb = sitioWeb;
  if (logoUrl !== undefined) data.logoUrl = logoUrl;
  if (propietarioId !== undefined) data.propietarioId = propietarioId;
  return { detalles, data };
}

module.exports = router;
