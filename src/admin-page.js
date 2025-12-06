import { createElement, render, Heading, Stack, Text, SectionMessage, Inline, LinkButton, useEffect, useState } from '@forge/react';
import { getAllUsers } from './users-storage';

// Página global UI Kit para reemplazar el antiguo recurso Custom UI.
// Al usar UI Kit evitamos componentes de plataforma obsoletos que Jira
// marca como "deprecated platform component". Se mantiene simple y
// totalmente en JavaScript, sin JSX, para cumplir con los requisitos
// de estilo del proyecto.
export const renderAdminPage = render(() => {
  const [userCount, setUserCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Cargamos un conteo rápido de registros para que el administrador
  // sepa que la base está accesible sin abrir otras pantallas.
  useEffect(() => {
    const loadCount = async () => {
      try {
        const users = await getAllUsers();
        setUserCount(users.length);
      } catch (err) {
        console.error('No se pudo leer usuarios desde storage', err);
        setError('No se pudo leer la base de usuarios. Verifica la instalación.');
      } finally {
        setLoading(false);
      }
    };

    loadCount();
  }, []);

  return createElement(
    Stack,
    { space: "large" },
    createElement(Heading, { size: "large" }, 'Gestión de base de datos de clientes'),
    createElement(
      SectionMessage,
      { appearance: error ? 'error' : 'information' },
      createElement(
        Text,
        null,
        error || 'Esta página confirma que la aplicación usa UI Kit y ya no depende del componente obsoleto.'
      )
    ),
    createElement(
      Text,
      null,
      loading ? 'Cargando conteo de usuarios…' : `Usuarios totales en storage: ${userCount}`
    ),
    createElement(
      Inline,
      { align: "start" },
      createElement(
        Text,
        null,
        'Los campos "Resuelto Por" y "Dpto Resuelto Por" ya leen directamente de esta base.'
      ),
      createElement(
        LinkButton,
        {
          appearance: 'primary',
          href: 'https://developer.atlassian.com/platform/forge/build-a-custom-ui-app/',
          target: '_blank'
        },
        'Documentación Forge'
      )
    )
  );
});
