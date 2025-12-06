import { render, Select, Option, Text, Stack, Spinner, useEffect, useState, useProductContext } from '@forge/react';
import api, { route } from '@forge/api';
import { fetchAllUsersFromResolver } from './index';

// Constantes de nombre para ubicar los campos relacionados.
const CLIENT_FIELD_ID = 'customfield_10121';
const RESUELTO_POR_FIELD_NAME = 'Resuelto Por';

// Obtiene el valor del campo "Cliente" desde el issue usando asApp (requerido por el usuario).
async function fetchCliente(issueKey) {
  const response = await api.asApp().requestJira(
    route`/rest/api/3/issue/${issueKey}?fields=${CLIENT_FIELD_ID}`
  );

  if (!response.ok) {
    console.error('No se pudo leer el campo Cliente', response.status, await response.text());
    return '';
  }

  const body = await response.json();
  return body?.fields?.[CLIENT_FIELD_ID] || '';
}

// Obtiene el ID real del campo "Resuelto Por" buscando por nombre en el catálogo de campos.
let cachedResueltoPorId = '';
async function getResueltoPorFieldId() {
  if (cachedResueltoPorId) {
    return cachedResueltoPorId;
  }

  const response = await api.asApp().requestJira(route`/rest/api/3/field`);
  if (!response.ok) {
    console.error('No se pudo consultar la lista de campos', response.status, await response.text());
    return '';
  }

  const fields = await response.json();
  const match = fields.find((field) => field.name === RESUELTO_POR_FIELD_NAME);
  cachedResueltoPorId = match?.id || '';
  return cachedResueltoPorId;
}

// Lee el valor del campo "Resuelto Por" almacenado actualmente en el issue.
async function fetchResueltoPorValue(issueKey) {
  const fieldId = await getResueltoPorFieldId();
  if (!fieldId) {
    return '';
  }

  const response = await api.asApp().requestJira(
    route`/rest/api/3/issue/${issueKey}?fields=${fieldId}`
  );

  if (!response.ok) {
    console.error('No se pudo leer el campo Resuelto Por', response.status, await response.text());
    return '';
  }

  const body = await response.json();
  return body?.fields?.[fieldId] || '';
}

// Filtra los usuarios por cliente y tipo "Requerimiento".
async function fetchUsersForCliente(cliente) {
  const users = await fetchAllUsersFromResolver();
  return users.filter(
    (record) => record.tipo === 'Requerimiento' && record.cliente === cliente
  );
}

// ===== Campo "Resuelto Por" =====
export const resolvedByEdit = render((props) => {
  const [cliente, setCliente] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const context = useProductContext();

  const issueKey = context?.platformContext?.issueKey || '';

  useEffect(() => {
    const loadOptions = async () => {
      setLoading(true);
      setErrorMessage('');
      try {
        const clienteValue = await fetchCliente(issueKey);
        setCliente(clienteValue);

        const filteredUsers = await fetchUsersForCliente(clienteValue);
        const selectOptions = filteredUsers.map((record) => ({
          label: record.usuario,
          value: record.usuario
        }));
        setOptions(selectOptions);

        // Si el valor actual no está en la lista (o está vacío), seleccionamos la primera opción disponible.
        if (!props.value && selectOptions.length > 0) {
          props.onChange(selectOptions[0].value);
        } else if (
          props.value &&
          !selectOptions.some((entry) => entry.value === props.value) &&
          selectOptions.length > 0
        ) {
          props.onChange(selectOptions[0].value);
        }
      } catch (error) {
        console.error('Error cargando opciones de usuarios', error);
        setErrorMessage('No se pudieron cargar usuarios desde storage.');
      } finally {
        setLoading(false);
      }
    };

    if (issueKey) {
      loadOptions();
    }
  }, [issueKey, props]);

  if (loading) {
    return (
      <Stack>
        <Spinner />
        <Text>Buscando usuarios para el cliente…</Text>
      </Stack>
    );
  }

  if (errorMessage) {
    return <Text>{errorMessage}</Text>;
  }

  if (!cliente) {
    return <Text>Primero completa el campo Cliente para obtener opciones.</Text>;
  }

  if (options.length === 0) {
    return <Text>No hay usuarios de Requerimiento cargados para {cliente}.</Text>;
  }

  return (
    <Select
      label={`Resuelto Por (${cliente})`}
      onChange={(value) => props.onChange(value)}
      value={props.value || ''}
    >
      {options.map((option) => (
        <Option key={option.value} label={option.label} value={option.value} />
      ))}
    </Select>
  );
});

export const resolvedByView = render((props) => {
  const selected = props.value || 'Sin usuario seleccionado';
  return <Text>{selected}</Text>;
});

// ===== Campo "Dpto Resuelto Por" =====
export const resolvedDepartmentEdit = render((props) => {
  const [departamento, setDepartamento] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const context = useProductContext();

  const issueKey = context?.platformContext?.issueKey || '';

  useEffect(() => {
    const loadDepartment = async () => {
      setLoading(true);
      setMessage('');
      try {
        const selectedUser = await fetchResueltoPorValue(issueKey);
        if (!selectedUser) {
          setMessage('Selecciona un usuario en "Resuelto Por" para ver su departamento.');
          props.onChange('');
          return;
        }

        const users = await fetchUsersForCliente(await fetchCliente(issueKey));
        const match = users.find((entry) => entry.usuario === selectedUser);

        const depto = match?.departamento || '';
        setDepartamento(depto);
        props.onChange(depto);

        if (!depto) {
          setMessage('No se encontró un departamento para el usuario seleccionado.');
        }
      } catch (error) {
        console.error('Error obteniendo departamento asociado', error);
        setMessage('No se pudo calcular el departamento.');
        props.onChange('');
      } finally {
        setLoading(false);
      }
    };

    if (issueKey) {
      loadDepartment();
    }
  }, [issueKey, props]);

  if (loading) {
    return (
      <Stack>
        <Spinner />
        <Text>Determinando el departamento…</Text>
      </Stack>
    );
  }

  if (message) {
    return <Text>{message}</Text>;
  }

  return <Text>{departamento || 'Sin departamento disponible'}</Text>;
});

export const resolvedDepartmentView = render((props) => {
  const value = props.value || 'Sin departamento disponible';
  return <Text>{value}</Text>;
});
