import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useUI } from '../contexts/UIContext'
import type { Calendar as CalendarType } from '../types/database.types'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isWithinInterval, startOfDay, endOfDay } from 'date-fns'

export default function Calendar() {
  const [events, setEvents] = useState<CalendarType[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const { user, profile } = useAuth()
  const { showToast, showModal } = useUI()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    checkAdmin()
    fetchEvents()
  }, [currentDate, user])

  const checkAdmin = async () => {
    if (!user) return
    const { data } = await supabase
      .from('organization_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', profile?.organization_id)
      .single()
    
    if (data && (data.role === 'owner' || data.role === 'admin')) {
      setIsAdmin(true)
    }
  }

  const fetchEvents = async () => {
    const start = startOfMonth(currentDate).toISOString()
    const end = endOfMonth(currentDate).toISOString()

    const { data, error } = await supabase
      .from('calendars')
      .select('*')
      .gte('start_date', start)
      .lte('end_date', end)

    if (error) {
      showToast('일정을 불러오는데 실패했습니다.', 'error')
    } else {
      setEvents(data || [])
    }
  }

  const handleDeleteEvent = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    
    showModal({
      title: '일정 삭제',
      message: '정말로 이 일정을 삭제하시겠습니까?',
      type: 'confirm',
      confirmText: '삭제',
      onConfirm: async () => {
        const { error } = await supabase
          .from('calendars')
          .delete()
          .eq('id', id)

        if (error) {
          showToast('삭제 실패: ' + error.message, 'error')
        } else {
          showToast('일정이 삭제되었습니다.', 'success')
          fetchEvents()
        }
      }
    })
  }

  const openEventForm = (event?: CalendarType, defaultDate?: Date) => {
    let title = event?.title || ''
    let type = event?.type || 'event'
    
    const defaultStart = defaultDate || new Date()
    const defaultEnd = defaultDate || new Date()
    
    const startDateObj = event ? new Date(event.start_date) : defaultStart
    const endDateObj = event ? new Date(event.end_date) : defaultEnd

    let startDate = format(startDateObj, 'yyyy-MM-dd')
    let startTime = format(startDateObj, 'HH:mm')
    let endDate = format(endDateObj, 'yyyy-MM-dd')
    let endTime = format(endDateObj, 'HH:mm')

    const isEdit = !!event

    showModal({
      title: isEdit ? '일정 수정' : '새 일정 등록',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>
          <input 
            placeholder="일정 제목" 
            defaultValue={title}
            onChange={(e) => title = e.target.value}
            style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ddd' }}
          />
          <select 
            defaultValue={type}
            onChange={(e) => type = e.target.value as 'meeting' | 'event' | 'deadline'}
            style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ddd' }}
          >
            <option value="meeting">회의</option>
            <option value="event">이벤트</option>
            <option value="deadline">마감일</option>
          </select>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input type="date" defaultValue={startDate} onChange={(e) => startDate = e.target.value} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #ddd' }} />
            <input type="time" defaultValue={startTime} onChange={(e) => startTime = e.target.value} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #ddd' }} />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input type="date" defaultValue={endDate} onChange={(e) => endDate = e.target.value} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #ddd' }} />
            <input type="time" defaultValue={endTime} onChange={(e) => endTime = e.target.value} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #ddd' }} />
          </div>
        </div>
      ),
      confirmText: isEdit ? '수정' : '등록',
      onConfirm: async () => {
        if (!title) {
          showToast('제목을 입력해주세요.', 'error')
          return
        }
        
        const start = new Date(`${startDate}T${startTime}`).toISOString()
        const end = new Date(`${endDate}T${endTime}`).toISOString()

        let error;
        
        if (isEdit && event) {
             const { error: updateError } = await supabase
            .from('calendars')
            .update({
                title,
                type,
                start_date: start,
                end_date: end
            })
            .eq('id', event.id)
            error = updateError
        } else {
            const { error: insertError } = await supabase.from('calendars').insert({
                title,
                type,
                start_date: start,
                end_date: end,
                creator_id: user?.id
            })
            error = insertError
        }

        if (error) {
          showToast((isEdit ? '수정' : '등록') + ' 실패: ' + error.message, 'error')
        } else {
          showToast('일정이 ' + (isEdit ? '수정' : '등록') + '되었습니다.', 'success')
          fetchEvents()
        }
      }
    })
  }

  const handleEventClick = (event: CalendarType) => {
      showModal({
          title: event.title,
          content: (
              <div style={{ width: '100%' }}>
                  <div style={{ marginBottom: '15px' }}>
                    <p style={{ margin: '5px 0' }}><strong>시작:</strong> {new Date(event.start_date).toLocaleString()}</p>
                    <p style={{ margin: '5px 0' }}><strong>종료:</strong> {new Date(event.end_date).toLocaleString()}</p>
                    <p style={{ margin: '5px 0' }}><strong>유형:</strong> {event.type === 'meeting' ? '회의' : event.type === 'deadline' ? '마감일' : '이벤트'}</p>
                  </div>
                  {(user?.id === event.creator_id) && (
                      <div style={{marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
                          <button 
                            onClick={() => openEventForm(event)} 
                            style={{
                              padding: '8px 16px', 
                              background: '#4f46e5', 
                              color: 'white', 
                              border: 'none', 
                              borderRadius: '8px',
                              cursor: 'pointer'
                            }}
                          >
                            수정
                          </button>
                          <button 
                            onClick={() => handleDeleteEvent(event.id)} 
                            style={{
                              padding: '8px 16px', 
                              background: '#ef4444', 
                              color: 'white', 
                              border: 'none', 
                              borderRadius: '8px',
                              cursor: 'pointer'
                            }}
                          >
                            삭제
                          </button>
                      </div>
                  )}
              </div>
          ),
          confirmText: '닫기',
          onConfirm: () => {}
      })
  }

  const days = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  })

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <h1 style={{ fontSize: '1.5rem', color: '#4f46e5', margin: 0 }}>
            {format(currentDate, 'yyyy년 MM월')}
          </h1>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} style={{ padding: '5px 10px' }}>◀</button>
            <button onClick={() => setCurrentDate(new Date())} style={{ padding: '5px 10px' }}>오늘</button>
            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} style={{ padding: '5px 10px' }}>▶</button>
          </div>
        </div>
        <button onClick={() => openEventForm()} className="glass-button" style={{ background: '#4f46e5', color: 'white', border: 'none' }}>📅 일정 추가</button>
      </div>

      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', backgroundColor: 'rgba(0,0,0,0.1)', border: '1px solid rgba(0,0,0,0.1)' }}>
          {['일', '월', '화', '수', '목', '금', '토'].map(day => (
            <div key={day} style={{ padding: '10px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.8)', fontWeight: 'bold' }}>{day}</div>
          ))}
          
          {/* Empty cells for start of month */}
          {Array.from({ length: startOfMonth(currentDate).getDay() }).map((_, i) => (
            <div key={`empty-${i}`} style={{ backgroundColor: 'rgba(255,255,255,0.4)', minHeight: '100px' }} />
          ))}

          {days.map(day => {
            const dayEvents = events.filter(e => {
              const start = startOfDay(new Date(e.start_date))
              const end = endOfDay(new Date(e.end_date))
              return isWithinInterval(day, { start, end })
            })
            return (
              <div 
                key={day.toISOString()} 
                onClick={() => openEventForm(undefined, day)}
                style={{ 
                  backgroundColor: isToday(day) ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)', 
                  minHeight: '100px', 
                  padding: '5px',
                  cursor: 'pointer',
                  border: isToday(day) ? '2px solid #4f46e5' : 'none'
                }}
              >
                <div style={{ textAlign: 'right', marginBottom: '5px', fontWeight: isToday(day) ? 'bold' : 'normal' }}>
                  {format(day, 'd')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {dayEvents.map(event => (
                    <div 
                      key={event.id} 
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEventClick(event)
                      }}
                      style={{ 
                        fontSize: '11px', 
                        padding: '2px 4px', 
                        borderRadius: '3px',
                        backgroundColor: event.type === 'meeting' ? '#e0e7ff' : event.type === 'deadline' ? '#fee2e2' : '#d1fae5',
                        color: event.type === 'meeting' ? '#4f46e5' : event.type === 'deadline' ? '#ef4444' : '#059669',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span>{event.title}</span>
                      {(user?.id === event.creator_id || isAdmin) && (
                        <button
                          onClick={(e) => handleDeleteEvent(event.id, e)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'inherit',
                            padding: '0 2px',
                            fontSize: '0.8rem',
                            lineHeight: 1,
                            marginLeft: '4px'
                          }}
                          title="삭제"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
