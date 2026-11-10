const catalogos = {
  categorias: [
    "Tecnología",
    "Diseño",
    "Marketing",
    "Ventas",
    "Datos",
    "Operaciones",
    "Atención al cliente",
    "Administración",
  ],
  modalidades: ["presencial", "remoto", "hibrido"],
  tipos: ["tiempo_completo", "medio_tiempo", "contrato", "practicas", "freelance"],
  experiencias: ["junior", "semi_senior", "senior", "lead", "indistinto"],
  estadosTrabajo: ["borrador", "publicado", "pausado", "cerrado"],
  estadosPostulacion: [
    "recibida",
    "en_revision",
    "entrevista",
    "aceptada",
    "rechazada",
    "retirada",
  ],
  rolesRegistro: ["candidato", "empleador"],
  roles: ["candidato", "empleador", "admin"],
  ordenes: ["recientes", "salario"],
};

function fail(res, status, error, detalles) {
  const body = { error };
  if (detalles?.length) body.detalles = detalles;
  return res.status(status).json(body);
}

function asBody(req) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return null;
  }
  return req.body;
}

function hasOwn(body, key) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function parseId(value) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function asText(value, min, max) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (text.length < min || text.length > max) return null;
  return text;
}

function takeText(body, key, detalles, { min, max, required = false }) {
  if (!hasOwn(body, key)) {
    if (required) detalles.push(`${key} es obligatorio`);
    return undefined;
  }

  const text = asText(body[key], min, max);
  if (!text) {
    detalles.push(`${key} debe tener entre ${min} y ${max} caracteres`);
    return undefined;
  }

  return text;
}

function takeOptionalText(body, key, detalles, max) {
  if (!hasOwn(body, key)) return undefined;
  if (body[key] == null) return "";
  if (typeof body[key] !== "string" || body[key].trim().length > max) {
    detalles.push(`${key} debe tener como máximo ${max} caracteres`);
    return undefined;
  }
  return body[key].trim();
}

function takeEnum(body, key, detalles, allowed, { required = false } = {}) {
  if (!hasOwn(body, key)) {
    if (required) detalles.push(`${key} es obligatorio`);
    return undefined;
  }

  if (!allowed.includes(body[key])) {
    detalles.push(`${key} debe ser uno de: ${allowed.join(", ")}`);
    return undefined;
  }

  return body[key];
}

function asUrl(value) {
  if (value == null || value === "") return "";
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function takeUrl(body, key, detalles) {
  if (!hasOwn(body, key)) return undefined;
  const url = asUrl(body[key]);
  if (url == null) {
    detalles.push(`${key} debe ser una URL http o https`);
    return undefined;
  }
  return url;
}

function asStringList(value, maxItems, maxLen) {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const list = [];

  for (const item of value) {
    const text = asText(item, 1, maxLen);
    if (!text) return null;
    list.push(text);
  }

  return list;
}

function takeStringList(body, key, detalles, { maxItems = 20, maxLen = 120 } = {}) {
  if (!hasOwn(body, key)) return undefined;
  const list = asStringList(body[key], maxItems, maxLen);
  if (!list) {
    detalles.push(
      `${key} debe ser una lista de hasta ${maxItems} textos de ${maxLen} caracteres`
    );
    return undefined;
  }
  return list;
}

function asNumber(value, min, max, integer) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (integer && !Number.isInteger(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

function takeNumber(body, key, detalles, { min, max, integer = false, required = false, nullable = false }) {
  if (!hasOwn(body, key)) {
    if (required) detalles.push(`${key} es obligatorio`);
    return undefined;
  }

  if (body[key] == null && nullable) return null;

  const number = asNumber(body[key], min, max, integer);
  if (number == null) {
    detalles.push(
      `${key} debe ser ${integer ? "un entero" : "un número"} entre ${min} y ${max}`
    );
    return undefined;
  }

  return number;
}

function takeId(body, key, detalles, { required = false } = {}) {
  if (!hasOwn(body, key)) {
    if (required) detalles.push(`${key} es obligatorio`);
    return undefined;
  }

  if (typeof body[key] !== "number" || !Number.isSafeInteger(body[key]) || body[key] < 1) {
    detalles.push(`${key} debe ser un identificador válido`);
    return undefined;
  }

  return body[key];
}

function takeCurrency(body, detalles) {
  if (!hasOwn(body, "moneda")) return undefined;
  if (typeof body.moneda !== "string" || !/^[A-Za-z]{3}$/.test(body.moneda.trim())) {
    detalles.push("moneda debe ser un código de 3 letras");
    return undefined;
  }
  return body.moneda.trim().toUpperCase();
}

function normalizeEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function takePassword(value, detalles, label) {
  if (typeof value !== "string" || value.length < 8 || value.length > 72) {
    detalles.push(`${label} debe tener entre 8 y 72 caracteres`);
    return null;
  }
  return value;
}

function parseQueryInt(value, fallback, min, max, name, detalles) {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    detalles.push(`${name} debe ser un entero entre ${min} y ${max}`);
    return fallback;
  }

  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    detalles.push(`${name} debe ser un entero entre ${min} y ${max}`);
    return fallback;
  }

  return number;
}

function parsePagination(query) {
  const detalles = [];
  const pagina = parseQueryInt(query.pagina, 1, 1, 10000, "pagina", detalles);
  const limite = parseQueryInt(query.limite, 10, 1, 50, "limite", detalles);
  return { detalles, pagina, limite };
}

function paginate(list, pagina, limite) {
  const total = list.length;
  const paginas = total === 0 ? 0 : Math.ceil(total / limite);
  const start = (pagina - 1) * limite;

  return {
    data: list.slice(start, start + limite),
    paginacion: { pagina, limite, total, paginas },
  };
}

function takeQueryEnum(value, allowed, name, detalles) {
  if (value == null || value === "") return undefined;
  if (!allowed.includes(value)) {
    detalles.push(`${name} debe ser uno de: ${allowed.join(", ")}`);
    return undefined;
  }
  return value;
}

function takeQueryText(value, name, max, detalles) {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string" || value.trim().length > max) {
    detalles.push(`${name} debe tener como máximo ${max} caracteres`);
    return undefined;
  }
  return value.trim();
}

module.exports = {
  catalogos,
  fail,
  asBody,
  hasOwn,
  parseId,
  takeText,
  takeOptionalText,
  takeEnum,
  takeUrl,
  takeStringList,
  takeNumber,
  takeId,
  takeCurrency,
  normalizeEmail,
  takePassword,
  parsePagination,
  paginate,
  takeQueryEnum,
  takeQueryText,
};
