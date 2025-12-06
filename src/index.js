import api, { storage, route } from '@forge/api';
import Resolver from '@forge/resolver';
import {
  CustomFieldEdit,
  CustomFieldView,
  Option,
  Select,
  Stack,
  Text,
  render,
  useEffect,
  useProductContext,
  useState
} from '@forge/react';

const resolver = new Resolver();

const CLIENTS = [
  "Dirección General de Rentas",
  "Municipalidad de Salta",
  "Municipios del Interior",
  "Gob Tech"
];

const TYPES = ["Nota", "Requerimiento"];
const CLIENT_FIELD_ID = 'customfield_10121';

// Límite seguro: 200KB por chunk
const MAX_CHUNK_SIZE = 200000;

// ===== FUNCIONES DE STORAGE COMPARTIDAS =====

function chunkUsers(users) {
  const chunks = [];
  let currentChunk = [];
  let currentSize = 0;

  for (const user of users) {
    const userSize = JSON.stringify(user).length;
    
    if (currentSize + userSize > MAX_CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [user];
      currentSize = userSize;
    } else {
      currentChunk.push(user);
      currentSize += userSize;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

async function saveUsersChunked(users) {
  const chunks = chunkUsers(users);
  
  await storage.set('users_metadata', { chunkCount: chunks.length });
  
  for (let i = 0; i < chunks.length; i++) {
    await storage.set(`users_chunk_${i}`, chunks[i]);
  }

  const oldMetadata = await storage.get('users_metadata');
  if (oldMetadata && oldMetadata.chunkCount > chunks.length) {
    for (let i = chunks.length; i < oldMetadata.chunkCount; i++) {
      await storage.delete(`users_chunk_${i}`);
    }
  }
}

async function getAllUsersRaw() {
  const metadata = await storage.get('users_metadata');
  
  if (!metadata || !metadata.chunkCount) {
    const oldData = await storage.get('users');
    if (oldData && oldData.length > 0) {
      await saveUsersChunked(oldData);
      await storage.delete('users');
      return oldData;
    }
    return [];
  }

  const allUsers = [];
  for (let i = 0; i < metadata.chunkCount; i++) {
    const chunk = await storage.get(`users_chunk_${i}`);
    if (chunk) {
      allUsers.push(...chunk);
    }
  }

  return allUsers;
}

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
  
  if (raw.length > 0 && raw.some(r => r.name || r.phone)) {
    await saveUsersChunked(normalized);
  }
  
  return normalized;
}

async function getIssueField(issueKey, fieldId) {
  // Reads a single issue field using the app's credentials.
  const response = await api.asUser().requestJira(
    route`/rest/api/3/issue/${issueKey}?fields=${fieldId}`
  );
  const data = await response.json();
  return data && data.fields ? data.fields[fieldId] : undefined;
}

async function getFieldIdByModuleKey(moduleKey) {
  // Discovers the numeric Jira field id (e.g., customfield_12345) using the Forge module key.
  const searchResponse = await api.asUser().requestJira(
    route`/rest/api/3/field/search?query=${moduleKey}`
  );
  const searchData = await searchResponse.json();
  if (!searchData || !Array.isArray(searchData.values)) {
    return '';
  }

  const match = searchData.values.find((field) => {
    if (!field || !field.key) {
      return false;
    }
    return field.key.includes(moduleKey);
  });

  return match && match.id ? match.id : '';
}

// ===== RESOLVERS =====

resolver.define('getUsers', async () => {
  return await getAllUsers();
});

resolver.define('getIssueCliente', async (req) => {
  // Reads the Cliente field (customfield_10121) for the given issue.
  const issueKey = req.payload && req.payload.issueKey ? req.payload.issueKey : '';
  const fieldId = req.payload && req.payload.fieldId ? req.payload.fieldId : CLIENT_FIELD_ID;
  if (!issueKey) {
    return { value: '' };
  }

  const value = await getIssueField(issueKey, fieldId);
  return { value: value || '' };
});

resolver.define('saveUser', async (req) => {
  const { tipo, cliente, usuario, telefono, departamento } = req.payload;
  let users = await getAllUsers();
  
  const exists = users.find(u => 
    u.tipo === tipo && u.cliente === cliente && u.usuario === usuario
  );
  
  if (!exists) {
    users.push({ tipo, cliente, usuario, telefono, departamento });
  } else {
    users = users.map(u => {
      if (u.tipo === tipo && u.cliente === cliente && u.usuario === usuario) {
        return { tipo, cliente, usuario, telefono, departamento };
      }
      return u;
    });
  }

  await saveUsersChunked(users);
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
    await saveUsersChunked(users);
    return { success: true };
  }
  
  return { success: false, error: 'Usuario no encontrado' };
});

resolver.define('deleteUser', async (req) => {
  const { tipo, cliente, usuario } = req.payload;
  let users = await getAllUsers();
  const newUsers = users.filter(u => 
    !(u.tipo === tipo && u.cliente === cliente && u.usuario === usuario)
  );
  
  await saveUsersChunked(newUsers);
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
  await saveUsersChunked(uniqueUsers);

  return { success: true, count: uniqueUsers.length };
});

resolver.define('getResueltoPorValue', async (req) => {
  // Returns the stored value of the "Resuelto Por" custom field for the given issue.
  const issueKey = req.payload && req.payload.issueKey ? req.payload.issueKey : '';
  const moduleKey = req.payload && req.payload.moduleKey ? req.payload.moduleKey : '';

  if (!issueKey || !moduleKey) {
    return { value: null };
  }

  const targetFieldId = await getFieldIdByModuleKey(moduleKey);
  if (!targetFieldId) {
    return { value: null };
  }

  const value = await getIssueField(issueKey, targetFieldId);
  return { value: value || null };
});

// ===== UI KIT RENDERERS =====

function getIssueKeyFromContext(productContext) {
  // Safely retrieves the issue key from the product context for both edit and view renderers.
  if (!productContext) {
    return '';
  }

  // UI kit contexts can surface the issueKey on either extensionContext or platformContext
  const extensionIssue = productContext.extensionContext && productContext.extensionContext.issueKey
    ? productContext.extensionContext.issueKey
    : '';
  const platformIssue = productContext.platformContext && productContext.platformContext.issueKey
    ? productContext.platformContext.issueKey
    : '';

  return extensionIssue || platformIssue || '';
}

function buildResueltoOptions(users) {
  // Converts filtered user entries into Select options without hardcoded values.
  return users.map((user) => {
    const label = `${user.usuario}${user.departamento ? ` (${user.departamento})` : ''}`;
    return Option({ label, value: user.usuario });
  });
}

const ResueltoPorEdit = () => {
  const context = useProductContext();
  const issueKey = getIssueKeyFromContext(context);

  const [state, setState] = useState({
    loading: true,
    options: [],
    selectedUser: '',
    selectedDepartamento: '',
    error: ''
  });

  useEffect(() => {
    // Load Cliente and candidate users, then hydrate the initial selection from Jira.
    const run = async () => {
      try {
        const clienteValue = await getIssueField(issueKey, CLIENT_FIELD_ID);
        const users = await getAllUsers();
        const filtered = users.filter((user) => {
          const matchesTipo = user.tipo === TYPES[1];
          const matchesCliente = (user.cliente || '').toLowerCase() === (clienteValue || '').toLowerCase();
          return matchesTipo && matchesCliente;
        });

        let storedUser = '';
        let storedDepartamento = '';
        const fieldId = await getFieldIdByModuleKey('resuelto-por-field');
        if (fieldId) {
          const storedValue = await getIssueField(issueKey, fieldId);
          storedUser = storedValue && storedValue.usuario ? storedValue.usuario : '';
          storedDepartamento = storedValue && storedValue.departamento ? storedValue.departamento : '';
        }

        setState({
          loading: false,
          options: filtered,
          selectedUser: storedUser,
          selectedDepartamento: storedDepartamento,
          error: filtered.length === 0 ? 'No hay usuarios disponibles para el cliente seleccionado.' : ''
        });
      } catch (err) {
        console.error('Error cargando opciones de Resuelto Por', err);
        setState({
          loading: false,
          options: [],
          selectedUser: '',
          selectedDepartamento: '',
          error: 'No se pudieron cargar los usuarios desde storage.'
        });
      }
    };

    run();
  }, [issueKey]);

  const onChangeUser = (newUser) => {
    // When a user is picked, locate the department immediately for save operations.
    const match = state.options.find((u) => u.usuario === newUser);
    const departamento = match && match.departamento ? match.departamento : '';
    setState({
      ...state,
      selectedUser: newUser,
      selectedDepartamento: departamento
    });
  };

  return CustomFieldEdit({
    onSave: async () => ({
      usuario: state.selectedUser || '',
      departamento: state.selectedDepartamento || ''
    }),
    children: Stack({
      children: [
        Text({ content: 'Selecciona el usuario que resolvió el requerimiento.' }),
        state.error ? Text({ content: state.error }) : null,
        Select({
          label: 'Resuelto Por',
          isRequired: false,
          isDisabled: state.loading || state.options.length === 0,
          value: state.selectedUser,
          onChange: onChangeUser,
          children: [
            Option({ label: 'Selecciona un usuario', value: '' }),
            ...buildResueltoOptions(state.options)
          ]
        })
      ].filter(Boolean)
    })
  });
};

const ResueltoPorView = (props) => {
  const value = props && props.value ? props.value : null;
  const display = value && value.usuario
    ? `${value.usuario}${value.departamento ? ` – ${value.departamento}` : ''}`
    : 'Sin usuario seleccionado';

  return CustomFieldView({
    children: Text({ content: display })
  });
};

const DptoResueltoPorEdit = () => {
  const context = useProductContext();
  const issueKey = getIssueKeyFromContext(context);

  const [state, setState] = useState({
    loading: true,
    departamento: '',
    error: ''
  });

  useEffect(() => {
    const run = async () => {
      try {
        const fieldId = await getFieldIdByModuleKey('resuelto-por-field');
        const stored = fieldId ? await getIssueField(issueKey, fieldId) : null;
        const selectedUser = stored && stored.usuario ? stored.usuario : '';

        if (!selectedUser) {
          setState({ loading: false, departamento: '', error: 'Sin usuario seleccionado en Resuelto Por.' });
          return;
        }

        const clienteValue = await getIssueField(issueKey, CLIENT_FIELD_ID);
        const users = await getAllUsers();
        const filteredUsers = users.filter((user) => {
          const matchesTipo = user.tipo === TYPES[1];
          const matchesCliente = (user.cliente || '').toLowerCase() === (clienteValue || '').toLowerCase();
          return matchesTipo && matchesCliente;
        });

        const found = filteredUsers.find((u) => u.usuario === selectedUser);
        const departamento = found && found.departamento ? found.departamento : '';

        setState({ loading: false, departamento, error: '' });
      } catch (err) {
        console.error('Error cargando departamento derivado', err);
        setState({ loading: false, departamento: '', error: 'No se pudo calcular el departamento.' });
      }
    };

    run();
  }, [issueKey]);

  const display = state.departamento || 'Sin departamento asignado';

  return CustomFieldEdit({
    onSave: async () => state.departamento || '',
    children: Stack({
      children: [
        Text({ content: 'Departamento asociado al usuario seleccionado en Resuelto Por.' }),
        state.error ? Text({ content: state.error }) : Text({ content: display })
      ]
    })
  });
};

const DptoResueltoPorView = (props) => {
  const display = props && props.value ? props.value : 'Sin departamento asignado';

  return CustomFieldView({
    children: Text({ content: display })
  });
};

export const resueltoPorEdit = render(ResueltoPorEdit);
export const resueltoPorView = render(ResueltoPorView);
export const dptoResueltoPorEdit = render(DptoResueltoPorEdit);
export const dptoResueltoPorView = render(DptoResueltoPorView);

export const handler = resolver.getDefinitions();
