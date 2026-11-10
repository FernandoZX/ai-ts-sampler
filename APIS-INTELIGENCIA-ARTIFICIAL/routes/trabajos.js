const express = require("express");
const {
  jobs,
  applications,
  jobById,
  companyById,
  canManageJob,
  canManageCompany,
  activeApplication,
  presentJob,
  presentApplication,
  createJob,
  updateJob,
  removeJob,
  createApplication,
  addSaved,
  removeSaved,
} = require("../data");
const { optionalAuth, requireAuth, requireRole } = require("../auth");
const {
  catalogos,
  fail,
  asBody,
  parseId,
  parsePagination,
  paginate,
  takeText,
  takeEnum,
  takeStringList,
  takeNumber,
  takeId,
  takeCurrency,
  takeUrl,
} = require("../http");
const { queryJobs } = require("../jobQuery");

const router = express.Router();

router.get("/", optionalAuth, (req, res) => {
  return respondList(req, res, jobs, { allowAnyEstado: req.user?.rol === "admin" });
});

router.get("/mios", requireAuth, requireRole("empleador", "admin"), (req, res) => {
  const source =
    req.user.rol === "admin" ? jobs : jobs.filter((job) => canManageJob(req.user, job));
  return respondList(req, res, source, { allowAnyEstado: true });
});

router.get("/:id", optionalAuth, (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return fail(res, 400, "Identificador inválido");

  const job = jobById(id);
  if (!job || (job.estado !== "publicado" && !canManageJob(req.user, job))) {
    return fail(res, 404, "Trabajo no encontrado");
  }

  return res.json(presentJob(job, req.user));
});

router.post("/", requireAuth, requireRole("empleador", "admin"), (req, res) => {
  const body = asBody(req);
  if (!body) return fail(res, 400, "El cuerpo debe ser un objeto JSON");
  const parsed = parseJob(body);
  if (parsed.detalles.length) return fail(res, 400, "Datos inválidos", parsed.detalles);

  const company = companyById(parsed.data.empresaId);
  if (!company) return fail(res, 404, "Empresa no encontrada");
  if (!canManageCompany(req.user, company)) {
    return fail(res, 403, "No puedes publicar en esa empresa");
  }

  const job = createJob({
    ...parsed.data,
    autorId: req.user.id,
    experiencia: parsed.data.experiencia || "indistinto",
    moneda: parsed.data.moneda || "COP",
    vacantes: parsed.data.vacantes || 1,
    requisitos: parsed.data.requisitos || [],
    beneficios: parsed.data.beneficios || [],
    estado: parsed.data.estado || "borrador",
  });

  return res.status(201).json(presentJob(job, req.user));
});

router.put("/:id", requireAuth, (req, res) => {
  const job = manageableJob(req, res);
  if (!job) return undefined;

  const body = asBody(req);
  if (!body) return fail(res, 400, "El cuerpo debe ser un objeto JSON");
  const parsed = parseJob(body, { partial: true, current: job });
  if (parsed.detalles.length) return fail(res, 400, "Datos inválidos", parsed.detalles);
  if (!Object.keys(parsed.data).length) {
    return fail(res, 400, "No hay campos para actualizar");
  }

  if (parsed.data.empresaId != null && parsed.data.empresaId !== job.empresaId) {
    const company = companyById(parsed.data.empresaId);
    if (!company) return fail(res, 404, "Empresa no encontrada");
    if (!canManageCompany(req.user, company)) {
      return fail(res, 403, "No puedes mover el trabajo a esa empresa");
    }
  }

  updateJob(job, parsed.data);
  return res.json(presentJob(job, req.user));
});

router.patch("/:id/estado", requireAuth, (req, res) => {
  const job = manageableJob(req, res);
  if (!job) return undefined;

  const body = asBody(req);
  if (!body) return fail(res, 400, "El cuerpo debe ser un objeto JSON");

  const detalles = [];
  const estado = takeEnum(body, "estado", detalles, catalogos.estadosTrabajo, { required: true });
  if (detalles.length || !estado) return fail(res, 400, "Datos inválidos", detalles);
  if (job.estado === estado) return res.json(presentJob(job, req.user));

  updateJob(job, { estado });
  return res.json(presentJob(job, req.user));
});

router.delete("/:id", requireAuth, (req, res) => {
  const job = manageableJob(req, res);
  if (!job) return undefined;

  const view = presentJob(job, req.user);
  removeJob(job.id);
  return res.json(view);
});

router.post("/:id/guardar", requireAuth, requireRole("candidato"), (req, res) => {
  const job = publishedJob(req, res);
  if (!job) return undefined;

  const { created } = addSaved(req.user.id, job.id);
  return res.status(created ? 201 : 200).json(presentJob(job, req.user));
});

router.delete("/:id/guardar", requireAuth, requireRole("candidato"), (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return fail(res, 400, "Identificador inválido");
  if (!jobById(id)) return fail(res, 404, "Trabajo no encontrado");
  if (!removeSaved(req.user.id, id)) {
    return fail(res, 404, "No tenías guardado este trabajo");
  }
  return res.json({ message: "Trabajo quitado de guardados" });
});

router.get("/:id/postulaciones", requireAuth, (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return fail(res, 400, "Identificador inválido");

  const job = jobById(id);
  if (!job) return fail(res, 404, "Trabajo no encontrado");
  if (!canManageJob(req.user, job)) {
    if (job.estado !== "publicado") return fail(res, 404, "Trabajo no encontrado");
    return fail(res, 403, "No tienes permiso para ver estas postulaciones");
  }

  const page = parsePagination(req.query);
  if (page.detalles.length) return fail(res, 400, "Parámetros inválidos", page.detalles);

  const list = applications
    .filter((item) => item.trabajoId === job.id)
    .sort((left, right) => right.creadoEn.localeCompare(left.creadoEn));

  return res.json(
    paginate(
      list.map((item) => presentApplication(item, req.user)),
      page.pagina,
      page.limite
    )
  );
});

router.post("/:id/postulaciones", requireAuth, requireRole("candidato"), (req, res) => {
  const job = publishedJob(req, res);
  if (!job) return undefined;
  if (canManageJob(req.user, job)) {
    return fail(res, 403, "No puedes postularte a un trabajo que administras");
  }
  if (activeApplication(job.id, req.user.id)) {
    return fail(res, 409, "Ya tienes una postulación activa en este trabajo");
  }

  const body = asBody(req);
  if (!body) return fail(res, 400, "El cuerpo debe ser un objeto JSON");

  const detalles = [];
  const carta = takeText(body, "carta", detalles, { min: 10, max: 2000, required: true });
  const portafolioUrl = takeUrl(body, "portafolioUrl", detalles);
  if (detalles.length || !carta) return fail(res, 400, "Datos inválidos", detalles);

  const application = createApplication({
    trabajoId: job.id,
    candidatoId: req.user.id,
    carta,
    portafolioUrl: portafolioUrl || "",
    estado: "recibida",
  });

  return res.status(201).json(presentApplication(application, req.user));
});

function respondList(req, res, source, options) {
  const page = parsePagination(req.query);
  const queried = queryJobs(source, req.query, options);
  const detalles = [...page.detalles, ...queried.detalles];
  if (detalles.length) return fail(res, 400, "Parámetros inválidos", detalles);

  return res.json(
    paginate(
      queried.list.map((job) => presentJob(job, req.user)),
      page.pagina,
      page.limite
    )
  );
}

function manageableJob(req, res) {
  const id = parseId(req.params.id);
  if (!id) {
    fail(res, 400, "Identificador inválido");
    return null;
  }

  const job = jobById(id);
  if (!job || !canManageJob(req.user, job)) {
    fail(res, 404, "Trabajo no encontrado");
    return null;
  }

  return job;
}

function publishedJob(req, res) {
  const id = parseId(req.params.id);
  if (!id) {
    fail(res, 400, "Identificador inválido");
    return null;
  }

  const job = jobById(id);
  if (!job || job.estado !== "publicado") {
    fail(res, 404, "Trabajo no encontrado");
    return null;
  }

  return job;
}

function parseJob(body, { partial = false, current = null } = {}) {
  const detalles = [];
  const data = {};
  const titulo = takeText(body, "titulo", detalles, { min: 4, max: 120, required: !partial });
  const descripcion = takeText(body, "descripcion", detalles, {
    min: 20,
    max: 5000,
    required: !partial,
  });
  const ubicacion = takeText(body, "ubicacion", detalles, { min: 2, max: 80, required: !partial });
  const modalidad = takeEnum(body, "modalidad", detalles, catalogos.modalidades, {
    required: !partial,
  });
  const tipo = takeEnum(body, "tipo", detalles, catalogos.tipos, { required: !partial });
  const experiencia = takeEnum(body, "experiencia", detalles, catalogos.experiencias);
  const categoria = takeText(body, "categoria", detalles, { min: 2, max: 40, required: !partial });
  const empresaId = takeId(body, "empresaId", detalles, { required: !partial });
  const salarioMin = takeNumber(body, "salarioMin", detalles, {
    min: 0,
    max: 1000000000,
    integer: true,
    nullable: true,
  });
  const salarioMax = takeNumber(body, "salarioMax", detalles, {
    min: 0,
    max: 1000000000,
    integer: true,
    nullable: true,
  });
  const vacantes = takeNumber(body, "vacantes", detalles, { min: 1, max: 999, integer: true });
  const moneda = takeCurrency(body, detalles);
  const requisitos = takeStringList(body, "requisitos", detalles);
  const beneficios = takeStringList(body, "beneficios", detalles);
  const estado = takeEnum(body, "estado", detalles, catalogos.estadosTrabajo);

  assign(data, {
    titulo,
    descripcion,
    ubicacion,
    modalidad,
    tipo,
    experiencia,
    categoria,
    empresaId,
    salarioMin,
    salarioMax,
    vacantes,
    moneda,
    requisitos,
    beneficios,
    estado,
  });

  const minimo = Object.prototype.hasOwnProperty.call(data, "salarioMin")
    ? data.salarioMin
    : current?.salarioMin ?? null;
  const maximo = Object.prototype.hasOwnProperty.call(data, "salarioMax")
    ? data.salarioMax
    : current?.salarioMax ?? null;
  if (minimo != null && maximo != null && maximo < minimo) {
    detalles.push("salarioMax no puede ser menor que salarioMin");
  }

  return { detalles, data };
}

function assign(target, fields) {
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) target[key] = value;
  }
}

module.exports = router;
