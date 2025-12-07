import React, { useEffect, useState } from 'react';
import { view } from '@forge/bridge';

import AdminPage from './AdminPage';
import CustomFieldUser from './CustomFieldUser';
import CustomFieldResuelto from './CustomFieldResuelto';
import CustomFieldDptoResuelto from './CustomFieldDptoResuelto';

function App() {
  const [context, setContext] = useState(null);

  useEffect(() => {
    view.getContext().then(setContext);
  }, []);

  if (!context) return <div>Cargando...</div>;

  // Página administrativa
  if (context.moduleKey === 'usuarios-admin-page') {
    return <AdminPage />;
  }

  // Campo: Cliente asignado
  if (context.moduleKey === 'usuario-registrado-field') {
    return <CustomFieldUser />;
  }

  // Campo: Resuelto Por
  if (context.moduleKey === 'resuelto-por-field') {
    return <CustomFieldResuelto />;
  }

  // Campo: Dpto Resuelto Por
  if (context.moduleKey === 'dpto-resuelto-field') {
    return <CustomFieldDptoResuelto />;
  }

  return <div>Módulo desconocido</div>;
}

export default App;
