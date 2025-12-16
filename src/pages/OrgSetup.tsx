import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUI } from '../contexts/UIContext'
import { useAuth } from '../contexts/AuthContext'

export default function OrgSetup() {
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()
  const { showToast } = useUI()
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [myOrgs, setMyOrgs] = useState<any[]>([])

  useEffect(() => {
    fetchMyOrgs()
  }, [user])

  const fetchMyOrgs = async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('organization_members')
      .select(`
        organization:organizations (
          id,
          name
        ),
        role
      `)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error fetching orgs:', error)
      return
    }

    if (data) {
      setMyOrgs(data.map((item: any) => ({
        id: item.organization.id,
        name: item.organization.name,
        role: item.role
      })))
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.rpc('create_organization_v2', {
        p_name: name
      })
      if (error) throw error
      
      showToast('조직이 생성되었습니다.', 'success')
      await refreshProfile() // Update context with new org
      navigate('/')
    } catch (error: any) {
      showToast('생성 실패: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.rpc('join_organization_v2', {
        p_invite_code: inviteCode
      })
      if (error) throw error

      showToast('조직에 가입되었습니다.', 'success')
      await refreshProfile() // Update context with new org
      navigate('/')
    } catch (error: any) {
      console.error('Join organization error:', error)
      showToast('가입 실패: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSwitch = async (orgId: string) => {
    try {
      const { error } = await supabase.rpc('switch_organization', {
        p_org_id: orgId
      })
      if (error) throw error
      
      showToast('조직을 전환했습니다.', 'success')
      await refreshProfile()
      navigate('/')
    } catch (error: any) {
      showToast('전환 실패: ' + error.message, 'error')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '500px',
        padding: '40px',
        borderRadius: '24px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '2rem', color: '#4f46e5', marginBottom: '10px' }}>
            {myOrgs.length > 0 ? '조직 관리' : '환영합니다!'}
          </h1>
          <p style={{ color: '#6b7280' }}>
            {myOrgs.length > 0 
              ? '접속할 조직을 선택하거나 새로 만드세요.' 
              : '시작하려면 조직을 생성하거나 가입하세요.'}
          </p>
        </div>

        {/* My Organizations List */}
        {myOrgs.length > 0 && (
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '1rem', color: '#374151', marginBottom: '15px' }}>내 조직 목록</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {myOrgs.map(org => (
                <button
                  key={org.id}
                  onClick={() => handleSwitch(org.id)}
                  className="glass-button"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '15px',
                    textAlign: 'left',
                    background: profile?.organization_id === org.id ? '#e0e7ff' : 'white'
                  }}
                >
                  <span style={{ fontWeight: 600, color: '#1f2937' }}>{org.name}</span>
                  <span style={{ fontSize: '0.8rem', color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: '10px' }}>
                    {org.role === 'owner' ? '소유자' : '멤버'}
                  </span>
                </button>
              ))}
            </div>
            <div style={{ margin: '20px 0', borderBottom: '1px solid #e5e7eb' }}></div>
          </div>
        )}

        {/* Toggle Mode */}
        <div style={{ 
          display: 'flex', 
          background: '#f3f4f6', 
          padding: '4px', 
          borderRadius: '12px',
          marginBottom: '20px'
        }}>
          <button
            onClick={() => setMode('create')}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              background: mode === 'create' ? 'white' : 'transparent',
              color: mode === 'create' ? '#4f46e5' : '#6b7280',
              fontWeight: 600,
              boxShadow: mode === 'create' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            새 조직 만들기
          </button>
          <button
            onClick={() => setMode('join')}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              background: mode === 'join' ? 'white' : 'transparent',
              color: mode === 'join' ? '#4f46e5' : '#6b7280',
              fontWeight: 600,
              boxShadow: mode === 'join' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            초대 코드로 가입
          </button>
        </div>

        {/* Forms */}
        {mode === 'create' ? (
          <form onSubmit={handleCreate}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#374151', fontSize: '0.9rem' }}>조직 이름</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="glass-input"
                placeholder="예: 워크폴러 주식회사"
                required
                style={{ width: '100%' }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="glass-button"
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                color: 'white',
                border: 'none'
              }}
            >
              {loading ? '생성 중...' : '조직 생성하기'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoin}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#374151', fontSize: '0.9rem' }}>초대 코드 (8자리)</label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="glass-input"
                placeholder="12345678"
                maxLength={8}
                required
                style={{ width: '100%' }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="glass-button"
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                color: 'white',
                border: 'none'
              }}
            >
              {loading ? '가입 중...' : '조직 가입하기'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
