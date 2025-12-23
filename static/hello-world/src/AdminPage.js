import React, { useState, useEffect, useMemo } from 'react';
import { invoke } from '@forge/bridge';
import * as XLSX from 'xlsx';

const CLIENTS = [
  "Dir. Gral. Rentas Salta",
  "Municipalidad de Salta",
  "Municipios del Interior",
  "Gob Tech"
];

const TYPES = ["Nota", "Requerimientos"];
const USER_KIND = ["Cliente", "Interno"]; // <<--- NUEVO

function AdminPage() {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [tipo, setTipo] = useState(TYPES[0]);
  const [cliente, setCliente] = useState(CLIENTS[0]);
  const [tipoUsuario, setTipoUsuario] = useState(USER_KIND[0]); // <<--- NUEVO
  const [usuario, setUsuario] = useState('');
  const [telefono, setTelefono] = useState('');
  const [departamento, setDepartamento] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [editTipo, setEditTipo] = useState('');
  const [editCliente, setEditCliente] = useState('');
  const [editTipoUsuario, setEditTipoUsuario] = useState(USER_KIND[0]); // <<--- NUEVO
  const [editUsuario, setEditUsuario] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editDepartamento, setEditDepartamento] = useState('');

  const [status, setStatus] = useState('');

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    const data = await invoke('getUsers');
    setUsers(data || []);
  };

  const handleManualSave = async () => {
    if (!usuario || !telefono) return alert('Usuario y teléfono requeridos');
    
    setStatus('Guardando...');
    await invoke('saveUser', {
      tipo,
      cliente,
      tipoUsuario, // <<--- NUEVO
      usuario,
      telefono,
      departamento
    });

    // limpiar
    setUsuario('');
    setTelefono('');
    setDepartamento('');
    setTipoUsuario(USER_KIND[0]); // reset
    setStatus('Registro guardado correctamente.');
    
    loadUsers();
    setTimeout(() => setStatus(''), 3000);
  };

  // ===========================
  //   IMPORTACIÓN MASIVA
  // ===========================

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { defval: '' });

      const cleanData = data.map(row => ({
        tipo: row.Tipo || row.tipo || 'Nota',
        cliente: row.Cliente || row.cliente || CLIENTS[0],
        tipoUsuario: row.TipoUsuario || row.tipoUsuario || USER_KIND[0], // <<--- NUEVO
        usuario: row.Usuario || row.USUARIO_INCIDENTE || row.Nombre || '',
        telefono: String(row.Telefono || row.phone || ''),
        departamento: row.Departamento || ''
      }))
      .filter(r => r.usuario);

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

  // ===========================
  //   ELIMINAR
  // ===========================

  const handleDelete = async (u) => {
    if (window.confirm(`¿Está seguro de eliminar a ${u.usuario} (${u.cliente} - ${u.tipo})?`)) {
      await invoke('deleteUser', { tipo: u.tipo, cliente: u.cliente, usuario: u.usuario });
      loadUsers();
    }
  };

  // ===========================
  //   EDITAR - ABRIR MODAL
  // ===========================

  const openEditModal = (user) => {
    setEditingUser(user);
    setEditTipo(user.tipo);
    setEditCliente(user.cliente);
    setEditTipoUsuario(user.tipoUsuario || USER_KIND[0]); // <<--- NUEVO
    setEditUsuario(user.usuario);
    setEditTelefono(user.telefono);
    setEditDepartamento(user.departamento);
    setIsModalOpen(true);
  };

  const handleUpdate = async () => {
    if (!editUsuario || !editTelefono) return alert('Datos incompletos');

    await invoke('updateUser', {
      originalTipo: editingUser.tipo,
      originalCliente: editingUser.cliente,
      originalUsuario: editingUser.usuario,
      tipo: editTipo,
      cliente: editCliente,
      tipoUsuario: editTipoUsuario, // <<--- NUEVO
      usuario: editUsuario,
      telefono: editTelefono,
      departamento: editDepartamento
    });

    setIsModalOpen(false);
    setEditingUser(null);
    loadUsers();
  };

  // ============================
  // EXPORTAR EXCEL
  // ============================

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(users);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes");

    XLSX.writeFile(workbook, "clientes_registrados.xlsx");
  };

  // ============================
  // BUSCADOR
  // ============================

  const filteredUsers = useMemo(() => {
  return users.filter(u =>
    (u.usuario || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.telefono || '').includes(searchTerm) ||
    (u.cliente || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.tipoUsuario || '').toLowerCase().includes(searchTerm.toLowerCase())
  );
}, [users, searchTerm]);

  // ============================
  // RENDER
  // ============================

  return (
    <div className="admin-container">
      <h2 className="header">Gestión de clientes</h2>

      <div className="section">
        <h3 className="section-title">Registrar nuevo registro</h3>

        <div className="form-row">
          <div className="form-group">
            <label className="label">Tipo de solicitud</label>
            <select className="input" value={tipo} onChange={e => setTipo(e.target.value)}>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="label">Cliente</label>
            <select className="input" value={cliente} onChange={e => setCliente(e.target.value)}>
              {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="label">Tipo Usuario</label>
            <select className="input" value={tipoUsuario} onChange={e => setTipoUsuario(e.target.value)}>
              {USER_KIND.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="label">Usuario</label>
            <input className="input" value={usuario} onChange={e => setUsuario(e.target.value)} placeholder="Ej. Juan Pérez" />
          </div>
          <div className="form-group">
            <label className="label">Teléfono</label>
            <input className="input" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="+1..." />
          </div>
          <div className="form-group">
            <label className="label">Departamento</label>
            <input className="input" value={departamento} onChange={e => setDepartamento(e.target.value)} placeholder="Departamento A" />
          </div>
        </div>

        <button className="btn btn-primary" onClick={handleManualSave}>Guardar registro</button>
        {status && <div className="status-msg">{status}</div>}
      </div>

      <div className="section">
        <h3 className="section-title">Importar masivamente</h3>
        <label className="label">Archivo Excel (con columna opcional TipoUsuario)</label>
        <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} style={{marginTop: '5px'}} />
      </div>

      <div className="section">
        <h3 className="section-title">Directorio de clientes</h3>

        <button 
          className="cf-button" 
          onClick={exportToExcel} 
          style={{ marginTop: '15px', marginBottom: '20px' }}
        >
          Exportar Excel
        </button>

        <input
          className="input"
          placeholder="Buscar por usuario, teléfono o cliente..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{marginBottom: '10px'}}
        />

        <table className="table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Cliente</th>
              <th>Tipo Usuario</th>
              <th>Usuario</th>
              <th>Teléfono</th>
              <th>Departamento</th>
              <th width="170">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length > 0 ? filteredUsers.map((u, i) => (
              <tr key={`${u.tipo}-${u.cliente}-${u.usuario}-${i}`}>
                <td>{u.tipo}</td>
                <td>{u.cliente}</td>
                <td>{u.tipoUsuario}</td>
                <td>{u.usuario}</td>
                <td>{u.telefono}</td>
                <td>{u.departamento}</td>
                <td>
                  <button className="btn btn-secondary" onClick={() => openEditModal(u)}>Editar</button>
                  <button className="btn btn-danger" onClick={() => handleDelete(u)}>Eliminar</button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="7" style={{padding: '20px', textAlign: 'center', color: '#6B778C'}}>No se encontraron registros</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ============================
          MODAL DE EDICIÓN
      ============================ */}

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="section-title">Editar registro</h3>

            <div style={{marginBottom: '10px'}}>
              <label className="label">Tipo</label>
              <select className="input" value={editTipo} onChange={e => setEditTipo(e.target.value)}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div style={{marginBottom: '10px'}}>
              <label className="label">Cliente</label>
              <select className="input" value={editCliente} onChange={e => setEditCliente(e.target.value)}>
                {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div style={{marginBottom: '10px'}}>
              <label className="label">Tipo Usuario</label>
              <select className="input" value={editTipoUsuario} onChange={e => setEditTipoUsuario(e.target.value)}>
                {USER_KIND.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div style={{marginBottom: '10px'}}>
              <label className="label">Usuario</label>
              <input className="input" value={editUsuario} onChange={e => setEditUsuario(e.target.value)} />
            </div>

            <div style={{marginBottom: '10px'}}>
              <label className="label">Teléfono</label>
              <input className="input" value={editTelefono} onChange={e => setEditTelefono(e.target.value)} />
            </div>

            <div style={{marginBottom: '10px'}}>
              <label className="label">Departamento</label>
              <input className="input" value={editDepartamento} onChange={e => setEditDepartamento(e.target.value)} />
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
