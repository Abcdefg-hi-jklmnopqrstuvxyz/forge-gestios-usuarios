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
        const context = await view.getContext();
        const issueKey = context.extension.issue.key;

        // Obtener cliente del issue
        const clienteField = await invoke("getClienteField", { issueKey });
        if (clienteField) setClienteValue(clienteField);

        // Cargar usuarios del storage
        const allUsers = await invoke('getUsers');
        setUsers(allUsers);

        // Cargar el valor ya guardado
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

  useEffect(() => {
  console.log("USERS:", users);
  console.log("CLIENTE VALOR:", clienteValue);
}, [users, clienteValue]);

  // ================================
  // 💥 FILTRO MODIFICADO AQUÍ
  // ================================
  const filteredUsers = users.filter(u =>
    u.tipoUsuario === "Interno" &&
    u.tipo === "Requerimientos"
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
          No hay usuarios internos registrados.
        </p>
      )}
    </div>
  );
};

export default CustomFieldResuelto;

