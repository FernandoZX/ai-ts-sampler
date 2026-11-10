const users = [];
const companies = [];
const jobs = [];
const applications = [];
const savedJobs = [];

const seq = {
  user: 1,
  company: 1,
  job: 1,
  application: 1,
};

const demoAccounts = [
  {
    rol: "admin",
    nombre: "Ana Ruiz",
    email: "admin@demo.local",
    password: "Admin1234",
    titulo: "Administración de la plataforma",
    bio: "Supervisa cuentas, empresas y vacantes.",
    habilidades: [],
  },
  {
    rol: "empleador",
    nombre: "Luis Gómez",
    email: "empleador@demo.local",
    password: "Empleador123",
    titulo: "Responsable de selección",
    bio: "Publica las vacantes del equipo de producto de Nexo Labs.",
    habilidades: [],
  },
  {
    rol: "candidato",
    nombre: "María Pérez",
    email: "candidato@demo.local",
    password: "Candidato123",
    titulo: "Desarrolladora full stack",
    bio: "Construye servicios web y quiere aplicarlos a productos de inteligencia artificial.",
    habilidades: ["JavaScript", "Node.js", "SQL"],
  },
];

function now() {
  return new Date().toISOString();
}

function nextId(key) {
  const id = seq[key];
  seq[key] += 1;
  return id;
}

function byId(list, id) {
  return list.find((item) => item.id === id) || null;
}

function userById(id) {
  return byId(users, id);
}

function companyById(id) {
  return byId(companies, id);
}

function jobById(id) {
  return byId(jobs, id);
}

function applicationById(id) {
  return byId(applications, id);
}

function findUserByEmail(email) {
  return users.find((user) => user.email === email) || null;
}

function canManageCompany(user, company) {
  if (!user || !company) return false;
  return user.rol === "admin" || company.propietarioId === user.id;
}

function canManageJob(user, job) {
  if (!user || !job) return false;
  if (user.rol === "admin" || job.autorId === user.id) return true;
  return canManageCompany(user, companyById(job.empresaId));
}

function activeApplication(trabajoId, candidatoId) {
  return (
    applications.find(
      (item) =>
        item.trabajoId === trabajoId &&
        item.candidatoId === candidatoId &&
        item.estado !== "retirada"
    ) || null
  );
}

function presentUser(user, { contacto = false } = {}) {
  if (!user) return null;

  const profile = {
    id: user.id,
    nombre: user.nombre,
    rol: user.rol,
    titulo: user.titulo,
    bio: user.bio,
    habilidades: user.habilidades.slice(),
    creadoEn: user.creadoEn,
  };

  if (contacto) {
    profile.email = user.email;
    profile.telefono = user.telefono;
    profile.actualizadoEn = user.actualizadoEn;
  }

  return profile;
}

function presentCompany(company, viewer) {
  const propietario = userById(company.propietarioId);
  const view = {
    id: company.id,
    nombre: company.nombre,
    descripcion: company.descripcion,
    sitioWeb: company.sitioWeb,
    logoUrl: company.logoUrl,
    ubicacion: company.ubicacion,
    sector: company.sector,
    propietario: propietario ? { id: propietario.id, nombre: propietario.nombre } : null,
    trabajosPublicados: jobs.filter(
      (job) => job.empresaId === company.id && job.estado === "publicado"
    ).length,
    creadoEn: company.creadoEn,
    actualizadoEn: company.actualizadoEn,
  };

  if (canManageCompany(viewer, company)) {
    view.totalTrabajos = jobs.filter((job) => job.empresaId === company.id).length;
  }

  return view;
}

function presentJob(job, viewer) {
  const company = companyById(job.empresaId);
  const manages = canManageJob(viewer, job);
  const view = {
    id: job.id,
    titulo: job.titulo,
    descripcion: job.descripcion,
    ubicacion: job.ubicacion,
    modalidad: job.modalidad,
    tipo: job.tipo,
    experiencia: job.experiencia,
    categoria: job.categoria,
    salarioMin: job.salarioMin,
    salarioMax: job.salarioMax,
    moneda: job.moneda,
    vacantes: job.vacantes,
    requisitos: job.requisitos.slice(),
    beneficios: job.beneficios.slice(),
    estado: job.estado,
    publicadoEn: job.publicadoEn,
    creadoEn: job.creadoEn,
    actualizadoEn: job.actualizadoEn,
    empresa: company
      ? {
          id: company.id,
          nombre: company.nombre,
          logoUrl: company.logoUrl,
          ubicacion: company.ubicacion,
        }
      : null,
  };

  if (manages) {
    view.autorId = job.autorId;
    view.totalPostulaciones = applications.filter((item) => item.trabajoId === job.id).length;
  }

  if (viewer?.rol === "candidato") {
    view.guardado = savedJobs.some(
      (item) => item.userId === viewer.id && item.trabajoId === job.id
    );
    view.postulado = Boolean(activeApplication(job.id, viewer.id));
  }

  return view;
}

function presentApplication(application, viewer) {
  const job = jobById(application.trabajoId);
  const company = job ? companyById(job.empresaId) : null;
  const candidate = userById(application.candidatoId);
  const canSeeContact = Boolean(
    viewer &&
      (viewer.id === application.candidatoId ||
        viewer.rol === "admin" ||
        (job && canManageJob(viewer, job)))
  );

  return {
    id: application.id,
    estado: application.estado,
    carta: application.carta,
    portafolioUrl: application.portafolioUrl,
    nota: application.nota,
    creadoEn: application.creadoEn,
    actualizadoEn: application.actualizadoEn,
    trabajo: job
      ? {
          id: job.id,
          titulo: job.titulo,
          estado: job.estado,
          empresa: company ? { id: company.id, nombre: company.nombre } : null,
        }
      : null,
    candidato: presentUser(candidate, { contacto: canSeeContact }),
  };
}

function createUser(fields) {
  const timestamp = now();
  const user = {
    titulo: "",
    bio: "",
    telefono: "",
    habilidades: [],
    ...fields,
    id: nextId("user"),
    email: fields.email.toLowerCase(),
    creadoEn: timestamp,
    actualizadoEn: timestamp,
  };
  users.push(user);
  return user;
}

function createCompany(fields) {
  const timestamp = now();
  const company = {
    sitioWeb: "",
    logoUrl: "",
    sector: "",
    ...fields,
    id: nextId("company"),
    creadoEn: timestamp,
    actualizadoEn: timestamp,
  };
  companies.push(company);
  return company;
}

function createJob(fields) {
  const timestamp = now();
  const job = {
    salarioMin: null,
    salarioMax: null,
    moneda: "COP",
    vacantes: 1,
    requisitos: [],
    beneficios: [],
    experiencia: "indistinto",
    estado: "borrador",
    publicadoEn: null,
    ...fields,
    id: nextId("job"),
    creadoEn: timestamp,
    actualizadoEn: timestamp,
  };

  if (job.estado === "publicado") job.publicadoEn = timestamp;
  jobs.push(job);
  return job;
}

function updateJob(job, changes) {
  Object.assign(job, changes);
  if (job.estado === "publicado" && !job.publicadoEn) job.publicadoEn = now();
  job.actualizadoEn = now();
  return job;
}

function removeJob(id) {
  const index = jobs.findIndex((job) => job.id === id);
  if (index === -1) return null;

  const [job] = jobs.splice(index, 1);

  for (let i = applications.length - 1; i >= 0; i -= 1) {
    if (applications[i].trabajoId === id) applications.splice(i, 1);
  }

  for (let i = savedJobs.length - 1; i >= 0; i -= 1) {
    if (savedJobs[i].trabajoId === id) savedJobs.splice(i, 1);
  }

  return job;
}

function removeCompany(id) {
  if (jobs.some((job) => job.empresaId === id)) {
    return { conflict: true };
  }

  const index = companies.findIndex((company) => company.id === id);
  if (index === -1) return { missing: true };

  const [company] = companies.splice(index, 1);
  return { company };
}

function createApplication(fields) {
  const timestamp = now();
  const application = {
    nota: "",
    portafolioUrl: "",
    ...fields,
    id: nextId("application"),
    creadoEn: timestamp,
    actualizadoEn: timestamp,
  };
  applications.push(application);
  return application;
}

function addSaved(userId, trabajoId) {
  const existing = savedJobs.find(
    (item) => item.userId === userId && item.trabajoId === trabajoId
  );
  if (existing) return { saved: existing, created: false };

  const saved = { userId, trabajoId, creadoEn: now() };
  savedJobs.push(saved);
  return { saved, created: true };
}

function removeSaved(userId, trabajoId) {
  const index = savedJobs.findIndex(
    (item) => item.userId === userId && item.trabajoId === trabajoId
  );
  if (index === -1) return false;
  savedJobs.splice(index, 1);
  return true;
}

function touch(entity) {
  entity.actualizadoEn = now();
  return entity;
}

function seed(hashPassword) {
  if (users.length > 0) return;

  const created = new Map();

  for (const account of demoAccounts) {
    created.set(
      account.rol,
      createUser({
        nombre: account.nombre,
        email: account.email,
        passwordHash: hashPassword(account.password),
        rol: account.rol,
        titulo: account.titulo,
        bio: account.bio,
        habilidades: account.habilidades,
      })
    );
  }

  const empleador = created.get("empleador");
  const candidato = created.get("candidato");
  const empresa = createCompany({
    nombre: "Nexo Labs",
    descripcion: "Equipo de producto que construye herramientas de inteligencia artificial.",
    sitioWeb: "https://nexo.example",
    ubicacion: "Bogotá, Colombia",
    sector: "Tecnología",
    propietarioId: empleador.id,
  });

  const ia = createJob({
    titulo: "Ingeniero de inteligencia artificial",
    descripcion:
      "Diseñar, entrenar y poner en producción modelos que mejoren los productos de Nexo Labs.",
    empresaId: empresa.id,
    autorId: empleador.id,
    ubicacion: "Colombia",
    modalidad: "remoto",
    tipo: "tiempo_completo",
    experiencia: "senior",
    categoria: "Tecnología",
    salarioMin: 8000000,
    salarioMax: 12000000,
    moneda: "COP",
    vacantes: 2,
    requisitos: ["Python", "Modelos de lenguaje", "APIs"],
    beneficios: ["Trabajo remoto", "Presupuesto de formación"],
    estado: "publicado",
  });

  const diseno = createJob({
    titulo: "Diseñador de producto",
    descripcion:
      "Definir la experiencia de las herramientas internas y acompañar al equipo en cada entrega.",
    empresaId: empresa.id,
    autorId: empleador.id,
    ubicacion: "Bogotá",
    modalidad: "hibrido",
    tipo: "tiempo_completo",
    experiencia: "semi_senior",
    categoria: "Diseño",
    salarioMin: 5000000,
    salarioMax: 8000000,
    moneda: "COP",
    vacantes: 1,
    requisitos: ["Portafolio", "Investigación con usuarios"],
    beneficios: ["Seguro de salud", "Horario flexible"],
    estado: "publicado",
  });

  createJob({
    titulo: "Analista de datos",
    descripcion:
      "Construir tableros y análisis que ayuden a las áreas de negocio a decidir con datos.",
    empresaId: empresa.id,
    autorId: empleador.id,
    ubicacion: "Bogotá",
    modalidad: "presencial",
    tipo: "contrato",
    experiencia: "junior",
    categoria: "Datos",
    salarioMin: 4500000,
    salarioMax: 7000000,
    moneda: "COP",
    vacantes: 1,
    requisitos: ["SQL", "Hojas de cálculo"],
    beneficios: ["Bonificación por resultados"],
    estado: "pausado",
  });

  createJob({
    titulo: "Prácticas de frontend",
    descripcion:
      "Apoyar al equipo frontend durante seis meses construyendo interfaces con HTML, CSS y JavaScript.",
    empresaId: empresa.id,
    autorId: empleador.id,
    ubicacion: "Bogotá",
    modalidad: "hibrido",
    tipo: "practicas",
    experiencia: "junior",
    categoria: "Tecnología",
    salarioMin: 2000000,
    salarioMax: 2500000,
    moneda: "COP",
    vacantes: 3,
    requisitos: ["HTML", "CSS", "JavaScript"],
    beneficios: ["Mentoría"],
    estado: "borrador",
  });

  createApplication({
    trabajoId: ia.id,
    candidatoId: candidato.id,
    carta:
      "Me interesa el puesto porque he construido APIs con Node.js y quiero aplicar ese trabajo a productos de IA.",
    estado: "recibida",
  });

  addSaved(candidato.id, diseno.id);
}

module.exports = {
  users,
  companies,
  jobs,
  applications,
  savedJobs,
  demoAccounts,
  userById,
  companyById,
  jobById,
  applicationById,
  findUserByEmail,
  canManageCompany,
  canManageJob,
  activeApplication,
  presentUser,
  presentCompany,
  presentJob,
  presentApplication,
  createUser,
  createCompany,
  createJob,
  updateJob,
  removeJob,
  removeCompany,
  createApplication,
  addSaved,
  removeSaved,
  touch,
  seed,
};
