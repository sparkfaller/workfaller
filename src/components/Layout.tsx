import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [orgName, setOrgName] = useState('WorkFaller')

  useEffect(() => {
    if (user) {
      fetchOrgName()
    }
  }, [user])

  const fetchOrgName = async () => {
    try {
      // 1. Get User's Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user?.id)
        .single()

      if (profile?.organization_id) {
        // 2. Get Organization Name
        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', profile.organization_id)
          .single()
        
        if (org?.name) {
          setOrgName(org.name)
        }
      }
    } catch (error) {
      console.error('Error fetching org name:', error)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const isActive = (path: string) => location.pathname.startsWith(path)

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside className="glass-panel" style={{
        width: '16.25rem',
        margin: '1.25rem',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '1.5rem',
        position: 'sticky',
        top: '1.25rem',
        height: 'calc(100vh - 2.5rem)',
        overflow: 'hidden',
        flexShrink: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.85)'
      }}>
        <div style={{ marginBottom: '1.875rem', padding: '0 0.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: '800' }}>
            <span style={{ fontSize: '1.8rem' }}>🏢</span> {orgName}
          </h1>
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto', paddingRight: '0.3125rem' }}>
          <NavItem to="/dashboard" icon="📊" label="대시보드" active={location.pathname === '/dashboard'} />
          <NavItem to="/board" icon="📝" label="게시판" active={isActive('/board')} />
          <NavItem to="/tasks" icon="✅" label="업무 관리" active={isActive('/tasks')} />
          <NavItem to="/calendar" icon="📅" label="일정 관리" active={isActive('/calendar')} />
          <NavItem to="/drive" icon="💾" label="드라이브" active={isActive('/drive')} />
          <NavItem to="/address-book" icon="👥" label="주소록" active={isActive('/address-book')} />
          <NavItem to="/approvals" icon="✍️" label="전자결재" active={isActive('/approvals')} />
          <NavItem to="/messenger" icon="💬" label="메신저" active={isActive('/messenger')} />
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '1.25rem', borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '0.75rem', backgroundColor: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '50%', backgroundColor: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
              {user?.email?.[0].toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: '600', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.user_metadata?.full_name || '사용자'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.email}
              </div>
            </div>
          </div>
          
          <Link to="/settings" style={{ textDecoration: 'none' }}>
            <button style={{ width: '100%', backgroundColor: 'transparent', color: '#4b5563', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              ⚙️ 설정
            </button>
          </Link>
          
          <Link to="/admin" style={{ textDecoration: 'none' }}>
            <button style={{ width: '100%', backgroundColor: 'transparent', color: '#4b5563', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              🔒 관리자
            </button>
          </Link>

          <button 
            onClick={handleSignOut}
            style={{ 
              width: '100%', 
              backgroundColor: '#ef4444', 
              color: 'white',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '0.5rem',
              marginTop: '0.3125rem'
            }}
          >
            🚪 로그아웃
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '1.25rem', overflowY: 'auto', height: '100vh', boxSizing: 'border-box' }}>
        {children}
      </main>
    </div>
  )
}

function NavItem({ to, icon, label, active }: { to: string; icon: string; label: string; active: boolean }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div style={{
        padding: '0.75rem 1rem',
        borderRadius: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        backgroundColor: active ? '#4f46e5' : 'transparent',
        color: active ? 'white' : '#4b5563',
        transition: 'all 0.2s',
        fontWeight: active ? '600' : '500',
        boxShadow: active ? '0 0.25rem 0.75rem rgba(79, 70, 229, 0.3)' : 'none'
      }}>
        <span style={{ fontSize: '1.2rem' }}>{icon}</span>
        <span>{label}</span>
      </div>
    </Link>
  )
}
