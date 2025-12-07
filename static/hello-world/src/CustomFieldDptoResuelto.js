import React, { useEffect, useState } from 'react';
import { invoke, view } from '@forge/bridge';

const CustomFieldDptoResuelto = () => {
  const [departamento, setDepartamento] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initialize = async () => {
      try {
        const context = await view.getContext();
        const issueKey = context.extension.issue.key;
        
        // Obtener el valor del campo "Resuelto Por" desde el backend
        const resueltoPorData = await invoke('getResueltoPorField', { issueKey });
        
        if (resueltoPorData && resueltoPorData.departamento) {
          setDepartamento(resueltoPorData.departamento);
        } else {
          setDepartamento('');
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error al inicializar Dpto Resuelto Por:', error);
        setDepartamento('');
        setLoading(false);
      }
    };

    initialize();
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
            width: '100%',
            boxSizing: 'border-box'
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
          Selecciona un usuario en "Resuelto Por" para ver el departamento
        </p>
      )}
    </div>
  );
};

export default CustomFieldDptoResuelto;