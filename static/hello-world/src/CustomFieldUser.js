import React, { useEffect, useState } from 'react';
import { invoke, view } from '@forge/bridge';

const CustomFieldUser = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  
  useEffect(() => {
    invoke('getUsers').then(setUsers);
  }, []);

  useEffect(() => {
    view.getContext().then((ctx) => {
        const fieldValue = ctx.extension.fieldValue;
        if (fieldValue) {
            setSelectedUser(fieldValue);
        }
    });
  }, []);

  const handleChange = (e) => {
    const userName = e.target.value;
    const userObj = users.find(u => u.name === userName);
    
    if (userObj) {
      setSelectedUser(userObj);
      view.submit(userObj); 
    }
  };

  return (
    <div className="cf-container">
      <div>
        <label className="label">
          Cliente
        </label>
        <select 
          className="cf-select"
          value={selectedUser?.name || ''}
          onChange={handleChange}
        >
          <option value="">-- Seleccionar cliente --</option>
          {users.map(u => (
             <option key={u.name} value={u.name}>{u.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">
          Teléfono
        </label>
        <input 
            className="cf-input-readonly"
            type="text" 
            readOnly 
            value={selectedUser?.phone || ''}
        />
      </div>
    </div>
  );
};

export default CustomFieldUser;