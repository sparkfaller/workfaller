import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useUI } from '../contexts/UIContext'
import type { Approval } from '../types/database.types'

export default function Approvals() {
  const { user } = useAuth()
  const { showToast, showModal } = useUI()
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [isAdmin, setIsAdmin] = useState(false)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null)
  const [editingApproval, setEditingApproval] = useState<Approval | null>(null)
  
  // Form State
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchApprovals()
    checkAdminStatus()
  }, [user, filter])

  const checkAdminStatus = async () => {
    if (!user) return
    try {
      // Use select('*') to avoid error if is_admin column doesn't exist yet
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profile?.organization_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('owner_id')
          .eq('id', profile.organization_id)
          .single()
        
        if ((org && org.owner_id === user.id) || profile.is_admin) {
          setIsAdmin(true)
        }
      }
    } catch (error) {
      console.error('Error checking admin status:', error)
    }
  }

  const fetchApprovals = async () => {
    if (!user) return
    setLoading(true)
    
    let query = supabase
      .from('approvals')
      .select('*')
      .order('created_at', { ascending: false })

    if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching approvals:', error)
    } else {
      setApprovals(data || [])
    }
    setLoading(false)
  }

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      showToast('제목과 내용을 모두 입력해주세요.', 'error')
      return
    }
    
    setSubmitting(true)
    try {
      if (editingApproval) {
        const { error } = await supabase
          .from('approvals')
          .update({
            title,
            content,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingApproval.id)

        if (error) throw error
        showToast('결재 문서가 수정되었습니다.', 'success')
      } else {
        const { error } = await supabase.from('approvals').insert({
          title,
          content,
          drafter_id: user?.id,
          status: 'pending'
        })

        if (error) throw error
        showToast('결재 문서가 작성되었습니다.', 'success')
      }

      setIsModalOpen(false)
      setEditingApproval(null)
      setTitle('')
      setContent('')
      fetchApprovals()
    } catch (error: any) {
      showToast((editingApproval ? '수정' : '작성') + ' 실패: ' + error.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleProcessApproval = async (status: 'approved' | 'rejected') => {
    if (!selectedApproval) return

    try {
      const { error } = await supabase
        .from('approvals')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedApproval.id)

      if (error) throw error

      showToast(`결재가 ${status === 'approved' ? '승인' : '반려'}되었습니다.`, 'success')
      setViewModalOpen(false)
      setSelectedApproval(null)
      fetchApprovals()
    } catch (error: any) {
      showToast('결재 처리 실패: ' + error.message, 'error')
    }
  }

  const handleDelete = async (approval: Approval) => {
    showModal({
      title: '결재 문서 삭제',
      message: '정말로 이 결재 문서를 삭제하시겠습니까?',
      type: 'confirm',
      confirmText: '삭제',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('approvals')
            .delete()
            .eq('id', approval.id)

          if (error) throw error

          showToast('결재 문서가 삭제되었습니다.', 'success')
          setViewModalOpen(false)
          fetchApprovals()
        } catch (error: any) {
          showToast('삭제 실패: ' + error.message, 'error')
        }
      }
    })
  }

  const openCreateModal = () => {
    setEditingApproval(null)
    setTitle('')
    setContent('')
    setIsModalOpen(true)
  }

  const openEditModal = (approval: Approval) => {
    setEditingApproval(approval)
    setTitle(approval.title)
    setContent(approval.content || '')
    setViewModalOpen(false)
    setIsModalOpen(true)
  }

  const openViewModal = (approval: Approval) => {
    setSelectedApproval(approval)
    setViewModalOpen(true)
  }

  return (
    <div className="page-container">
      <div className="glass-header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px',
        padding: '15px 30px',
        borderRadius: '16px',
        borderBottom: 'none'
      }}>
        <h1 style={{ fontSize: '1.5rem', color: '#4f46e5' }}>전자결재</h1>
        <button 
          onClick={openCreateModal}
          style={{ 
            padding: '10px 20px', 
            backgroundColor: '#4f46e5', 
            color: 'white', 
            border: 'none', 
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          + 새 결재 작성
        </button>
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        {['all', 'pending', 'approved', 'rejected'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status as any)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: 'none',
              backgroundColor: filter === status ? '#4f46e5' : 'rgba(255, 255, 255, 0.5)',
              color: filter === status ? 'white' : '#4b5563',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            {status === 'all' ? '전체' : 
             status === 'pending' ? '대기중' :
             status === 'approved' ? '승인됨' : '반려됨'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>로딩 중...</div>
      ) : (
        <div style={{ display: 'grid', gap: '15px' }}>
          {approvals.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              결재 문서가 없습니다.
            </div>
          ) : (
            approvals.map((approval) => (
              <div 
                key={approval.id} 
                className="glass-card" 
                onClick={() => openViewModal(approval)}
                style={{ 
                  padding: '20px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  cursor: 'pointer'
                }}
              >
                <div>
                  <h3 style={{ margin: '0 0 5px 0', color: '#374151' }}>{approval.title}</h3>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b7280' }}>
                    작성일: {new Date(approval.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span style={{
                  padding: '6px 12px',
                  borderRadius: '12px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  backgroundColor: 
                    approval.status === 'approved' ? '#d1fae5' :
                    approval.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                  color:
                    approval.status === 'approved' ? '#059669' :
                    approval.status === 'rejected' ? '#dc2626' : '#d97706'
                }}>
                  {approval.status === 'pending' ? '대기중' :
                   approval.status === 'approved' ? '승인됨' : '반려됨'}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Write/Edit Modal */}
      {isModalOpen && (
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
            maxWidth: '800px',
            height: '80vh',
            padding: '30px',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'white'
          }}>
            <h2 style={{ marginBottom: '20px', color: '#374151' }}>
              {editingApproval ? '결재 문서 수정' : '새 결재 문서 작성'}
            </h2>
            
            <input
              type="text"
              placeholder="제목을 입력하세요"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                padding: '12px',
                fontSize: '1.1rem',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                marginBottom: '20px',
                width: '100%',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <button
                onClick={() => setActiveTab('write')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: activeTab === 'write' ? '#4f46e5' : '#f3f4f6',
                  color: activeTab === 'write' ? 'white' : '#4b5563',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                작성하기
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: activeTab === 'preview' ? '#4f46e5' : '#f3f4f6',
                  color: activeTab === 'preview' ? 'white' : '#4b5563',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                미리보기
              </button>
            </div>

            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {activeTab === 'write' ? (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="내용을 입력하세요 (Markdown 지원)"
                  style={{
                    flex: 1,
                    width: '100%',
                    padding: '15px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    resize: 'none',
                    fontSize: '1rem',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box'
                  }}
                />
              ) : (
                <div style={{
                  flex: 1,
                  padding: '20px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  overflowY: 'auto',
                  backgroundColor: '#f9fafb'
                }}>
                  <div className="markdown-body">
                    <ReactMarkdown>{content || '(내용 없음)'}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  backgroundColor: 'white',
                  color: '#374151',
                  cursor: 'pointer'
                }}
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={submitting}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#4f46e5',
                  color: 'white',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontWeight: '600'
                }}
              >
                {submitting ? '저장 중...' : (editingApproval ? '수정 완료' : '작성 완료')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewModalOpen && selectedApproval && (
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
            maxWidth: '800px',
            maxHeight: '80vh',
            padding: '30px',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'white'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: '0 0 10px 0', color: '#374151' }}>{selectedApproval.title}</h2>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  backgroundColor: 
                    selectedApproval.status === 'approved' ? '#d1fae5' :
                    selectedApproval.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                  color:
                    selectedApproval.status === 'approved' ? '#059669' :
                    selectedApproval.status === 'rejected' ? '#dc2626' : '#d97706'
                }}>
                  {selectedApproval.status === 'pending' ? '대기중' :
                   selectedApproval.status === 'approved' ? '승인됨' : '반려됨'}
                </span>
              </div>
              <button 
                onClick={() => setViewModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}
              >
                ✕
              </button>
            </div>

            <div style={{
              flex: 1,
              padding: '20px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              overflowY: 'auto',
              backgroundColor: '#f9fafb'
            }}>
              <div className="markdown-body">
                <ReactMarkdown>{selectedApproval.content || '(내용 없음)'}</ReactMarkdown>
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              {/* Edit/Delete Buttons (Only for Drafter or Admin) */}
              {(user?.id === selectedApproval.drafter_id || isAdmin) && (
                <div style={{ marginRight: 'auto', display: 'flex', gap: '10px' }}>
                  {selectedApproval.status === 'pending' && (
                    <button 
                      onClick={() => openEditModal(selectedApproval)}
                      style={{ 
                        padding: '10px 20px', 
                        borderRadius: '8px', 
                        border: '1px solid #4f46e5', 
                        backgroundColor: 'white', 
                        color: '#4f46e5', 
                        cursor: 'pointer'
                      }}
                    >
                      수정
                    </button>
                  )}
                  <button 
                    onClick={() => handleDelete(selectedApproval)}
                    style={{ 
                      padding: '10px 20px', 
                      borderRadius: '8px', 
                      border: '1px solid #ef4444', 
                      backgroundColor: 'white', 
                      color: '#ef4444', 
                      cursor: 'pointer'
                    }}
                  >
                    삭제
                  </button>
                </div>
              )}

              {/* Approval Actions */}
              {selectedApproval.status === 'pending' && isAdmin && (
                <>
                  <button 
                    onClick={() => handleProcessApproval('rejected')}
                    style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#ef4444', color: 'white', cursor: 'pointer' }}
                  >
                    반려
                  </button>
                  <button 
                    onClick={() => handleProcessApproval('approved')}
                    style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#10b981', color: 'white', cursor: 'pointer' }}
                  >
                    승인
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
