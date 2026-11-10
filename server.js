const express = require("express");
const rateLimitRoot = require("./middleware/rateLimit");
const plataforma = require("./APIS-INTELIGENCIA-ARTIFICIAL");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", rateLimitRoot, (_req, res) => {
  res.json({
    message: "API Express funcionando",
    endpoints: {
      health: "GET /api/health",
      items: "GET|POST /api/items",
      itemById: "GET|PUT|DELETE /api/items/:id",
      plataforma: "GET /api/plataforma",
    },
  });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: "inteligencia-artificial",
    version: "1.0.0",
  });
});

const items = [
  { id: 1, name: "Item de ejemplo", createdAt: new Date().toISOString() },
];

app.get("/api/items", (_req, res) => {
  res.json(items);
});

app.get("/api/items/:id", (req, res) => {
  const item = items.find((i) => i.id === Number(req.params.id));

  if (!item) {
    return res.status(404).json({ error: "Item no encontrado" });
  }

  res.json(item);
});

app.post("/api/items", (req, res) => {
  const { name } = req.body;

  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "El campo 'name' es obligatorio" });
  }

  const item = {
    id: items.length ? Math.max(...items.map((i) => i.id)) + 1 : 1,
    name: name.trim(),
    createdAt: new Date().toISOString(),
  };

  items.push(item);
  res.status(201).json(item);
});

app.put("/api/items/:id", (req, res) => {
  const item = items.find((i) => i.id === Number(req.params.id));

  if (!item) {
    return res.status(404).json({ error: "Item no encontrado" });
  }

  const { name } = req.body;

  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "El campo 'name' es obligatorio" });
  }

  item.name = name.trim();
  item.updatedAt = new Date().toISOString();

  res.json(item);
});

app.delete("/api/items/:id", (req, res) => {
  const index = items.findIndex((i) => i.id === Number(req.params.id));

  if (index === -1) {
    return res.status(404).json({ error: "Item no encontrado" });
  }

  const [deleted] = items.splice(index, 1);
  res.json(deleted);
});

app.use("/api", plataforma);

app.use((_req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

app.use((err, _req, res, _next) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "El cuerpo de la petición no es JSON válido" });
  }

  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "El cuerpo de la petición es demasiado grande" });
  }

  console.error(err);
  return res.status(500).json({ error: "Error interno del servidor" });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
