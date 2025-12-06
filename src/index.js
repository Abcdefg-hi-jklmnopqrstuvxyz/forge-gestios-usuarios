import api, { storage } from '@forge/api';
import { invoke } from '@forge/bridge';
import {
  CustomField,
  Select,
  Option,
  SectionMessage,
  Spinner,
  Text,
  useEffect,
  useProductContext,
  useState,
  render
} from '@forge/react';
import Resolver from '@forge/resolver';

const resolver = new Resolver();

const CLIENTS = [
  "Dirección General de Rentas",
  "Municipalidad de Salta",
  "Municipios del Interior",
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

/**
 * Fetches all users through the existing resolver so the UI flows reuse the API contract the
 * customer already depends on. The resolver already encapsulates normalization and persistence.
 */
async function fetchUsersFromResolver() {
  return await invoke('getUsers');
}

/**
 * Reads the customer value from the provided issue using the app identity. This avoids
 * leaking any user data and aligns with the requirement to rely on api.asApp().requestJira().
 */
async function readClienteFromIssue(issueKey) {
  const response = await api.asApp().requestJira(
    `/rest/api/3/issue/${issueKey}?fields=customfield_10121`
  );
  const data = await response.json();
  return data?.fields?.customfield_10121 || '';
}

/**
 * Retrieves the value stored in the "Resuelto Por" custom field by first resolving the field id
 * via its display name. This keeps the code independent from environment-specific field ids.
 */
async function readResueltoPorFromIssue(issueKey) {
  const fieldsResponse = await api.asApp().requestJira('/rest/api/3/field');
  const allFields = await fieldsResponse.json();
  const resueltoField = allFields.find(field => field.name === 'Resuelto Por');
  if (!resueltoField) {
    return '';
  }

  const issueResponse = await api
    .asApp()
    .requestJira(`/rest/api/3/issue/${issueKey}?fields=${resueltoField.id}`);
  const issueData = await issueResponse.json();
  return issueData?.fields?.[resueltoField.id] || '';
}

/**
 * Filters the full dataset to only include records that match the selected customer and are of
 * the type "Requerimiento". This guarantees that the selectable options always reflect the
 * latest dynamic data stored in Forge Storage.
 */
function filterUsersForCliente(users, cliente) {
  return users.filter(user => user.tipo === 'Requerimiento' && user.cliente === cliente);
}

/**
 * Given a user name, customer and a dataset, resolves the matching record and returns its
 * department.
 */
function lookupDepartamento(users, cliente, usuario) {
  const match = users.find(
    user => user.tipo === 'Requerimiento' && user.cliente === cliente && user.usuario === usuario
  );
  return match ? match.departamento : '';
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

/**
 * UI Kit 2 edit view for the "Resuelto Por" custom field. It dynamically loads the customer from
 * the issue, calls the getUsers resolver to retrieve the full dataset, filters the options, and
 * persists the selected user name.
 */
export const resueltoPorEdit = render(
  <CustomField>
    {({ value, onChange }) => {
      const { platformContext } = useProductContext();
      const [cliente, setCliente] = useState('');
      const [options, setOptions] = useState([]);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState('');
      const [selectedUser, setSelectedUser] = useState(value || '');

      useEffect(() => {
        const loadUsers = async () => {
          setLoading(true);
          setError('');
          try {
            const issueKey = platformContext?.issueKey || '';
            const clienteValue = await readClienteFromIssue(issueKey);
            setCliente(clienteValue);

            const allUsers = await fetchUsersFromResolver();
            const filtered = filterUsersForCliente(allUsers || [], clienteValue);
            setOptions(filtered);
          } catch (err) {
            setError('No fue posible cargar usuarios dinámicos');
          } finally {
            setLoading(false);
          }
        };

        loadUsers();
      }, [platformContext?.issueKey]);

      const handleChange = (newValue) => {
        setSelectedUser(newValue);
        onChange(newValue);
      };

      if (loading) {
        return <Spinner />;
      }

      if (error) {
        return (
          <SectionMessage title="Error al cargar" appearance="error">
            <Text>{error}</Text>
          </SectionMessage>
        );
      }

      if (!cliente) {
        return (
          <SectionMessage title="Cliente no encontrado" appearance="warning">
            <Text>El campo Cliente (customfield_10121) no tiene valor en el issue.</Text>
          </SectionMessage>
        );
      }

      if (options.length === 0) {
        return (
          <SectionMessage title="Sin opciones" appearance="warning">
            <Text>No hay usuarios configurados para el cliente "{cliente}".</Text>
          </SectionMessage>
        );
      }

      return (
        <Select value={selectedUser} onChange={handleChange} label="Resuelto por">
          {options.map(user => (
            <Option key={`${user.usuario}`} label={user.usuario} value={user.usuario} />
          ))}
        </Select>
      );
    }}
  </CustomField>
);

/**
 * Read-only view for the "Resuelto Por" custom field. Displays the stored user name or a friendly
 * placeholder when nothing has been selected yet.
 */
export const resueltoPorView = render(
  <CustomField>
    {({ value }) => <Text>{value || 'Sin usuario seleccionado'}</Text>}
  </CustomField>
);

/**
 * Edit view for the "Dpto Resuelto Por" custom field. The component is read-only for users and it
 * automatically derives the department by reading the currently selected "Resuelto Por" value and
 * matching it against the dynamic dataset in storage.
 */
export const dptoResueltoPorEdit = render(
  <CustomField>
    {({ onChange }) => {
      const { platformContext } = useProductContext();
      const [cliente, setCliente] = useState('');
      const [resueltoPor, setResueltoPor] = useState('');
      const [departamento, setDepartamento] = useState('');
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState('');

      useEffect(() => {
        const resolveDepartment = async () => {
          setLoading(true);
          setError('');
          try {
            const issueKey = platformContext?.issueKey || '';
            const clienteValue = await readClienteFromIssue(issueKey);
            const resueltoPorValue = await readResueltoPorFromIssue(issueKey);

            setCliente(clienteValue);
            setResueltoPor(resueltoPorValue);

            if (clienteValue && resueltoPorValue) {
              const allUsers = await fetchUsersFromResolver();
              const departamentoValue = lookupDepartamento(
                allUsers || [],
                clienteValue,
                resueltoPorValue
              );
              setDepartamento(departamentoValue);
              onChange(departamentoValue);
            } else {
              setDepartamento('');
              onChange('');
            }
          } catch (err) {
            setError('No fue posible determinar el departamento');
          } finally {
            setLoading(false);
          }
        };

        resolveDepartment();
      }, [platformContext?.issueKey]);

      if (loading) {
        return <Spinner />;
      }

      if (error) {
        return (
          <SectionMessage title="Error" appearance="error">
            <Text>{error}</Text>
          </SectionMessage>
        );
      }

      if (!cliente) {
        return (
          <SectionMessage title="Cliente no encontrado" appearance="warning">
            <Text>El campo Cliente (customfield_10121) no tiene valor en el issue.</Text>
          </SectionMessage>
        );
      }

      if (!resueltoPor) {
        return (
          <SectionMessage title="Sin usuario seleccionado" appearance="warning">
            <Text>Selecciona un valor en el campo "Resuelto Por" para mostrar el departamento.</Text>
          </SectionMessage>
        );
      }

      if (!departamento) {
        return (
          <SectionMessage title="Departamento no encontrado" appearance="warning">
            <Text>
              No se encontró un departamento para "{resueltoPor}" en el cliente "{cliente}".
            </Text>
          </SectionMessage>
        );
      }

      return <Text>{departamento}</Text>;
    }}
  </CustomField>
);

/**
 * View implementation for the department field. It mirrors the behaviour of the edit view but
 * only renders the resolved department without exposing any interactive controls.
 */
export const dptoResueltoPorView = render(
  <CustomField>
    {() => {
      const { platformContext } = useProductContext();
      const [displayValue, setDisplayValue] = useState('');
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState('');

      useEffect(() => {
        const loadViewData = async () => {
          setLoading(true);
          setError('');
          try {
            const issueKey = platformContext?.issueKey || '';
            const clienteValue = await readClienteFromIssue(issueKey);
            const resueltoPorValue = await readResueltoPorFromIssue(issueKey);
            if (clienteValue && resueltoPorValue) {
              const allUsers = await fetchUsersFromResolver();
              const departamentoValue = lookupDepartamento(
                allUsers || [],
                clienteValue,
                resueltoPorValue
              );
              setDisplayValue(departamentoValue || '');
            } else {
              setDisplayValue('');
            }
          } catch (err) {
            setError('No fue posible cargar el departamento');
          } finally {
            setLoading(false);
          }
        };

        loadViewData();
      }, [platformContext?.issueKey]);

      if (loading) {
        return <Spinner />;
      }

      if (error) {
        return (
          <SectionMessage title="Error" appearance="error">
            <Text>{error}</Text>
          </SectionMessage>
        );
      }

      return <Text>{displayValue || 'Sin departamento'}</Text>;
    }}
  </CustomField>
);
