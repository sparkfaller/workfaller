import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useUI } from '../contexts/UIContext'
import type { Task, User, Team } from '../types/database.types'

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const { user, profile } = useAuth()
  const { showToast, showModal } = useUI()
  const [isAdmin, setIsAdmin] = useState(false)
  
  // Assignee Data
  const [users, setUsers] = useState<User[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [filter, setFilter] = useState<'all' | 'my'>('all')

  useEffect(() => {
    checkAdmin()
    fetchTasks()
    fetchAssignees()
  }, [user])

  const checkAdmin = async () => {
    if (!user) return
    try {
      // Use select('*') to avoid error if is_admin column doesn't exist yet
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profile?.is_admin) {
        setIsAdmin(true)
        return
      }

      if (profile?.organization_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('owner_id')
          .eq('id', profile.organization_id)
          .single()
        
        if (org?.owner_id === user.id) {
          setIsAdmin(true)
        }
      }
    } catch (error) {
      console.error('Error checking admin:', error)
    }
  }

  const fetchAssignees = async () => {
    if (!profile?.organization_id) return
    
    const { data: orgUsers } = await supabase
      .from('profiles')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('full_name')
    
    if (orgUsers) setUsers(orgUsers)

    const { data: orgTeams } = await supabase
      .from('teams')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('name')

    if (orgTeams) setTeams(orgTeams)
  }

  const fetchTasks = async () => {
    setLoading(true)
    let query = supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })

    if (filter === 'my' && user) {
      // Get my team id first
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('team_id')
        .eq('id', user.id)
        .single()
      
      const myTeamId = myProfile?.team_id

      if (myTeamId) {
        query = query.or(`assignee_id.eq.${user.id},assignee_team_id.eq.${myTeamId}`)
      } else {
        query = query.eq('assignee_id', user.id)
      }
    }

    const { data, error } = await query

    if (error) {
      showToast('업무 목록을 불러오는데 실패했습니다.', 'error')
    } else {
      setTasks(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchTasks()
  }, [filter])

  const handleDeleteTask = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    
    showModal({
      title: '업무 삭제',
      message: '정말로 이 업무를 삭제하시겠습니까?',
      type: 'confirm',
      confirmText: '삭제',
      onConfirm: async () => {
        const { error } = await supabase
          .from('tasks')
          .delete()
          .eq('id', id)

        if (error) {
          showToast('삭제 실패: ' + error.message, 'error')
        } else {
          showToast('업무가 삭제되었습니다.', 'success')
          fetchTasks()
        }
      }
    })
  }

  const openTaskForm = (task?: Task) => {
    let title = task?.title || ''
    let description = task?.description || ''
    let priority: 'low' | 'medium' | 'high' = task?.priority || 'medium'
    let dueDate = task?.due_date ? new Date(task.due_date).toISOString().split('T')[0] : ''
    let assigneeType: 'user' | 'team' = task?.assignee_team_id ? 'team' : 'user'
    let assigneeId = task?.assignee_team_id || task?.assignee_id || ''

    const isEdit = !!task

    showModal({
      title: isEdit ? '업무 수정' : '새 업무 등록',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9375rem', width: '100%' }}>
          <input 
            placeholder="업무 제목" 
            defaultValue={title}
            onChange={(e) => title = e.target.value}
            style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', fontSize: '1rem' }}
          />
          
          {/* Assignee Selection */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.3125rem', fontSize: '0.9rem', color: '#374151' }}>담당자 / 담당팀</label>
            <select
              defaultValue={assigneeId}
              onChange={(e) => {
                const value = e.target.value
                assigneeId = value
                // Determine type based on prefix or check existence in arrays
                // But here we just store the ID. We need to know if it's a team or user.
                // A simple way is to check if the ID exists in teams array.
                const isTeam = teams.some(t => t.id === value)
                assigneeType = isTeam ? 'team' : 'user'
              }}
              style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}
            >
              <option value="">선택 안 함</option>
              <optgroup label="팀">
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </optgroup>
              <optgroup label="구성원">
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                ))}
              </optgroup>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3125rem' }}>
            <label style={{ fontSize: '0.8rem', color: '#6b7280' }}>상세 내용 (Markdown 지원)</label>
            <textarea 
              placeholder="업무 내용을 입력하세요. Markdown 문법을 사용할 수 있습니다." 
              defaultValue={description}
              onChange={(e) => description = e.target.value}
              rows={10}
              style={{ 
                padding: '0.75rem', 
                borderRadius: '0.5rem', 
                border: '1px solid #e5e7eb', 
                fontFamily: 'monospace',
                resize: 'vertical'
              }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.3125rem', fontSize: '0.9rem', color: '#374151' }}>우선순위</label>
              <select 
                onChange={(e) => priority = e.target.value as 'low' | 'medium' | 'high'}
                defaultValue={priority}
                style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}
              >
                <option value="low">낮음</option>
                <option value="medium">보통</option>
                <option value="high">높음</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.3125rem', fontSize: '0.9rem', color: '#374151' }}>마감일</label>
              <input 
                type="date"
                defaultValue={dueDate}
                onChange={(e) => dueDate = e.target.value}
                style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}
              />
            </div>
          </div>
        </div>
      ),
      confirmText: isEdit ? '수정' : '등록',
      onConfirm: async () => {
        if (!title) {
          showToast('제목을 입력해주세요.', 'error')
          return
        }

        const taskData = {
          title,
          description,
          priority,
          due_date: dueDate || null,
          assignee_id: assigneeType === 'user' && assigneeId ? assigneeId : null,
          assignee_team_id: assigneeType === 'team' && assigneeId ? assigneeId : null
        }

        let error;
        if (isEdit && task) {
            const { error: updateError } = await supabase
            .from('tasks')
            .update(taskData)
            .eq('id', task.id)
            error = updateError
        } else {
            const { error: insertError } = await supabase.from('tasks').insert({
                ...taskData,
                creator_id: user?.id,
                status: 'pending'
            })
            error = insertError
        }

        if (error) {
          showToast((isEdit ? '수정' : '등록') + ' 실패: ' + error.message, 'error')
        } else {
          showToast('업무가 ' + (isEdit ? '수정' : '등록') + '되었습니다.', 'success')
          fetchTasks()
        }
      }
    })
  }

  const handleTaskClick = (task: Task) => {
    showModal({
      title: task.title,
      content: (
        <div style={{ width: '100%', maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ 
            display: 'flex', 
            gap: '0.625rem', 
            marginBottom: '1.25rem',
            fontSize: '0.9rem',
            color: '#6b7280'
          }}>
            <span style={{ 
              padding: '0.25rem 0.5rem', 
              borderRadius: '0.25rem',
              background: task.priority === 'high' ? '#fee2e2' : task.priority === 'medium' ? '#fef3c7' : '#d1fae5',
              color: task.priority === 'high' ? '#dc2626' : task.priority === 'medium' ? '#d97706' : '#059669'
            }}>
              {task.priority === 'high' ? '높음' : task.priority === 'medium' ? '보통' : '낮음'}
            </span>
            <span>마감일: {task.due_date ? new Date(task.due_date).toLocaleDateString() : '없음'}</span>
            <span>상태: {task.status}</span>
          </div>
          <div className="markdown-body" style={{ lineHeight: '1.6' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {task.description || '내용 없음'}
            </ReactMarkdown>
          </div>
          {(user?.id === task.creator_id || isAdmin) && (
            <div style={{ marginTop: '1.875rem', display: 'flex', justifyContent: 'flex-end', gap: '0.625rem' }}>
              <button
                onClick={() => openTaskForm(task)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#4f46e5',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer'
                }}
              >
                수정하기
              </button>
              <button
                onClick={() => handleDeleteTask(task.id)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer'
                }}
              >
                삭제하기
              </button>
            </div>
          )}
        </div>
      ),
      confirmText: '닫기',
      onConfirm: () => {}
    })
  }

  const handleStatusChange = async (id: string, status: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const { error } = await supabase
      .from('tasks')
      .update({ status })
      .eq('id', id)

    if (error) {
      showToast('상태 변경 실패', 'error')
    } else {
      fetchTasks()
    }
  }

  return (
    <div className="page-container">
      <div className="glass-header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1.875rem',
        padding: '0.9375rem 1.875rem',
        borderRadius: '1rem',
        borderBottom: 'none'
      }}>
        <h1 style={{ fontSize: '1.5rem', color: '#4f46e5' }}>업무 관리</h1>
        <div style={{ display: 'flex', gap: '0.625rem' }}>
          <div style={{ display: 'flex', backgroundColor: 'white', borderRadius: '0.5rem', padding: '0.25rem', border: '1px solid #e5e7eb' }}>
            <button
              onClick={() => setFilter('all')}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: filter === 'all' ? '#4f46e5' : 'transparent',
                color: filter === 'all' ? 'white' : '#6b7280',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              전체 업무
            </button>
            <button
              onClick={() => setFilter('my')}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: filter === 'my' ? '#4f46e5' : 'transparent',
                color: filter === 'my' ? 'white' : '#6b7280',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              나의 할 일
            </button>
          </div>
          <button 
            onClick={() => openTaskForm()}
            className="glass-button"
            style={{ background: '#4f46e5', color: 'white', border: 'none' }}
          >
            + 새 업무
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(18.75rem, 1fr))', gap: '1.25rem' }}>
        {['pending', 'in_progress', 'completed'].map((status) => (
          <div key={status} className="glass-panel" style={{ padding: '1.25rem', alignSelf: 'start' }}>
            <h3 style={{ 
              marginBottom: '1.25rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.625rem',
              color: status === 'pending' ? '#f59e0b' : status === 'in_progress' ? '#3b82f6' : '#10b981'
            }}>
              {status === 'pending' ? '대기 중' : status === 'in_progress' ? '진행 중' : '완료'}
              <span style={{ fontSize: '0.8em', opacity: 0.7 }}>
                {tasks.filter(t => t.status === status).length}
              </span>
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9375rem' }}>
              {tasks.filter(t => t.status === status).map(task => (
                <div 
                  key={task.id} 
                  className="glass-card" 
                  style={{ padding: '0.9375rem', backgroundColor: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
                  onClick={() => handleTaskClick(task)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3125rem' }}>
                    <span style={{ fontWeight: 'bold' }}>{task.title}</span>
                    <div style={{ display: 'flex', gap: '0.3125rem', alignItems: 'center' }}>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        padding: '0.125rem 0.375rem', 
                        borderRadius: '0.25rem',
                        backgroundColor: task.priority === 'high' ? '#fee2e2' : task.priority === 'medium' ? '#fef3c7' : '#d1fae5',
                        color: task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#d97706' : '#059669'
                      }}>
                        {task.priority === 'high' ? '높음' : task.priority === 'medium' ? '보통' : '낮음'}
                      </span>
                      {/* Assignee Badge */}
                      {(task.assignee_id || task.assignee_team_id) && (
                        <span style={{ fontSize: '0.75rem', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '0.125rem 0.375rem', borderRadius: '0.25rem' }}>
                          {task.assignee_team_id 
                            ? `팀: ${teams.find(t => t.id === task.assignee_team_id)?.name || '알 수 없음'}`
                            : `담당: ${users.find(u => u.id === task.assignee_id)?.full_name || '알 수 없음'}`
                          }
                        </span>
                      )}
                      {(user?.id === task.creator_id || isAdmin) && (
                        <button
                          onClick={(e) => handleDeleteTask(task.id, e)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#ef4444',
                            padding: '0 0.25rem',
                            fontSize: '1.1rem',
                            lineHeight: 1
                          }}
                          title="삭제"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ 
                    fontSize: '0.875rem', 
                    color: '#6b7280', 
                    margin: '0.3125rem 0',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxHeight: '4.5em'
                  }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {task.description || ''}
                    </ReactMarkdown>
                  </div>
                  {task.due_date && (
                    <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>
                      마감: {new Date(task.due_date).toLocaleDateString()}
                    </div>
                  )}
                  <div style={{ marginTop: '0.625rem', display: 'flex', gap: '0.3125rem' }}>
                    {status !== 'pending' && (
                      <button 
                        onClick={(e) => handleStatusChange(task.id, 'pending', e)}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', backgroundColor: '#f3f4f6', color: '#374151', boxShadow: 'none' }}
                      >
                        대기
                      </button>
                    )}
                    {status !== 'in_progress' && (
                      <button 
                        onClick={(e) => handleStatusChange(task.id, 'in_progress', e)}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', backgroundColor: '#dbeafe', color: '#1d4ed8', boxShadow: 'none' }}
                      >
                        진행
                      </button>
                    )}
                    {status !== 'completed' && (
                      <button 
                        onClick={(e) => handleStatusChange(task.id, 'completed', e)}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', backgroundColor: '#d1fae5', color: '#047857', boxShadow: 'none' }}
                      >
                        완료
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
