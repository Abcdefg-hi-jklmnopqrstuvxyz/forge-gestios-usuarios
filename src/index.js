import api, { storage, route } from '@forge/api';
import Resolver from '@forge/resolver';

const resolver = new Resolver();

const CLIENTS = [
  "Dirección General de Rentas",
  "Municipalidad de Salta",
  "Municipios del Interior",
  "Gob Tech"
];

const TYPES = ["Nota", "Requerimiento"];

// ==============================
//   STORAGE SIMPLE Y FUNCIONAL
// ==============================

async function getAllUsers() {
  const raw = await storage.get('users');
  if (!raw) return [];
  return raw;
}

async function saveAllUsers(users) {
  await storage.set('users', users);
}

// ==============================
//        RESOLVERS CRUD
// ==============================

resolver.define("getUsers", async () => {
  return await getAllUsers();
});

resolver.define("saveUser", async (req) => {
  const { tipo, cliente, usuario, telefono, departamento } = req.payload;
  let users = await getAllUsers();

  const exists = users.find(
    u => u.tipo === tipo && u.cliente === cliente && u.usuario === usuario
  );

  if (!exists) {
    users.push({ tipo, cliente, usuario, telefono, departamento });
  } else {
    users = users.map(u =>
      (u.tipo === tipo && u.cliente === cliente && u.usuario === usuario)
        ? { tipo, cliente, usuario, telefono, departamento }
        : u
    );
  }

  await saveAllUsers(users);
  return { success: true };
});

resolver.define("updateUser", async (req) => {
  const { originalTipo, originalCliente, originalUsuario, tipo, cliente, usuario, telefono, departamento } = req.payload;
  let users = await getAllUsers();

  const index = users.findIndex(
    u => u.tipo === originalTipo && u.cliente === originalCliente && u.usuario === originalUsuario
  );

  if (index !== -1) {
    users[index] = { tipo, cliente, usuario, telefono, departamento };
    await saveAllUsers(users);
    return { success: true };
  }

  return { success: false };
});

resolver.define("deleteUser", async (req) => {
  const { tipo, cliente, usuario } = req.payload;

  const users = await getAllUsers();
  const newUsers = users.filter(
    u => !(u.tipo === tipo && u.cliente === cliente && u.usuario === usuario)
  );

  await saveAllUsers(newUsers);
  return { success: true };
});

resolver.define("bulkSaveUsers", async (req) => {
  const { newUsers } = req.payload;
  let currentUsers = await getAllUsers();

  const merged = [...currentUsers, ...newUsers];

  const map = new Map();
  merged.forEach(u => {
    map.set(`${u.tipo}|||${u.cliente}|||${u.usuario}`, u);
  });

  await saveAllUsers(Array.from(map.values()));
  return { success: true };
});

// ==============================
//     GET CAMPOS JIRA / JSM
// ==============================

export async function getClienteField(req) {
  const { issueKey } = req.payload;

  try {
    const response = await api.asApp().requestJira(
      route`/rest/api/3/issue/${issueKey}?fields=customfield_10121`
    );

    const data = await response.json();
    const cf = data.fields?.customfield_10121;

    if (!cf) return null;

    return cf.value || cf.name || null;
  } catch (e) {
    console.log("Error getClienteField:", e);
    return null;
  }
}

export async function getResueltoPorField(req) {
  const { issueKey } = req.payload;

  try {
    const response = await api.asApp().requestJira(
      route`/rest/api/3/issue/${issueKey}?fields=customfield_10126`
    );
    const data = await response.json();
    return data.fields?.customfield_10126 || null;
  } catch (e) {
    console.log("Error getResueltoPorField:", e);
    return null;
  }
}

resolver.define("getClienteField", getClienteField);
resolver.define("getResueltoPorField", getResueltoPorField);

export const handler = resolver.getDefinitions();
