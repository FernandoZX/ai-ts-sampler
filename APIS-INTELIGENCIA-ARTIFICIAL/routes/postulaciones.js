const express = require("express");
const {
  applications,
  applicationById,
  jobById,
  canManageJob,
  presentApplication,
  touch,
} = require("../data");
const { requireAuth, requireRole } = require("../auth");
const {
  catalogos,
  fail,
  asBody,
  parseId,
  parsePagination,
  paginate,
  takeEnum,
  takeOptionalText,
} = require("../http");

const router = express.Router();
const OPEN_STATES = new Set(["recibida", "en_revision", "entrevista"]);

router.get("/mias", requireAuth, requireRole("candidato"), (req, res) => {
  const page = parsePagination(req.query);
  if (page.detalles.length) return fail(res, 400, "Parámetros inválidos", page.detalles);

  const list = applications
    .filter((item) => item.candidatoId === req.user.id)
    .sort((left, right) => right.creadoEn.localeCompare(left.creadoEn));

  return res.json(
    paginate(
      list.map((item) => presentApplication(item, req.user)),
      page.pagina,
      page.limite
    )
  );
});

router.get("/:id", requireAuth, (req, res) => {
  const application = findApplication(req, res);
  if (!application) return undefined;
  if (!canSee(req.user, application)) {
    return fail(res, 403, "No tienes permiso para ver esta postulación");
  }
  return res.json(presentApplication(application, req.user));
});

router.patch("/:id", requireAuth, (req, res) => {
  const application = findApplication(req, res);
  if (!application) return undefined;

  const job = jobById(application.trabajoId);
  const isCandidate = req.user.id === application.candidatoId;
  const manages = Boolean(job) && canManageJob(req.user, job);
  if (!isCandidate && !manages) {
    return fail(res, 403, "No tienes permiso para esta postulación");
  }

  const body = asBody(req);
  if (!body) return fail(res, 400, "El cuerpo debe ser un objeto JSON");

  const detalles = [];
  const estado = takeEnum(body, "estado", detalles, catalogos.estadosPostulacion, {
    required: true,
  });
  const nota = takeOptionalText(body, "nota", detalles, 500);
  if (detalles.length || !estado) return fail(res, 400, "Datos inválidos", detalles);
  if (application.estado === "retirada") {
    return fail(res, 409, "La postulación retirada no se puede modificar");
  }

  if (isCandidate && !manages) {
    if (estado !== "retirada") {
      return fail(res, 403, "Solo puedes retirar tu postulación");
    }
    if (!OPEN_STATES.has(application.estado)) {
      return fail(res, 409, "Esta postulación ya tiene una decisión y no se puede retirar");
    }
  }

  if (manages && !isCandidate && estado === "retirada") {
    return fail(res, 403, "Retirar la postulación le corresponde a quien se postuló");
  }

  application.estado = estado;
  if (nota !== undefined) application.nota = nota;
  touch(application);
  return res.json(presentApplication(application, req.user));
});

function findApplication(req, res) {
  const id = parseId(req.params.id);
  if (!id) {
    fail(res, 400, "Identificador inválido");
    return null;
  }

  const application = applicationById(id);
  if (!application) {
    fail(res, 404, "Postulación no encontrada");
    return null;
  }

  return application;
}

function canSee(user, application) {
  if (user.id === application.candidatoId || user.rol === "admin") return true;
  const job = jobById(application.trabajoId);
  return Boolean(job) && canManageJob(user, job);
}

module.exports = router;
