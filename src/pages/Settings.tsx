import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useUI } from '../contexts/UIContext'
import { supabase } from '../lib/supabase'

export default function Settings() {
  const { user, signOut } = useAuth()
  const { showToast, showModal } = useUI()
  const navigate = useNavigate()
  
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [orgName, setOrgName] = useState('')
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    if (user?.user_metadata?.full_name) {
      setFullName(user.user_metadata.full_name)
    }
    fetchOrgInfo()
  }, [user])

  const fetchOrgInfo = async () => {
    if (!user) return
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (profile?.organization_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('name, owner_id')
          .eq('id', profile.organization_id)
          .single()
        
        if (org) {
          setOrgName(org.name)
          setIsOwner(org.owner_id === user.id)
        }
      }
    } catch (error) {
      console.error('Error fetching org info:', error)
    }
  }

  const handleUpdateProfile = async () => {
    if (!user) return
    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName }
    })

    if (error) {
      showToast('프로필 업데이트 실패: ' + error.message, 'error')
    } else {
      // Also update profiles table
      await supabase.from('profiles').update({ full_name: fullName }).eq('id', user.id)
      showToast('프로필이 업데이트되었습니다.', 'success')
    }
    setLoading(false)
  }

  const handleLeaveGroup = async () => {
    if (isOwner) {
      showToast('조직 소유자는 탈퇴할 수 없습니다. 관리자 권한을 위임하거나 조직을 삭제해야 합니다.', 'error')
      return
    }

    showModal({
      title: '그룹 탈퇴',
      message: `정말로 '${orgName}' 그룹에서 탈퇴하시겠습니까?\n탈퇴 후에는 그룹의 데이터에 접근할 수 없습니다.`,
      type: 'confirm',
      confirmText: '탈퇴하기',
      onConfirm: async () => {
        try {
          // Update profile to remove organization_id
          const { error } = await supabase
            .from('profiles')
            .update({ 
              organization_id: null,
              department: null,
              position: null
            })
            .eq('id', user?.id)

          if (error) throw error

          showToast('그룹에서 탈퇴했습니다.', 'success')
          // Sign out and redirect to login
          await signOut()
          navigate('/login')
        } catch (error: any) {
          showToast('탈퇴 실패: ' + error.message, 'error')
        }
      }
    })
  }

  const handleDeleteAccount = async () => {
    if (isOwner) {
      showToast('조직 소유자는 탈퇴할 수 없습니다. 먼저 조직을 삭제하거나 소유권을 이전하세요.', 'error')
      return
    }

    showModal({
      title: '회원 탈퇴',
      message: '정말로 계정을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.',
      type: 'confirm',
      confirmText: '삭제하기',
      onConfirm: async () => {
        try {
          // 1. Delete Account via RPC (Deletes from auth.users -> cascades to profiles)
          const { error } = await supabase.rpc('delete_own_account')

          if (error) throw error

          showToast('회원 탈퇴가 완료되었습니다.', 'success')
          await signOut()
          navigate('/login')
        } catch (error: any) {
          showToast('탈퇴 실패: ' + error.message, 'error')
        }
      }
    })
  }

  return (
    <div className="page-container">
      <div className="glass-header" style={{ 
        marginBottom: '30px',
        padding: '20px 30px',
        borderRadius: '16px',
        borderBottom: 'none'
      }}>
        <h1 style={{ fontSize: '1.8rem', color: '#4f46e5', margin: 0 }}>설정</h1>
      </div>

      <div style={{ display: 'grid', gap: '30px', maxWidth: '800px' }}>
        {/* Profile Settings */}
        <section className="glass-panel" style={{ padding: '30px' }}>
          <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#374151', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px' }}>
            👤 내 프로필
          </h2>
          
          <div style={{ display: 'grid', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#4b5563', fontWeight: '500' }}>이메일</label>
              <input 
                type="email" 
                value={user?.email || ''} 
                disabled 
                style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed', color: '#6b7280' }} 
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#4b5563', fontWeight: '500' }}>이름</label>
              <input 
                type="text" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)}
                placeholder="이름을 입력하세요"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={handleUpdateProfile}
                disabled={loading}
                style={{ 
                  padding: '10px 20px',
                  backgroundColor: '#4f46e5',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? '저장 중...' : '변경사항 저장'}
              </button>
            </div>
          </div>
        </section>

        {/* Group Settings */}
        <section className="glass-panel" style={{ padding: '30px' }}>
          <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#374151', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px' }}>
            🏢 소속 그룹 정보
          </h2>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem' }}>{orgName || '소속 없음'}</h3>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
                {isOwner ? '관리자(소유자)' : '일반 멤버'}
              </p>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#ef4444' }}>위험 구역</h3>
            <p style={{ margin: '0 0 15px 0', color: '#6b7280', fontSize: '0.9rem' }}>
              그룹에서 탈퇴하거나 계정을 삭제할 수 있습니다.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={handleLeaveGroup}
                style={{ 
                  padding: '10px 20px',
                  backgroundColor: 'white',
                  color: '#ef4444',
                  border: '1px solid #ef4444',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                그룹 탈퇴하기
              </button>
              <button 
                onClick={handleDeleteAccount}
                style={{ 
                  padding: '10px 20px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                회원 탈퇴하기
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
