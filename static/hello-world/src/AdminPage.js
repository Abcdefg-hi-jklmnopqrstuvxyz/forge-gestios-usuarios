import React, { useState, useEffect, useMemo } from 'react';
import { invoke } from '@forge/bridge';
import * as XLSX from 'xlsx';

function AdminPage() {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null); 
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const [status, setStatus] = useState('');

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    const data = await invoke('getUsers');
    setUsers(data || []);
  };

  const handleManualSave = async () => {
    if (!newName || !newPhone) return alert('Nombre y teléfono requeridos');
    setStatus('Guardando...');
    await invoke('saveUser', { name: newName, phone: newPhone });
    setNewName('');
    setNewPhone('');
    setStatus('Cliente guardado correctamente.');
    loadUsers();
    setTimeout(() => setStatus(''), 3000);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      const cleanData = data.map(row => ({
        name: row.USUARIO_INCIDENTE || row.Nombre || 'Sin Nombre',
        phone: String(row.TELEFONO || row.Telefono || '')
      })).filter(u => u.name !== 'Sin Nombre');

      saveBulk(cleanData);
    };
    reader.readAsBinaryString(file);
  };

  const saveBulk = async (newUsers) => {
    setStatus('Importando...');
    await invoke('bulkSaveUsers', { newUsers });
    setStatus(`Importación exitosa: ${newUsers.length} registros procesados.`);
    loadUsers();
    setTimeout(() => setStatus(''), 4000);
  };

  const handleDelete = async (name) => {
    if (window.confirm(`¿Está seguro de eliminar a ${name}?`)) {
      await invoke('deleteUser', { name });
      loadUsers();
    }
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditPhone(user.phone);
    setIsModalOpen(true);
  };

  const handleUpdate = async () => {
    if (!editName || !editPhone) return alert('Datos incompletos');
    await invoke('updateUser', {
      originalName: editingUser.name,
      newName: editName,
      newPhone: editPhone
    });
    setIsModalOpen(false);
    setEditingUser(null);
    loadUsers();
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.phone.includes(searchTerm)
    );
  }, [users, searchTerm]);

  return (
    <div className="admin-container">
      <h2 className="header">Gestión de clientes</h2>

      <div className="section">
        <h3 className="section-title">Registrar nuevo cliente</h3>
        <div className="form-row">
          <div className="form-group">
            <label className="label">Nombre del cliente</label>
            <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej. Juan Pérez" />
          </div>
          <div className="form-group">
            <label className="label">Teléfono</label>
            <input className="input" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="+52..." />
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleManualSave}>Guardar cliente</button>
        {status && <div className="status-msg">{status}</div>}
      </div>

      <div className="section">
        <h3 className="section-title">Importar masivamente</h3>
        <label className="label">Archivo Excel (Columnas: USUARIO_INCIDENTE, TELEFONO)</label>
        <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} style={{marginTop: '5px'}} />
      </div>

      <div className="section">
        <h3 className="section-title">Directorio de clientes</h3>
        <input 
          className="input"
          placeholder="Buscar por nombre o teléfono..." 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
          style={{marginBottom: '10px'}}
        />
        
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Teléfono</th>
              <th width="150">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length > 0 ? filteredUsers.map((u, i) => (
              <tr key={i}>
                <td>{u.name}</td>
                <td>{u.phone}</td>
                <td>
                  <button className="btn btn-secondary" onClick={() => openEditModal(u)}>Editar</button>
                  <button className="btn btn-danger" onClick={() => handleDelete(u.name)}>Eliminar</button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="3" style={{padding: '20px', textAlign: 'center', color: '#6B778C'}}>No se encontraron clientes</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="section-title">Editar cliente</h3>
            <div style={{marginBottom: '10px'}}>
                <label className="label">Nombre</label>
                <input className="input" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div>
                <label className="label">Teléfono</label>
                <input className="input" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleUpdate}>Guardar cambios</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;