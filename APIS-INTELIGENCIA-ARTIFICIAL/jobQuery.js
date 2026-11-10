const { companyById } = require("./data");
const {
  catalogos,
  parseId,
  takeQueryEnum,
  takeQueryText,
} = require("./http");

function queryJobs(source, query, { allowAnyEstado = false } = {}) {
  const detalles = [];
  let list = source.slice();

  const estado = takeQueryEnum(query.estado, catalogos.estadosTrabajo, "estado", detalles);
  const modalidad = takeQueryEnum(query.modalidad, catalogos.modalidades, "modalidad", detalles);
  const tipo = takeQueryEnum(query.tipo, catalogos.tipos, "tipo", detalles);
  const experiencia = takeQueryEnum(
    query.experiencia,
    catalogos.experiencias,
    "experiencia",
    detalles
  );
  const orden = takeQueryEnum(query.orden, catalogos.ordenes, "orden", detalles) || "recientes";
  const q = takeQueryText(query.q, "q", 100, detalles);
  const ubicacion = takeQueryText(query.ubicacion, "ubicacion", 80, detalles);
  const categoria = takeQueryText(query.categoria, "categoria", 40, detalles);

  let empresaId;
  if (query.empresaId != null && query.empresaId !== "") {
    empresaId = parseId(String(query.empresaId));
    if (!empresaId) detalles.push("empresaId debe ser un identificador válido");
  }

  let salarioMin;
  if (query.salarioMin != null && query.salarioMin !== "") {
    if (typeof query.salarioMin !== "string" || !/^\d+$/.test(query.salarioMin)) {
      detalles.push("salarioMin debe ser un entero mayor o igual que 0");
    } else {
      salarioMin = Number(query.salarioMin);
    }
  }

  if (estado && !allowAnyEstado && estado !== "publicado") {
    detalles.push("Solo puedes listar trabajos publicados");
  }

  if (detalles.length) return { detalles, list: [] };

  if (estado) list = list.filter((job) => job.estado === estado);
  else if (!allowAnyEstado) list = list.filter((job) => job.estado === "publicado");

  if (modalidad) list = list.filter((job) => job.modalidad === modalidad);
  if (tipo) list = list.filter((job) => job.tipo === tipo);
  if (experiencia) list = list.filter((job) => job.experiencia === experiencia);
  if (empresaId) list = list.filter((job) => job.empresaId === empresaId);
  if (ubicacion) {
    const needle = ubicacion.toLowerCase();
    list = list.filter((job) => job.ubicacion.toLowerCase().includes(needle));
  }
  if (categoria) {
    const needle = categoria.toLowerCase();
    list = list.filter((job) => job.categoria.toLowerCase() === needle);
  }
  if (salarioMin != null) {
    list = list.filter((job) => {
      const techo = job.salarioMax ?? job.salarioMin;
      return techo != null && techo >= salarioMin;
    });
  }
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((job) => {
      const company = companyById(job.empresaId);
      return [job.titulo, job.descripcion, job.categoria, job.ubicacion, company?.nombre]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }

  list.sort((left, right) => {
    if (orden === "salario") {
      const leftSalary = left.salarioMax ?? left.salarioMin ?? -1;
      const rightSalary = right.salarioMax ?? right.salarioMin ?? -1;
      if (rightSalary !== leftSalary) return rightSalary - leftSalary;
    }
    return (right.publicadoEn || right.creadoEn).localeCompare(left.publicadoEn || left.creadoEn);
  });

  return { detalles, list };
}

module.exports = { queryJobs };
