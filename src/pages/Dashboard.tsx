import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Post, Task, Calendar } from '../types/database.types'

export default function Dashboard() {
  const { user } = useAuth()
  const [counts, setCounts] = useState({
    notices: 0,
    tasks: 0,
    events: 0,
    messages: 0
  })
  
  const [recentNotices, setRecentNotices] = useState<Post[]>([])
  const [recentTasks, setRecentTasks] = useState<Task[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<Calendar[]>([])

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return

      // 1. Notices (Board posts with category 'notice')
      const { count: noticeCount, data: notices } = await supabase
        .from('posts')
        .select('*', { count: 'exact' })
        .eq('category', 'notice')
        .order('created_at', { ascending: false })
        .limit(3)
      
      if (notices) setRecentNotices(notices)

      // 2. Tasks (Assigned to user, status not completed)
      const { count: taskCount, data: tasks } = await supabase
        .from('tasks')
        .select('*', { count: 'exact' })
        .eq('assignee_id', user.id)
        .neq('status', 'completed')
        .order('due_date', { ascending: true })
        .limit(3)

      if (tasks) setRecentTasks(tasks)

      // 3. Events (Participating or created by user, future events)
      const today = new Date().toISOString()
      const { count: eventCount, data: events } = await supabase
        .from('calendars')
        .select('*', { count: 'exact' })
        .or(`creator_id.eq.${user.id},participants.cs.{${user.id}}`)
        .gte('start_date', today)
        .order('start_date', { ascending: true })
        .limit(3)

      if (events) setUpcomingEvents(events)

      // 4. Messages (Unread messages received by user)
      // Note: Assuming 'messages' table exists based on types
      const { count: messageCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false)

      setCounts({
        notices: noticeCount || 0,
        tasks: taskCount || 0,
        events: eventCount || 0,
        messages: messageCount || 0
      })
    }

    fetchData()
  }, [user])

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
        <h1 style={{ fontSize: '1.5rem', color: '#4f46e5' }}>대시보드</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ color: '#4b5563', fontWeight: '500' }}>환영합니다, {user?.email}님</span>
          <Link to="/admin" style={{ 
            padding: '8px 16px', 
            backgroundColor: '#4f46e5', 
            color: 'white', 
            borderRadius: '8px', 
            textDecoration: 'none',
            fontSize: '0.9rem'
          }}>관리자</Link>
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px',
        marginBottom: '40px'
      }}>
        <DashboardCard title="공지사항" count={counts.notices} color="linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)" icon="📢" />
        <DashboardCard title="할 일" count={counts.tasks} color="linear-gradient(135deg, #34d399 0%, #10b981 100%)" icon="✅" />
        <DashboardCard title="일정" count={counts.events} color="linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)" icon="📅" />
        <DashboardCard title="미확인 메시지" count={counts.messages} color="linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)" icon="💬" />
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px',
        marginBottom: '40px'
      }}>
        {/* Recent Notices */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ marginTop: 0, color: '#374151', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>📢 최근 공지사항</h3>
          {recentNotices.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {recentNotices.map(notice => (
                <li key={notice.id} style={{ padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <Link to="/board" style={{ textDecoration: 'none', color: '#4b5563', display: 'block' }}>
                    <div style={{ fontWeight: '500', marginBottom: '4px' }}>{notice.title}</div>
                    <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{new Date(notice.created_at).toLocaleDateString()}</div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px' }}>등록된 공지사항이 없습니다.</p>
          )}
        </div>

        {/* My Tasks */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ marginTop: 0, color: '#374151', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>✅ 나의 할 일</h3>
          {recentTasks.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {recentTasks.map(task => (
                <li key={task.id} style={{ padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <Link to="/tasks" style={{ textDecoration: 'none', color: '#4b5563', display: 'block' }}>
                    <div style={{ fontWeight: '500', marginBottom: '4px' }}>{task.title}</div>
                    <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                      마감: {task.due_date ? new Date(task.due_date).toLocaleDateString() : '없음'}
                      <span style={{ marginLeft: '8px', padding: '2px 6px', borderRadius: '4px', backgroundColor: task.priority === 'high' ? '#fee2e2' : '#f3f4f6', color: task.priority === 'high' ? '#ef4444' : '#6b7280', fontSize: '0.7rem' }}>
                        {task.priority === 'high' ? '높음' : task.priority === 'medium' ? '중간' : '낮음'}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px' }}>진행 중인 업무가 없습니다.</p>
          )}
        </div>

        {/* Upcoming Events */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ marginTop: 0, color: '#374151', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>📅 다가오는 일정</h3>
          {upcomingEvents.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {upcomingEvents.map(event => (
                <li key={event.id} style={{ padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <Link to="/calendar" style={{ textDecoration: 'none', color: '#4b5563', display: 'block' }}>
                    <div style={{ fontWeight: '500', marginBottom: '4px' }}>{event.title}</div>
                    <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                      {new Date(event.start_date).toLocaleDateString()} {new Date(event.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px' }}>예정된 일정이 없습니다.</p>
          )}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '30px' }}>
        <h2 style={{ marginBottom: '20px', fontSize: '1.5rem', color: '#374151' }}>빠른 메뉴</h2>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '20px',
        }}>
          <Link to="/board" style={{ textDecoration: 'none', color: 'inherit' }}>
            <QuickMenu title="게시판" icon="📝" />
          </Link>
          <Link to="/tasks" style={{ textDecoration: 'none', color: 'inherit' }}>
            <QuickMenu title="업무 관리" icon="📋" />
          </Link>
          <Link to="/calendar" style={{ textDecoration: 'none', color: 'inherit' }}>
            <QuickMenu title="일정 관리" icon="📅" />
          </Link>
          <Link to="/drive" style={{ textDecoration: 'none', color: 'inherit' }}>
            <QuickMenu title="그룹 드라이브" icon="💾" />
          </Link>
          <Link to="/address-book" style={{ textDecoration: 'none', color: 'inherit' }}>
            <QuickMenu title="주소록" icon="👥" />
          </Link>
          <Link to="/approvals" style={{ textDecoration: 'none', color: 'inherit' }}>
            <QuickMenu title="전자결재" icon="✍️" />
          </Link>
          <Link to="/settings" style={{ textDecoration: 'none', color: 'inherit' }}>
            <QuickMenu title="설정" icon="⚙️" />
          </Link>
        </div>
      </div>
    </div>
  )
}

function DashboardCard({ title, count, color, icon }: { title: string; count: number; color: string; icon: string }) {
  return (
    <div className="glass-card" style={{
      padding: '25px',
      background: color,
      color: 'white',
      border: 'none',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <h3 style={{ marginTop: 0, color: 'rgba(255,255,255,0.9)', fontSize: '1.1rem' }}>{title}</h3>
        <p style={{ fontSize: '36px', fontWeight: 'bold', margin: '10px 0 0 0' }}>{count}</p>
      </div>
      <div style={{ 
        position: 'absolute', 
        right: '-10px', 
        bottom: '-10px', 
        fontSize: '80px', 
        opacity: 0.2,
        transform: 'rotate(-15deg)'
      }}>
        {icon}
      </div>
    </div>
  )
}

function QuickMenu({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="glass-card" style={{
      padding: '25px',
      textAlign: 'center',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '15px',
      transition: 'transform 0.2s'
    }}
    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
    >
      <div style={{ 
        fontSize: '32px', 
        background: 'rgba(79, 70, 229, 0.1)',
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>{icon}</div>
      <div style={{ fontWeight: '600', color: '#4b5563' }}>{title}</div>
    </div>
  )
}
