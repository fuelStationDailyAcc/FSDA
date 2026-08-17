import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute, { PermissionRoute } from './components/ProtectedRoute'
import AppShell from './components/AppShell'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import AccountHistoryPage from './pages/AccountHistoryPage'
import DailyAccountsPage from './pages/DailyAccountsPage'
import HeroPage from './pages/HeroPage'
import PartiesPage from './pages/PartiesPage'
import SettingsPage from './pages/SettingsPage'
import StaffPage from './pages/StaffPage'

function AppRouter() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
          <Route path="/" element={<HeroPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route
              path="/accounts"
              element={
                <PermissionRoute permission="accounts.read">
                  <DailyAccountsPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/history"
              element={
                <PermissionRoute permission="accounts.read">
                  <AccountHistoryPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/ledger"
              element={
                <PermissionRoute permission="ledger.read">
                  <PartiesPage />
                </PermissionRoute>
              }
            />
            <Route path="/parties" element={<Navigate to="/ledger" replace />} />
            <Route
              path="/settings"
              element={
                <PermissionRoute permission="settings.read">
                  <SettingsPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/staff"
              element={
                <PermissionRoute ownerOnly>
                  <StaffPage />
                </PermissionRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default AppRouter
