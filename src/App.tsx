import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { UIProvider } from './contexts/UIContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Drive from './pages/Drive'
import Board from './pages/Board'
import Tasks from './pages/Tasks'
import Calendar from './pages/Calendar'
import AddressBook from './pages/AddressBook'
import Signup from './pages/Signup'
import Approvals from './pages/Approvals'
import Messenger from './pages/Messenger'
import Settings from './pages/Settings'
import Admin from './pages/Admin'
import OrgSetup from './pages/OrgSetup'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import './App.css'

function RedirectToDashboard() {
  const location = useLocation()
  return <Navigate to={`/dashboard${location.search}`} replace />
}

function App() {
  return (
    <AuthProvider>
      <UIProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/org-setup"
              element={
                <ProtectedRoute>
                  <OrgSetup />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/drive"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Drive />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/drive/:folderId"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Drive />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/board"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Board />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Tasks />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Calendar />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/address-book"
              element={
                <ProtectedRoute>
                  <Layout>
                    <AddressBook />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/approvals"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Approvals />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/messenger"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Messenger />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Settings />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Admin />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<RedirectToDashboard />} />
          </Routes>
        </BrowserRouter>
      </UIProvider>
    </AuthProvider>
  )
}

export default App
