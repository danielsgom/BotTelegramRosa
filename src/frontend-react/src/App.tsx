import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import BatchesPage from './pages/BatchesPage'
import ManualMessagesPage from './pages/ManualMessagesPage'
import StripeLinksPage from './pages/StripeLinksPage'
import UsersPage from './pages/UsersPage'
import SchedulerPage from './pages/SchedulerPage'
import LogsPage from './pages/LogsPage'
import VipConfigPage from './pages/VipConfigPage'
import SettingsPage from './pages/SettingsPage'
import QuickMessagesPage from './pages/QuickMessagesPage'

const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/lotes" replace /> },
      { path: 'lotes',           element: <BatchesPage /> },
      { path: 'mensajes',        element: <ManualMessagesPage /> },
      { path: 'links',           element: <StripeLinksPage /> },
      { path: 'usuarios',        element: <UsersPage /> },
      { path: 'scheduler',       element: <SchedulerPage /> },
      { path: 'logs',            element: <LogsPage /> },
      { path: 'vip',             element: <VipConfigPage /> },
      { path: 'configuracion',   element: <SettingsPage /> },
      { path: 'quick-messages',  element: <QuickMessagesPage /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
