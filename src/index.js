import Resolver from '@forge/resolver';
import { storage } from '@forge/api';

const resolver = new Resolver();

async function getAllUsers() {
  const item = await storage.get('users');
  return item ? item : [];
}

resolver.define('getUsers', async () => {
  return await getAllUsers();
});

resolver.define('saveUser', async (req) => {
  const { name, phone } = req.payload;
  const users = await getAllUsers();
  
  if (!users.find(u => u.name === name)) {
    users.push({ name, phone });
    await storage.set('users', users);
  }
  return { success: true };
});

resolver.define('updateUser', async (req) => {
  const { originalName, newName, newPhone } = req.payload;
  let users = await getAllUsers();

  const index = users.findIndex(u => u.name === originalName);
  if (index !== -1) {
    users[index] = { name: newName, phone: newPhone };
    await storage.set('users', users);
    return { success: true };
  }
  return { success: false, error: 'Usuario no encontrado' };
});

resolver.define('deleteUser', async (req) => {
  const { name } = req.payload;
  let users = await getAllUsers();
  const newUsers = users.filter(u => u.name !== name);
  await storage.set('users', newUsers);
  return { success: true };
});

resolver.define('bulkSaveUsers', async (req) => {
  const { newUsers } = req.payload;
  let currentUsers = await getAllUsers();
  const combined = [...currentUsers, ...newUsers];
  
  const uniqueUsers = Array.from(new Set(combined.map(a => a.name)))
    .map(name => combined.find(a => a.name === name));

  await storage.set('users', uniqueUsers);
  return { success: true, count: uniqueUsers.length };
});

export const handler = resolver.getDefinitions();