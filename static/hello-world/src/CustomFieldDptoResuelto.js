import React, { useEffect, useState } from 'react';
import { invoke, view } from '@forge/bridge';

const CustomFieldDptoResuelto = () => {
  const [departamento, setDepartamento] = useState('');
  const [loading, setLoading] = useState(true);

  // Función reutilizable para cargar el departamento desde Jira
  const loadDepartamento = async () => {
    try {
      const context = await view.getContext();
      const issueKey = context.extension.issue.key;

      const data = await invoke("getResueltoPorField", { issueKey });

      if (data?.departamento) {
        setDepartamento(data.departamento);
      } else {
        setDepartamento('');
      }
    } catch (err) {
      console.error("Error obteniendo departamento:", err);
      setDepartamento('');
    }
  };

  useEffect(() => {
    const init = async () => {
      await loadDepartamento();
      setLoading(false);
    };

    init();

    // 2️⃣ Escuchar cuando el campo Resuelto Por LLAME a submit()
    view.onSubmit(async () => {
      console.log("⚡ Cambio detectado en Resuelto Por");
      await loadDepartamento();   // recargar desde Jira
    });

  }, []);

  if (loading) {
    return <div className="cf-container">Cargando...</div>;
  }

  return (
    <div className="cf-container">
      <input
        className="cf-input-readonly"
        type="text"
        readOnly
        value={departamento}
        placeholder="Se llenará automáticamente"
        style={{
          backgroundColor: '#f4f5f7',
          cursor: 'not-allowed',
          border: '1px solid #dfe1e6',
          padding: '8px',
          borderRadius: '3px',
          width: '100%',
        }}
      />

      {!departamento && (
        <p style={{
          color: '#666',
          fontSize: '12px',
          marginTop: '4px',
          fontStyle: 'italic'
        }}>
          Selecciona un usuario en “Resuelto Por”.
        </p>
      )}
    </div>
  );
};

export default CustomFieldDptoResuelto;
