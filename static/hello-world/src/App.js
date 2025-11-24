import React, { useEffect, useState } from 'react';
import { view } from '@forge/bridge';
import AdminPage from './AdminPage';
import CustomFieldUser from './CustomFieldUser';

function App() {
  const [context, setContext] = useState(null);

  useEffect(() => {
    view.getContext().then(setContext);
  }, []);

  if (!context) return <div>Cargando...</div>;

  if (context.moduleKey === 'usuarios-admin-page') {
    return <AdminPage />;
  }

  if (context.moduleKey === 'usuario-registrado-field') {
    return <CustomFieldUser />;
  }

  return <div>Módulo desconocido</div>;
}

export default App;