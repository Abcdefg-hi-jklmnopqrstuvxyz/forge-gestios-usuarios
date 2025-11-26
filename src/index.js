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

/**
 * Normaliza datos antiguos (formatos {name, phone}) a nuevo esquema:
 * { tipo, cliente, usuario, telefono, departamento }
 */
function normalizeEntries(entries) {
  return entries.map(e => {
    // detect older format
    if (e.name || e.phone) {
      return {
        tipo: TYPES[0], // default 'Nota' (puedes ajustar)
        cliente: CLIENTS[0], // default primer cliente
        usuario: e.name || '',
        telefono: e.phone || '',
        departamento: e.departamento || ''
      };
    }
    // If already in new schema, ensure keys exist
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
  // update storage if normalization changed shape (so migration is automatic)
  // check by simple heuristic: if any item had .name present originally, we should overwrite
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

  // avoid duplicate exact records (same tipo+cliente+usuario)
  const exists = users.find(u => u.tipo === tipo && u.cliente === cliente && u.usuario === usuario);
  if (!exists) {
    users.push({ tipo, cliente, usuario, telefono, departamento });
    await storage.set('users', users);
  } else {
    // If exists, optionally we could update telefono/departamento if changed; let's update them:
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

/**
 * Update user found by original keys (originalTipo, originalCliente, originalUsuario)
 */
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

/**
 * Delete by composite key
 */
resolver.define('deleteUser', async (req) => {
  const { tipo, cliente, usuario } = req.payload;
  let users = await getAllUsers();
  const newUsers = users.filter(u => !(u.tipo === tipo && u.cliente === cliente && u.usuario === usuario));
  await storage.set('users', newUsers);
  return { success: true };
});

/**
 * Bulk save: accepts array of entries in the new schema.
 * Deduplicate by composite key tipo+cliente+usuario (keeps last occurrence).
 */
resolver.define('bulkSaveUsers', async (req) => {
  const { newUsers } = req.payload; // expects array of { tipo, cliente, usuario, telefono, departamento }
  let currentUsers = await getAllUsers();

  // combine and dedupe by composite key
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
