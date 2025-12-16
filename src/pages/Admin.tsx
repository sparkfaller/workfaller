import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useUI } from '../contexts/UIContext'
import { useAuth } from '../contexts/AuthContext'
import type { User, Organization, Team } from '../types/database.types'

export default function Admin() {
  const { user } = useAuth()
  const { showToast, showModal } = useUI()
  
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [isOwner, setIsOwner] = useState(false)
  
  // Edit User State
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editPosition, setEditPosition] = useState('')
  const [editDepartment, setEditDepartment] = useState('')
  const [editTeamId, setEditTeamId] = useState<string>('')

  // Team Management State
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [teamName, setTeamName] = useState('')

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user])

  const fetchData = async () => {
    setLoading(true)
    try {
      // 1. Get User's Profile to find Organization ID
      // Use select('*') to avoid error if is_admin column doesn't exist yet
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single()

      if (profileError) throw profileError
      if (!profile?.organization_id) {
        // Handle case where user has no organization (shouldn't happen for admin)
        setLoading(false)
        return
      }

      // 2. Get Organization Details
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.organization_id)
        .single()

      if (orgError) throw orgError
      
      // Check if current user is the owner or admin
      const isUserOwner = org.owner_id === user?.id
      const isUserAdmin = profile.is_admin === true

      if (!isUserOwner && !isUserAdmin) {
        // Not an admin
        setOrganization(null)
        setLoading(false)
        return
      }

      setOrganization(org)
      setIsOwner(isUserOwner)

      // 3. Get Organization Users
      const { data: orgUsers, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('full_name')

      if (usersError) throw usersError
      setUsers(orgUsers || [])

      // 4. Get Organization Teams
      const { data: orgTeams, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('name')

      if (teamsError) throw teamsError
      setTeams(orgTeams || [])

    } catch (error: any) {
      console.error('Error fetching admin data:', error)
      // showToast('데이터를 불러오는데 실패했습니다.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateOrgName = async () => {
    if (!organization) return
    
    showModal({
      title: '회사 이름 변경',
      message: '새로운 회사 이름을 입력하세요.',
      type: 'prompt',
      confirmText: '변경',
      onConfirm: async (newName) => {
        if (!newName) return
        try {
          const { error } = await supabase
            .from('organizations')
            .update({ name: newName })
            .eq('id', organization.id)

          if (error) throw error
          
          setOrganization({ ...organization, name: newName })
          showToast('회사 이름이 변경되었습니다.', 'success')
          // Force reload to update sidebar logo (optional, or use context)
          window.location.reload() 
        } catch (error: any) {
          showToast('변경 실패: ' + error.message, 'error')
        }
      }
    })
  }

  const handleGenerateInviteCode = async () => {
    if (!organization) return

    // Generate 8-digit random number
    const newCode = Math.floor(10000000 + Math.random() * 90000000).toString()

    try {
      const { error } = await supabase
        .from('organizations')
        .update({ invite_code: newCode })
        .eq('id', organization.id)

      if (error) throw error

      setOrganization({ ...organization, invite_code: newCode })
      showToast('새로운 초대 코드가 발급되었습니다.', 'success')
    } catch (error: any) {
      showToast('발급 실패: ' + error.message, 'error')
    }
  }

  // Team Management Functions
  const handleSaveTeam = async () => {
    if (!teamName.trim() || !organization) return

    try {
      if (editingTeam) {
        const { error } = await supabase
          .from('teams')
          .update({ name: teamName })
          .eq('id', editingTeam.id)

        if (error) throw error
        
        setTeams(teams.map(t => t.id === editingTeam.id ? { ...t, name: teamName } : t))
        showToast('팀 정보가 수정되었습니다.', 'success')
      } else {
        const { data, error } = await supabase
          .from('teams')
          .insert({
            name: teamName,
            organization_id: organization.id
          })
          .select()
          .single()

        if (error) throw error
        
        setTeams([...teams, data])
        showToast('새로운 팀이 생성되었습니다.', 'success')
      }
      setIsTeamModalOpen(false)
      setEditingTeam(null)
      setTeamName('')
    } catch (error: any) {
      showToast('팀 저장 실패: ' + error.message, 'error')
    }
  }

  const handleDeleteTeam = async (team: Team) => {
    showModal({
      title: '팀 삭제',
      message: `정말로 '${team.name}' 팀을 삭제하시겠습니까? 소속된 팀원들의 팀 정보도 초기화됩니다.`,
      type: 'confirm',
      confirmText: '삭제',
      onConfirm: async () => {
        try {
          // First update users to remove team_id
          await supabase
            .from('profiles')
            .update({ team_id: null })
            .eq('team_id', team.id)

          const { error } = await supabase
            .from('teams')
            .delete()
            .eq('id', team.id)

          if (error) throw error

          setTeams(teams.filter(t => t.id !== team.id))
          // Update local users state as well
          setUsers(users.map(u => u.team_id === team.id ? { ...u, team_id: undefined } : u))
          showToast('팀이 삭제되었습니다.', 'success')
        } catch (error: any) {
          showToast('삭제 실패: ' + error.message, 'error')
        }
      }
    })
  }

  const openEditUserModal = (user: User) => {
    setEditingUser(user)
    setEditPosition(user.position || '')
    setEditDepartment(user.department || '')
    setEditTeamId(user.team_id || '')
  }

  const handleSaveUser = async () => {
    if (!editingUser) return

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          position: editPosition,
          department: editDepartment,
          team_id: editTeamId || null
        })
        .eq('id', editingUser.id)

      if (error) throw error

      setUsers(users.map(u => u.id === editingUser.id ? { 
        ...u, 
        position: editPosition, 
        department: editDepartment,
        team_id: editTeamId || undefined
      } : u))
      setEditingUser(null)
      showToast('사용자 정보가 수정되었습니다.', 'success')
    } catch (error: any) {
      showToast('수정 실패: ' + error.message, 'error')
    }
  }

  const handleToggleAdmin = async (targetUser: User) => {
    if (!isOwner) return
    if (targetUser.id === user?.id) return 

    const newStatus = !targetUser.is_admin
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_admin: newStatus })
        .eq('id', targetUser.id)

      if (error) throw error

      setUsers(users.map(u => u.id === targetUser.id ? { ...u, is_admin: newStatus } : u))
      showToast(`${targetUser.full_name}님의 관리자 권한이 ${newStatus ? '부여' : '해제'}되었습니다.`, 'success')
    } catch (error: any) {
      showToast('권한 변경 실패: ' + error.message, 'error')
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>로딩 중...</div>
  }

  if (!organization) {
    return (
      <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', maxWidth: '500px' }}>
          <h2 style={{ color: '#ef4444', marginBottom: '10px' }}>접근 권한 없음</h2>
          <p style={{ color: '#4b5563', marginBottom: '20px' }}>
            이 페이지에 접근할 수 있는 권한이 없습니다.<br/>
            관리자(조직 소유자)만 접근 가능합니다.
          </p>
          <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
            현재 계정: {user?.email}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="glass-header" style={{ 
        marginBottom: '30px',
        padding: '20px 30px',
        borderRadius: '16px',
        borderBottom: 'none'
      }}>
        <h1 style={{ fontSize: '1.8rem', color: '#4f46e5', margin: 0 }}>관리자 설정</h1>
      </div>

      <div style={{ display: 'grid', gap: '30px' }}>
        {/* Organization Settings */}
        <section className="glass-panel" style={{ padding: '30px' }}>
          <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#374151', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px' }}>
            🏢 회사/조직 설정
          </h2>
          
          <div style={{ display: 'grid', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '1rem' }}>회사 이름</h3>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>{organization.name}</p>
              </div>
              <button onClick={handleUpdateOrgName} style={{ padding: '8px 16px', fontSize: '0.9rem' }}>이름 변경</button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '1rem' }}>그룹 초대 코드</h3>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
                  {organization.invite_code ? (
                    <span style={{ fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: 'bold', color: '#4f46e5' }}>
                      {organization.invite_code}
                    </span>
                  ) : (
                    '발급된 코드가 없습니다.'
                  )}
                </p>
              </div>
              <button onClick={handleGenerateInviteCode} style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
                {organization.invite_code ? '코드 재발급' : '코드 발급'}
              </button>
            </div>
          </div>
        </section>

        {/* Team Management */}
        <section className="glass-panel" style={{ padding: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px' }}>
            <h2 style={{ margin: 0, color: '#374151' }}>
              👥 팀 관리
            </h2>
            <button 
              onClick={() => {
                setEditingTeam(null)
                setTeamName('')
                setIsTeamModalOpen(true)
              }}
              style={{ padding: '8px 16px', fontSize: '0.9rem', backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
            >
              + 팀 추가
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
            {teams.map(team => (
              <div key={team.id} className="glass-card" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem' }}>{team.name}</h3>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b7280' }}>
                    멤버: {users.filter(u => u.team_id === team.id).length}명
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button 
                    onClick={() => {
                      setEditingTeam(team)
                      setTeamName(team.name)
                      setIsTeamModalOpen(true)
                    }}
                    style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: 'white', color: '#4f46e5', border: '1px solid #4f46e5', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    수정
                  </button>
                  <button 
                    onClick={() => handleDeleteTeam(team)}
                    style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: 'white', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
            {teams.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px', color: '#9ca3af' }}>
                등록된 팀이 없습니다.
              </div>
            )}
          </div>
        </section>

        {/* User Management */}
        <section className="glass-panel" style={{ padding: '30px' }}>
          <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#374151', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px' }}>
            👥 구성원 관리
          </h2>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                  <th style={{ padding: '12px', color: '#6b7280', fontSize: '0.9rem' }}>이름</th>
                  <th style={{ padding: '12px', color: '#6b7280', fontSize: '0.9rem' }}>이메일</th>
                  <th style={{ padding: '12px', color: '#6b7280', fontSize: '0.9rem' }}>부서</th>
                  <th style={{ padding: '12px', color: '#6b7280', fontSize: '0.9rem' }}>팀</th>
                  <th style={{ padding: '12px', color: '#6b7280', fontSize: '0.9rem' }}>직책</th>
                  <th style={{ padding: '12px', color: '#6b7280', fontSize: '0.9rem' }}>권한</th>
                  <th style={{ padding: '12px', color: '#6b7280', fontSize: '0.9rem' }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px', fontWeight: '500' }}>{u.full_name}</td>
                    <td style={{ padding: '12px', color: '#6b7280' }}>{u.email}</td>
                    <td style={{ padding: '12px' }}>{u.department || '-'}</td>
                    <td style={{ padding: '12px' }}>{teams.find(t => t.id === u.team_id)?.name || '-'}</td>
                    <td style={{ padding: '12px' }}>{u.position || '-'}</td>
                    <td style={{ padding: '12px' }}>
                      {organization.owner_id === u.id ? (
                        <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#d97706', fontSize: '0.8rem', fontWeight: 'bold' }}>소유자</span>
                      ) : u.is_admin ? (
                        <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: '#d1fae5', color: '#059669', fontSize: '0.8rem', fontWeight: 'bold' }}>관리자</span>
                      ) : (
                        <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: '#f3f4f6', color: '#6b7280', fontSize: '0.8rem' }}>일반</span>
                      )}
                    </td>
                    <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => openEditUserModal(u)}
                        style={{ 
                          padding: '6px 12px', 
                          fontSize: '0.8rem', 
                          backgroundColor: 'white', 
                          color: '#4f46e5', 
                          border: '1px solid #4f46e5',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        수정
                      </button>
                      {isOwner && organization.owner_id !== u.id && (
                        <button
                          onClick={() => handleToggleAdmin(u)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.8rem',
                            backgroundColor: u.is_admin ? '#fee2e2' : '#e0e7ff',
                            color: u.is_admin ? '#ef4444' : '#4f46e5',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          {u.is_admin ? '관리자 해제' : '관리자 지정'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="glass-panel" style={{
            width: '90%',
            maxWidth: '500px',
            padding: '30px',
            backgroundColor: 'white'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>구성원 정보 수정</h3>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#6b7280' }}>이름</label>
              <input type="text" value={editingUser.full_name} disabled style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }} />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#6b7280' }}>부서</label>
              <input 
                type="text" 
                value={editDepartment} 
                onChange={(e) => setEditDepartment(e.target.value)}
                placeholder="부서명을 입력하세요"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#6b7280' }}>팀</label>
              <select 
                value={editTeamId} 
                onChange={(e) => setEditTeamId(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
              >
                <option value="">팀 없음</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#6b7280' }}>직책</label>
              <input 
                type="text" 
                value={editPosition} 
                onChange={(e) => setEditPosition(e.target.value)}
                placeholder="직책을 입력하세요 (예: 대리, 과장)"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                onClick={() => setEditingUser(null)}
                style={{ padding: '8px 16px', borderRadius: '4px', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', cursor: 'pointer' }}
              >
                취소
              </button>
              <button 
                onClick={handleSaveUser}
                style={{ padding: '8px 16px', borderRadius: '4px', backgroundColor: '#4f46e5', color: 'white', border: 'none', cursor: 'pointer' }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Edit Modal */}
      {isTeamModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="glass-panel" style={{
            width: '90%',
            maxWidth: '400px',
            padding: '30px',
            backgroundColor: 'white'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>{editingTeam ? '팀 정보 수정' : '새 팀 추가'}</h3>
            
            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#6b7280' }}>팀 이름</label>
              <input 
                type="text" 
                value={teamName} 
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="팀 이름을 입력하세요"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                onClick={() => setIsTeamModalOpen(false)}
                style={{ padding: '8px 16px', borderRadius: '4px', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', cursor: 'pointer' }}
              >
                취소
              </button>
              <button 
                onClick={handleSaveTeam}
                style={{ padding: '8px 16px', borderRadius: '4px', backgroundColor: '#4f46e5', color: 'white', border: 'none', cursor: 'pointer' }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
