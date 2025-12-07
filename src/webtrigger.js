// ===== webtrigger.js =====
// Webtrigger encargado de sincronizar campos de un issue cuando cambia el usuario asignado.

import api, { storage, route } from '@forge/api';

// Los mismos clientes y tipos usados en index.js
const CLIENTS = [
  "Dirección General de Rentas",
  "Municipalidad de Salta",
  "Municipios del Interior",
  "Gob Tech"
];

const TYPES = ["Nota", "Requerimiento"];

// =============================
// FUNCIONES DE STORAGE (idénticas a index.js)
// =============================

async function getAllUsersRaw() {
  const metadata = await storage.get('users_metadata');
  
  if (!metadata || !metadata.chunkCount) {
    const oldData = await storage.get('users');
    return oldData || [];
  }

  const allUsers = [];
  for (let i = 0; i < metadata.chunkCount; i++) {
    const chunk = await storage.get(`users_chunk_${i}`);
    if (chunk) allUsers.push(...chunk);
  }

  return allUsers;
}

function normalizeEntries(entries) {
  return entries.map(e => ({
    tipo: e.tipo || TYPES[0],
    cliente: e.cliente || CLIENTS[0],
    usuario: e.usuario || '',
    telefono: e.telefono || '',
    departamento: e.departamento || ''
  }));
}

async function getAllUsers() {
  const raw = await getAllUsersRaw();
  return normalizeEntries(raw);
}

// =============================
// WEBTRIGGER
// =============================

export const webtriggerHandler = async (event) => {
  try {
    const raw = event.body;
    const payload = JSON.parse(raw);

    const { issueKey, fieldValue } = payload;
    const usuario = fieldValue?.trim();

    if (!usuario) {
      return { statusCode: 400, body: 'Usuario vacío' };
    }

    const users = await getAllUsers();

    const record = users.find(
      (u) => u.usuario.toLowerCase().trim() === usuario.toLowerCase()
    );

    if (!record) {
      console.log('❌ Usuario NO encontrado en la base de datos');
      return { statusCode: 404, body: 'Usuario no encontrado' };
    }

    const updateBody = {
      fields: {
        customfield_11380: record.telefono,
        customfield_11378: record.departamento
      }
    };

    await api.asApp().requestJira(
      route`/rest/api/3/issue/${issueKey}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody)
      }
    );

    return {
      statusCode: 200,
      body: 'Campos actualizados correctamente'
    };

  } catch (err) {
    console.error('❌ ERROR GENERAL:', err);
    return {
      statusCode: 500,
      body: 'Error procesando el WebTrigger'
    };
  }
};
