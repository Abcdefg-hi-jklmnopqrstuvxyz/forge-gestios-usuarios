// ===== webtrigger.js =====
// Webtrigger encargado de sincronizar campos de un issue cuando cambia el usuario asignado.
import api, { route } from '@forge/api';
import { getAllUsers } from './users-storage';

export const webtriggerHandler = async (event) => {
  try {
    const raw = event.body;
    const payload = JSON.parse(raw);

    const { issueKey, fieldValue } = payload;
    const usuario = fieldValue;

    const users = await getAllUsers();

    // Búsqueda case-insensitive (sin importar mayúsculas)
    const record = users.find((entry) =>
      entry.usuario.toLowerCase().trim() === usuario.toLowerCase().trim()
    );

    if (!record) {
      console.log('❌ Usuario NO encontrado en BD');
      return { statusCode: 404, body: 'Usuario no encontrado en base de datos' };
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
