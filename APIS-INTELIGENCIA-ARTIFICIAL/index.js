const express = require("express");
const data = require("./data");
const { hashPassword } = require("./auth");
const { catalogos } = require("./http");

data.seed(hashPassword);

const authRoutes = require("./routes/auth");
const usuariosRoutes = require("./routes/usuarios");
const empresasRoutes = require("./routes/empresas");
const trabajosRoutes = require("./routes/trabajos");
const postulacionesRoutes = require("./routes/postulaciones");
const guardadosRoutes = require("./routes/guardados");
const adminRoutes = require("./routes/admin");

const router = express.Router();

router.get("/plataforma", (_req, res) => {
  res.json({
    nombre: "Plataforma de trabajos",
    autenticacion: "Authorization: Bearer <token>",
    persistencia:
      "Los datos viven en memoria. Al reiniciar el servidor vuelven las cuentas y vacantes de demostración.",
    cuentasDemo: data.demoAccounts.map(({ rol, nombre, email, password }) => ({
      rol,
      nombre,
      email,
      password,
    })),
    endpoints: {
      catalogos: "GET /api/catalogos",
      registro: "POST /api/auth/registro",
      login: "POST /api/auth/login",
      logout: "POST /api/auth/logout",
      sesion: "GET /api/auth/me",
      perfil: "GET|PUT /api/usuarios/me",
      password: "PATCH /api/usuarios/me/password",
      usuario: "GET /api/usuarios/:id",
      empresas: "GET|POST /api/empresas",
      misEmpresas: "GET /api/empresas/mias",
      empresa: "GET|PUT|DELETE /api/empresas/:id",
      trabajosEmpresa: "GET /api/empresas/:id/trabajos",
      trabajos:
        "GET /api/trabajos?q&ubicacion&modalidad&tipo&experiencia&categoria&empresaId&estado&salarioMin&orden=recientes|salario&pagina&limite",
      crearTrabajo: "POST /api/trabajos",
      misTrabajos: "GET /api/trabajos/mios",
      trabajo: "GET|PUT|DELETE /api/trabajos/:id",
      estadoTrabajo: "PATCH /api/trabajos/:id/estado",
      postulacionesTrabajo: "GET|POST /api/trabajos/:id/postulaciones",
      guardarTrabajo: "POST|DELETE /api/trabajos/:id/guardar",
      guardados: "GET /api/guardados",
      misPostulaciones: "GET /api/postulaciones/mias",
      postulacion: "GET|PATCH /api/postulaciones/:id",
      adminResumen: "GET /api/admin/resumen",
      adminUsuarios: "GET /api/admin/usuarios",
      adminRol: "PATCH /api/admin/usuarios/:id",
    },
  });
});

router.get("/catalogos", (_req, res) => {
  res.json(catalogos);
});

router.use("/auth", authRoutes);
router.use("/usuarios", usuariosRoutes);
router.use("/empresas", empresasRoutes);
router.use("/trabajos", trabajosRoutes);
router.use("/postulaciones", postulacionesRoutes);
router.use("/guardados", guardadosRoutes);
router.use("/admin", adminRoutes);

module.exports = router;
