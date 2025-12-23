import api, { storage, route } from '@forge/api';
import Resolver from '@forge/resolver';

const resolver = new Resolver();

const CLIENTS = [
  "Dir. Gral. Rentas Salta",
  "Municipalidad de Salta",
  "Municipios del Interior",
  "Gob Tech"
];

const TYPES = ["Nota", "Requerimientos"];
const USER_KIND = ["Cliente", "Interno"];

// ==============================
//       CONFIG CHUNKING
// ==============================

const MAX_CHUNK_SIZE = 200000; // ~200 KB Forge limit

function chunkArray(data) {
  const chunks = [];
  let current = [];
  let size = 0;

  for (const item of data) {
    const itemSize = JSON.stringify(item).length;

    if (size + itemSize >= MAX_CHUNK_SIZE && current.length > 0) {
      chunks.push(current);
      current = [item];
      size = itemSize;
    } else {
      current.push(item);
      size += itemSize;
    }
  }

  if (current.length > 0) chunks.push(current);

  return chunks;
}

async function saveUsersChunked(users) {
  const chunks = chunkArray(users);

  await storage.set("users_metadata", { chunkCount: chunks.length });

  for (let i = 0; i < chunks.length; i++) {
    await storage.set(`users_chunk_${i}`, chunks[i]);
  }
}

async function getUsersChunked() {
  const meta = await storage.get("users_metadata");

  if (!meta) {
    const legacy = await storage.get("users");
    if (legacy) {
      await saveUsersChunked(legacy);
      await storage.delete("users");
      return legacy;
    }
    return [];
  }

  const result = [];

  for (let i = 0; i < meta.chunkCount; i++) {
    const part = await storage.get(`users_chunk_${i}`);
    if (part) result.push(...part);
  }

  return result;
}

// ==============================
// NORMALIZACIÓN (importante)
// ==============================

function normalize(entries) {
  return entries.map(e => ({
    tipo: e.tipo || TYPES[0],
    cliente: e.cliente || CLIENTS[0],
    tipoUsuario: e.tipoUsuario || USER_KIND[0],   // <<--- AGREGADO
    usuario: e.usuario || '',
    telefono: e.telefono || '',
    departamento: e.departamento || ''
  }));
}

// ==============================
//       RESOLVERS CRUD
// ==============================

resolver.define("getUsers", async () => {
  const data = await getUsersChunked();
  return normalize(data);
});

resolver.define("saveUser", async (req) => {
  const { tipo, cliente, tipoUsuario, usuario, telefono, departamento } = req.payload;

  let users = await getUsersChunked();
  const exists = users.find(
    u => u.tipo === tipo && u.cliente === cliente && u.usuario === usuario
  );

  if (!exists) {
    users.push({ tipo, cliente, tipoUsuario, usuario, telefono, departamento });
  } else {
    users = users.map(u =>
      (u.tipo === tipo && u.cliente === cliente && u.usuario === usuario)
        ? { tipo, cliente, tipoUsuario, usuario, telefono, departamento }
        : u
    );
  }

  await saveUsersChunked(users);
  return { success: true };
});

resolver.define("deleteUser", async (req) => {
  const { tipo, cliente, usuario } = req.payload;

  let users = await getUsersChunked();
  users = users.filter(
    u => !(u.tipo === tipo && u.cliente === cliente && u.usuario === usuario)
  );

  await saveUsersChunked(users);
  return { success: true };
});

resolver.define("clearUsers", async () => {
  const metadata = await storage.get('users_metadata');

  if (metadata?.chunkCount) {
    for (let i = 0; i < metadata.chunkCount; i++) {
      await storage.delete(`users_chunk_${i}`);
    }
  }

  await storage.delete('users_metadata');
  await storage.delete('users');   // por si acaso existió alguna vez

  return { success: true };
});

resolver.define("updateUser", async (req) => {
  const { 
    originalTipo, originalCliente, originalUsuario,
    tipo, cliente, tipoUsuario, usuario, telefono, departamento 
  } = req.payload;

  let users = await getUsersChunked();

  const index = users.findIndex(
    u =>
      u.tipo === originalTipo &&
      u.cliente === originalCliente &&
      u.usuario === originalUsuario
  );

  if (index === -1) {
    return { success: false, error: "No encontrado" };
  }

  users[index] = { tipo, cliente, tipoUsuario, usuario, telefono, departamento };

  await saveUsersChunked(users);
  return { success: true };
});

resolver.define("bulkSaveUsers", async (req) => {
  const { newUsers } = req.payload;

  let users = await getUsersChunked();
  const merged = [...users, ...newUsers];

  const map = new Map();
  merged.forEach(u => {
    map.set(`${u.tipo}|||${u.cliente}|||${u.usuario}`, {
      ...u,
      tipoUsuario: u.tipoUsuario || USER_KIND[0] // <<--- AGREGADO
    });
  });

  await saveUsersChunked(Array.from(map.values()));
  return { success: true };
});

// ==============================
//     CAMPOS JIRA (GET)
// ==============================

export async function getClienteField(req) {
  const { issueKey } = req.payload;

  try {
    const resp = await api.asApp().requestJira(
      route`/rest/api/3/issue/${issueKey}?fields=customfield_10726`
    );

    const data = await resp.json();
    const cf = data.fields?.customfield_10726;

    return cf?.value || cf?.name || null;
  } catch (e) {
    console.log("Error getClienteField:", e);
    return null;
  }
}

export async function getResueltoPorField(req) {
  const { issueKey } = req.payload;

  try {
    const resp = await api.asApp().requestJira(
      route`/rest/api/3/issue/${issueKey}?fields=customfield_11669`
    );
    

    const data = await resp.json();
    console.log("USERS STORED:", allUsers);
    return data.fields?.customfield_11669 || null;
  } catch (e) {
    console.log("Error getResueltoPorField:", e);
    return null;
  }
}

resolver.define("getClienteField", getClienteField);
resolver.define("getResueltoPorField", getResueltoPorField);

export const handler = resolver.getDefinitions();

