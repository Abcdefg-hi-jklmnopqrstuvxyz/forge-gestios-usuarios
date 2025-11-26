import React, { useEffect, useState } from 'react';
import { invoke, view } from '@forge/bridge';

const CLIENTS = [
  "Dirección General de Rentas",
  "Municipalidad de Salta",
  "Municipalidad del Interior",
  "Gob Tech"
];

const TYPES = ["Nota", "Requerimiento"];

const CustomFieldUser = () => {
  const [users, setUsers] = useState([]);
  const [tipo, setTipo] = useState(TYPES[0]);
  const [cliente, setCliente] = useState(CLIENTS[0]);
  const [selectedUserObj, setSelectedUserObj] = useState(null);

  useEffect(() => {
    invoke('getUsers').then(setUsers);
  }, []);

  useEffect(() => {
    // get existing value (if editing)
    view.getContext().then((ctx) => {
      const fieldValue = ctx.extension.fieldValue;
      if (fieldValue && typeof fieldValue === 'object') {
        setSelectedUserObj(fieldValue);
        // prefill tipo/cliente if available
        if (fieldValue.tipo) setTipo(fieldValue.tipo);
        if (fieldValue.cliente) setCliente(fieldValue.cliente);
      }
    });
  }, []);

  // filter users by selected cliente and tipo
  const filtered = users.filter(u => u.cliente === cliente && u.tipo === tipo);

  const handleUserChange = (e) => {
    const username = e.target.value;
    const userObj = filtered.find(u => u.usuario === username);
    if (userObj) {
      setSelectedUserObj(userObj);
      // submit the whole object to be stored (Option B)
      view.submit(userObj);
    } else {
      // clear
      setSelectedUserObj(null);
      view.submit(null);
    }
  };

  // If cliente/tipo changes we clear selection
  const handleTipoChange = (val) => {
    setTipo(val);
    setSelectedUserObj(null);
    view.submit(null);
  };

  const handleClienteChange = (val) => {
    setCliente(val);
    setSelectedUserObj(null);
    view.submit(null);
  };

  return (
    <div className="cf-container">
      <div style={{marginBottom: '8px'}}>
        <label className="label">Tipo de solicitud</label>
        <select className="cf-select" value={tipo} onChange={e => handleTipoChange(e.target.value)}>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div style={{marginBottom: '8px'}}>
        <label className="label">Cliente</label>
        <select className="cf-select" value={cliente} onChange={e => handleClienteChange(e.target.value)}>
          {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div style={{marginBottom: '8px'}}>
        <label className="label">Usuario</label>
        <select className="cf-select" value={selectedUserObj?.usuario || ''} onChange={handleUserChange}>
          <option value="">-- Seleccionar usuario --</option>
          {filtered.map(u => (
            <option key={`${u.tipo}-${u.cliente}-${u.usuario}`} value={u.usuario}>
              {u.usuario} {u.departamento ? `(${u.departamento})` : ''} {u.telefono ? `- ${u.telefono}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Teléfono</label>
        <input className="cf-input-readonly" type="text" readOnly value={selectedUserObj?.telefono || ''} />
      </div>

      <div>
        <label className="label">Departamento</label>
        <input className="cf-input-readonly" type="text" readOnly value={selectedUserObj?.departamento || ''} />
      </div>
    </div>
  );
};

export default CustomFieldUser;
