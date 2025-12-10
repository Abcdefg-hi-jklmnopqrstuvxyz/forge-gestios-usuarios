import React, { useEffect, useState } from 'react';
import { invoke, view } from '@forge/bridge';

const CustomFieldResuelto = () => {
  const [users, setUsers] = useState([]);
  const [clienteValue, setClienteValue] = useState('');  
  const [selectedUserObj, setSelectedUserObj] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initialize = async () => {
      try {
        // Obtener el contexto del issue
        const context = await view.getContext();
        const issueKey = context.extension.issue.key;

        const clienteField = await invoke("getClienteField", { issueKey });
        console.log("Cliente desde Jira:", clienteField);

        if (clienteField) {
          setClienteValue(clienteField);
        }

        // Cargar todos los usuarios almacenados
        const allUsers = await invoke('getUsers');
        setUsers(allUsers);

        // Recuperar el valor ya guardado (si existe)
        const fieldValue = context.extension.fieldValue;
        if (fieldValue && typeof fieldValue === 'object') {
          setSelectedUserObj(fieldValue);
        }

        setLoading(false);

      } catch (error) {
        console.error('Error al inicializar:', error);
        setLoading(false);
      }
    };

    initialize();
  }, []);

  // 👉 Filtrar por cliente tomado del issue + solo tipo "Requerimiento"
  const filteredUsers = users.filter(u =>
    u.cliente?.toLowerCase().trim() === clienteValue?.toLowerCase().trim() &&
    u.tipo === 'Requerimientos'
  );

  const handleUserChange = (e) => {
    const username = e.target.value;
    
    if (!username) {
      setSelectedUserObj(null);
      view.submit(null);
      return;
    }

    const userObj = filteredUsers.find(u => u.usuario === username);
    
    if (userObj) {
      setSelectedUserObj(userObj);
      view.submit(userObj); 
    } else {
      setSelectedUserObj(null);
      view.submit(null);
    }
  };

  if (loading) {
    return <div className="cf-container">Cargando...</div>;
  }

  if (!clienteValue) {
    return (
      <div className="cf-container">
        <p style={{ color: '#666', fontSize: '14px' }}>
          Primero debes seleccionar un valor en el campo "Cliente".
        </p>
      </div>
    );
  }

  return (
    <div className="cf-container">
      <div style={{ marginBottom: '8px' }}>
        <label className="label">Resuelto Por</label>
        <select 
          className="cf-select" 
          value={selectedUserObj?.usuario || ''} 
          onChange={handleUserChange}
        >
          <option value="">-- Seleccionar usuario --</option>
          {filteredUsers.map(u => (
            <option key={`${u.cliente}-${u.usuario}`} value={u.usuario}>
              {u.usuario} {u.departamento ? `(${u.departamento})` : ''}
            </option>
          ))}
        </select>
      </div>

      {filteredUsers.length === 0 && (
        <p style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
          No hay usuarios registrados para el cliente: {clienteValue}
        </p>
      )}
    </div>
  );
};

export default CustomFieldResuelto;
