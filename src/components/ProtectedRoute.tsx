import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      color: 'white',
      fontSize: '1.2rem',
      fontWeight: '500'
    }}>
      <div style={{
        padding: '20px',
        background: 'rgba(255, 255, 255, 0.2)',
        backdropFilter: 'blur(8px)',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        로딩 중...
      </div>
    </div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // If user has no organization and is not on the setup page, redirect to setup
  // Note: We check profile.organization_id
  if (!profile?.organization_id && location.pathname !== '/org-setup') {
    return <Navigate to="/org-setup" replace />
  }

  // If user has organization but tries to access setup page, redirect to dashboard (optional, but good UX)
  // But we want to allow them to create/join more orgs, so maybe allow it?
  // User requirement: "여러 조직도 만들거나 가입 가능하게 만들어줘"
  // So we should allow access to /org-setup even if they have an org.
  
  return <>{children}</>
}
