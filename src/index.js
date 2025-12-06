import Resolver from '@forge/resolver';
import { getAllUsers, saveUsersChunked, TYPES } from './users-storage';

// Resolver principal para exponer CRUD de la base almacenada en Forge Storage.
const resolver = new Resolver();

resolver.define('getUsers', async () => {
  return await getAllUsers();
});

resolver.define('saveUser', async (req) => {
  const { tipo, cliente, usuario, telefono, departamento } = req.payload;
  let users = await getAllUsers();

  const exists = users.find((record) =>
    record.tipo === tipo && record.cliente === cliente && record.usuario === usuario
  );

  if (!exists) {
    users.push({ tipo, cliente, usuario, telefono, departamento });
  } else {
    users = users.map((record) => {
      if (record.tipo === tipo && record.cliente === cliente && record.usuario === usuario) {
        return { tipo, cliente, usuario, telefono, departamento };
      }
      return record;
    });
  }

  await saveUsersChunked(users);
  return { success: true };
});

resolver.define('updateUser', async (req) => {
  const { originalTipo, originalCliente, originalUsuario, tipo, cliente, usuario, telefono, departamento } = req.payload;
  let users = await getAllUsers();

  const index = users.findIndex((record) =>
    record.tipo === originalTipo && record.cliente === originalCliente && record.usuario === originalUsuario
  );

  if (index !== -1) {
    users[index] = { tipo, cliente, usuario, telefono, departamento };
    await saveUsersChunked(users);
    return { success: true };
  }

  return { success: false, error: 'Usuario no encontrado' };
});

resolver.define('deleteUser', async (req) => {
  const { tipo, cliente, usuario } = req.payload;
  const users = await getAllUsers();
  const newUsers = users.filter((record) =>
    !(record.tipo === tipo && record.cliente === cliente && record.usuario === usuario)
  );

  await saveUsersChunked(newUsers);
  return { success: true };
});

resolver.define('bulkSaveUsers', async (req) => {
  const { newUsers } = req.payload;
  const currentUsers = await getAllUsers();
  const combined = [...currentUsers, ...newUsers];

  const map = new Map();
  combined.forEach((record) => {
    const key = `${record.tipo}|||${record.cliente}|||${record.usuario}`;
    map.set(key, {
      tipo: record.tipo || TYPES[0],
      cliente: record.cliente || '',
      usuario: record.usuario || '',
      telefono: record.telefono || '',
      departamento: record.departamento || ''
    });
  });

  const uniqueUsers = Array.from(map.values());
  await saveUsersChunked(uniqueUsers);

  return { success: true, count: uniqueUsers.length };
});

// Exportamos el manejador para que Forge registre todas las definiciones anteriores.
export const handler = resolver.getDefinitions();

// Helper exportado para reutilizar la misma lógica desde módulos UI Kit sin duplicar código.
export async function fetchAllUsersFromResolver() {
  return await getAllUsers();
}
