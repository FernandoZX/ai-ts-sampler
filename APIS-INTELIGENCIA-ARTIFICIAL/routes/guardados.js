const express = require("express");
const { savedJobs, jobById, presentJob } = require("../data");
const { requireAuth, requireRole } = require("../auth");
const { fail, parsePagination, paginate } = require("../http");

const router = express.Router();

router.get("/", requireAuth, requireRole("candidato"), (req, res) => {
  const page = parsePagination(req.query);
  if (page.detalles.length) return fail(res, 400, "Parámetros inválidos", page.detalles);

  const list = savedJobs
    .filter((item) => item.userId === req.user.id)
    .sort((left, right) => right.creadoEn.localeCompare(left.creadoEn))
    .map((item) => jobById(item.trabajoId))
    .filter(Boolean);

  return res.json(
    paginate(
      list.map((job) => presentJob(job, req.user)),
      page.pagina,
      page.limite
    )
  );
});

module.exports = router;
