import React, { useEffect, useState } from 'react';
import { invoke, view } from '@forge/bridge';

const CustomFieldDptoResuelto = () => {
  const [departamento, setDepartamento] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {

    // ===== 1) CARGA INICIAL =====
    const initialize = async () => {
      try {
        const context = await view.getContext();
        const issueKey = context.extension.issue.key;

        const resueltoPorData = await invoke('getResueltoPorField', { issueKey });

        if (resueltoPorData?.departamento) {
          setDepartamento(resueltoPorData.departamento);
        } else {
          setDepartamento('');
        }
      } catch (err) {
        console.error("Error inicializando Dpto Resuelto:", err);
      }

      setLoading(false);
    };

    initialize();

    // ===== 2) ESCUCHAR CAMBIOS DEL CAMPO "Resuelto Por" =====
    view.onSubmit((submittedValue) => {
      console.log("Evento recibido de Resuelto Por:", submittedValue);

      if (submittedValue?.departamento) {
        setDepartamento(submittedValue.departamento);
        // Guardar automáticamente en Jira
        view.submit(submittedValue.departamento);
      } else {
        setDepartamento('');
        view.submit(null);
      }
    });

  }, []);

  if (loading) {
    return <div className="cf-container">Cargando...</div>;
  }

  return (
    <div className="cf-container">
      <div>
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
            width: '100%'
          }}
        />
      </div>

      {!departamento && (
        <p style={{
          color: '#666',
          fontSize: '12px',
          marginTop: '4px',
          fontStyle: 'italic'
        }}>
          Selecciona un usuario en "Resuelto Por".
        </p>
      )}
    </div>
  );
};

export default CustomFieldDptoResuelto;
