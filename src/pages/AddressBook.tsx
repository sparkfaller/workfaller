import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useUI } from '../contexts/UIContext'
import { useAuth } from '../contexts/AuthContext'
import type { User } from '../types/database.types'

export default function AddressBook() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const { showToast, showModal } = useUI()
  const { inviteUser } = useAuth()

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name')

    if (error) {
      // showToast('주소록을 불러오는데 실패했습니다.', 'error')
      // Fallback for demo
      setUsers([])
    } else {
      setUsers(data || [])
    }
    setLoading(false)
  }

  const handleInvite = () => {
    showModal({
      title: '멤버 초대',
      message: '초대할 멤버의 이메일 주소를 입력하세요.\n(로그인 링크가 포함된 이메일이 발송됩니다)',
      type: 'prompt',
      confirmText: '초대 보내기',
      onConfirm: async (email) => {
        if (!email) return
        try {
          await inviteUser(email)
          showToast(`${email} 님에게 초대 메일을 보냈습니다.`, 'success')
        } catch (error: any) {
          showToast('초대 실패: ' + error.message, 'error')
        }
      }
    })
  }

  return (
    <div className="page-container">
      <div className="glass-header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1.875rem',
        padding: '1.25rem 1.875rem',
        borderRadius: '1rem',
        borderBottom: 'none'
      }}>
        <h1 style={{ fontSize: '1.8rem', color: '#4f46e5', margin: 0 }}>주소록</h1>
        <button 
          onClick={handleInvite}
          style={{ 
            padding: '0.625rem 1.25rem', 
            backgroundColor: '#4f46e5', 
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            fontWeight: '600',
            boxShadow: '0 0.25rem 0.375rem rgba(79, 70, 229, 0.2)'
          }}
        >
          + 멤버 초대
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2.5rem', color: '#6b7280' }}>로딩 중...</div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(17.5rem, 1fr))', 
          gap: '1.25rem' 
        }}>
          {users.length === 0 ? (
            <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: '2.5rem', textAlign: 'center', color: '#6b7280' }}>
              등록된 멤버가 없습니다.
            </div>
          ) : (
            users.map((user) => (
              <div key={user.id} className="glass-card" style={{ 
                padding: '1.5625rem', 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                gap: '0.9375rem',
                textAlign: 'center',
                transition: 'transform 0.2s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-0.3125rem)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ 
                  width: '5rem', 
                  height: '5rem', 
                  borderRadius: '50%', 
                  backgroundColor: '#e0e7ff', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: '2rem',
                  marginBottom: '0.3125rem',
                  border: '0.1875rem solid white',
                  boxShadow: '0 0.25rem 0.375rem rgba(0,0,0,0.1)'
                }}>
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.full_name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    '👤'
                  )}
                </div>
                <div>
                  <h3 style={{ margin: '0 0 5px 0', color: '#1f2937', fontSize: '1.2rem' }}>{user.full_name || '이름 없음'}</h3>
                  <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>{user.email}</p>
                </div>
                
                <div style={{ width: '100%', height: '1px', backgroundColor: '#e5e7eb', margin: '5px 0' }}></div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span style={{ color: '#9ca3af' }}>부서</span>
                    <span style={{ color: '#4b5563', fontWeight: '500' }}>{user.department || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span style={{ color: '#9ca3af' }}>직책</span>
                    <span style={{ color: '#4b5563', fontWeight: '500' }}>{user.position || '-'}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
