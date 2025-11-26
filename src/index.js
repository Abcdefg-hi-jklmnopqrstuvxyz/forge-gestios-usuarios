import Resolver from '@forge/resolver';
import { storage } from '@forge/api';

const resolver = new Resolver();

const CLIENTS = [
  "Dirección General de Rentas",
  "Municipalidad de Salta",
  "Municipalidad del Interior",
  "Gob Tech"
];

const TYPES = ["Nota", "Requerimiento"];

async function getAllUsersRaw() {
  const item = await storage.get('users');
  return item ? item : [];
}

//datos{ tipo, cliente, usuario, telefono, departamento }
function normalizeEntries(entries) {
  return entries.map(e => {

    if (e.name || e.phone) {
      return {
        tipo: TYPES[0],
        cliente: CLIENTS[0],
        usuario: e.name || '',
        telefono: e.phone || '',
        departamento: e.departamento || ''
      };
    }

    return {
      tipo: e.tipo || TYPES[0],
      cliente: e.cliente || CLIENTS[0],
      usuario: e.usuario || '',
      telefono: e.telefono || '',
      departamento: e.departamento || ''
    };
  });
}

async function getAllUsers() {
  const raw = await getAllUsersRaw();
  const normalized = normalizeEntries(raw);
  if (raw.length > 0 && raw.some(r => r.name || r.phone) ) {
    await storage.set('users', normalized);
  }
  return normalized;
}

resolver.define('getUsers', async () => {
  return await getAllUsers();
});

resolver.define('saveUser', async (req) => {
  const { tipo, cliente, usuario, telefono, departamento } = req.payload;
  let users = await getAllUsers();
  const exists = users.find(u => u.tipo === tipo && u.cliente === cliente && u.usuario === usuario);
  if (!exists) {
    users.push({ tipo, cliente, usuario, telefono, departamento });
    await storage.set('users', users);
  } else {
    users = users.map(u => {
      if (u.tipo === tipo && u.cliente === cliente && u.usuario === usuario) {
        return { tipo, cliente, usuario, telefono, departamento };
      }
      return u;
    });
    await storage.set('users', users);
  }

  return { success: true };
});

resolver.define('updateUser', async (req) => {
  const { originalTipo, originalCliente, originalUsuario, tipo, cliente, usuario, telefono, departamento } = req.payload;
  let users = await getAllUsers();

  const index = users.findIndex(u =>
    u.tipo === originalTipo && u.cliente === originalCliente && u.usuario === originalUsuario
  );

  if (index !== -1) {
    users[index] = { tipo, cliente, usuario, telefono, departamento };
    await storage.set('users', users);
    return { success: true };
  }
  return { success: false, error: 'Usuario no encontrado' };
});

resolver.define('deleteUser', async (req) => {
  const { tipo, cliente, usuario } = req.payload;
  let users = await getAllUsers();
  const newUsers = users.filter(u => !(u.tipo === tipo && u.cliente === cliente && u.usuario === usuario));
  await storage.set('users', newUsers);
  return { success: true };
});

resolver.define('bulkSaveUsers', async (req) => {
  const { newUsers } = req.payload;
  let currentUsers = await getAllUsers();
  const combined = [...currentUsers, ...newUsers];

  const map = new Map();
  combined.forEach(u => {
    const key = `${u.tipo}|||${u.cliente}|||${u.usuario}`;
    map.set(key, {
      tipo: u.tipo || TYPES[0],
      cliente: u.cliente || CLIENTS[0],
      usuario: u.usuario || '',
      telefono: u.telefono || '',
      departamento: u.departamento || ''
    });
  });

  const uniqueUsers = Array.from(map.values());
  await storage.set('users', uniqueUsers);

  return { success: true, count: uniqueUsers.length };
});

export const handler = resolver.getDefinitions();
