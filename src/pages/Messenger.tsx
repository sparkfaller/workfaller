import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useUI } from '../contexts/UIContext'

interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
  is_read: boolean
}

interface UserProfile {
  id: string
  full_name: string
  email: string
  avatar_url?: string
}

export default function Messenger() {
  const { user, profile } = useAuth()
  const { showToast } = useUI()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [lastMessages, setLastMessages] = useState<Record<string, Message>>({})
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  
  // Ref to track selected user in subscription callback
  const selectedUserRef = useRef<string | null>(null)

  useEffect(() => {
    selectedUserRef.current = selectedUser?.id || null
    if (selectedUser) {
      fetchMessages()
    }
  }, [selectedUser])

  useEffect(() => {
    if (user && profile?.organization_id) {
      fetchUsers()
      fetchLastMessages()

      const handleNewMessage = (payload: any) => {
        const newMsg = payload.new as Message
        
        // 1. Update Last Messages
        const otherId = newMsg.sender_id === user.id ? newMsg.receiver_id : newMsg.sender_id
        setLastMessages(prev => ({
          ...prev,
          [otherId]: newMsg
        }))

        // 2. Update Current Chat if open
        const currentSelectedId = selectedUserRef.current
        if (currentSelectedId) {
          // Check if the message involves the currently selected user
          if (newMsg.sender_id === currentSelectedId || newMsg.receiver_id === currentSelectedId) {
            // Optimistically update first
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev
              return [...prev, newMsg]
            })
            
            // Then re-fetch to ensure consistency (optional but safer)
            // fetchMessages(currentSelectedId) 
          }
        }
      }

      // Subscribe to messages where I am the receiver OR the sender
      const channel = supabase
        .channel(`messages:${user.id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`
        }, handleNewMessage)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `sender_id=eq.${user.id}`
        }, handleNewMessage)
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [user, profile])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchLastMessages = async () => {
    if (!user) return
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
    
    if (data) {
      const lastMsgs: Record<string, Message> = {}
      data.forEach(msg => {
        const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id
        if (!lastMsgs[otherId]) {
          lastMsgs[otherId] = msg
        }
      })
      setLastMessages(lastMsgs)
    }
  }

  const fetchUsers = async () => {
    try {
      // Get all members of the organization directly from profiles
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .eq('organization_id', profile?.organization_id)
        .neq('id', user?.id) // Exclude self

      if (profileError) throw profileError
      setUsers(profiles || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const fetchMessages = async (targetUserId?: string) => {
    const targetId = targetUserId || selectedUser?.id
    if (!targetId || !user) return
    
    // Only set loading if it's an initial fetch (not a realtime update)
    if (!targetUserId) setLoading(true)
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching messages:', error)
      if (!targetUserId) showToast('메시지를 불러오는데 실패했습니다.', 'error')
    } else {
      setMessages(data || [])
    }
    if (!targetUserId) setLoading(false)
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedUser || !user) return

    const messageContent = newMessage
    setNewMessage('') // Optimistic clear

    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: user.id,
        receiver_id: selectedUser.id,
        content: messageContent
      })
      .select()
      .single()

    if (error) {
      showToast('메시지 전송 실패', 'error')
      setNewMessage(messageContent) // Restore if failed
    } else if (data) {
      // Optimistic update is handled by subscription now, but to be instant:
      setMessages(prev => {
        if (prev.some(m => m.id === data.id)) return prev
        return [...prev, data]
      })
      
      // Also update last message immediately
      setLastMessages(prev => ({
        ...prev,
        [selectedUser.id]: data
      }))
      
      scrollToBottom()
    }
  }

  return (
    <div className="page-container" style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      <div className="glass-header" style={{ marginBottom: '20px', padding: '15px 30px' }}>
        <h1 style={{ fontSize: '1.5rem', color: '#4f46e5', margin: 0 }}>메신저</h1>
      </div>

      <div className="glass-panel" style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: 0 }}>
        {/* User List */}
        <div style={{ width: '300px', borderRight: '1px solid rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', backgroundColor: 'rgba(255,255,255,0.5)' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid rgba(0,0,0,0.1)', fontWeight: 'bold', color: '#374151' }}>
            대화 상대 ({users.length})
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {users.sort((a, b) => {
               const msgA = lastMessages[a.id]
               const msgB = lastMessages[b.id]
               if (!msgA && !msgB) return 0
               if (!msgA) return 1
               if (!msgB) return -1
               return new Date(msgB.created_at).getTime() - new Date(msgA.created_at).getTime()
            }).map(u => {
              const lastMsg = lastMessages[u.id]
              return (
              <div
                key={u.id}
                onClick={() => setSelectedUser(u)}
                style={{
                  padding: '15px 20px',
                  cursor: 'pointer',
                  backgroundColor: selectedUser?.id === u.id ? 'rgba(79, 70, 229, 0.1)' : 'transparent',
                  borderLeft: selectedUser?.id === u.id ? '4px solid #4f46e5' : '4px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <div style={{ 
                  width: '40px', 
                  height: '40px', 
                  borderRadius: '50%', 
                  backgroundColor: '#e0e7ff', 
                  color: '#4f46e5',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  flexShrink: 0
                }}>
                  {u.full_name?.[0] || u.email?.[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ fontWeight: '600', color: '#374151' }}>{u.full_name || '이름 없음'}</div>
                    {lastMsg && (
                      <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                        {new Date(lastMsg.created_at).toLocaleDateString() === new Date().toLocaleDateString() 
                          ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : new Date(lastMsg.created_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {lastMsg ? lastMsg.content : u.email}
                  </div>
                </div>
              </div>
            )})}
          </div>
        </div>

        {/* Chat Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'rgba(255,255,255,0.3)' }}>
          {selectedUser ? (
            <>
              <div style={{ padding: '15px 20px', borderBottom: '1px solid rgba(0,0,0,0.1)', backgroundColor: 'rgba(255,255,255,0.5)', fontWeight: 'bold' }}>
                {selectedUser.full_name}님과의 대화
              </div>
              
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {messages.map(msg => {
                  const isMe = msg.sender_id === user?.id
                  return (
                    <div key={msg.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                      <div style={{ 
                        padding: '10px 15px', 
                        borderRadius: '12px', 
                        backgroundColor: isMe ? '#4f46e5' : 'white',
                        color: isMe ? 'white' : '#374151',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        borderTopRightRadius: isMe ? '2px' : '12px',
                        borderTopLeftRadius: isMe ? '12px' : '2px'
                      }}>
                        {msg.content}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '4px', textAlign: isMe ? 'right' : 'left' }}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSendMessage} style={{ padding: '20px', backgroundColor: 'white', borderTop: '1px solid rgba(0,0,0,0.1)', display: 'flex', gap: '10px' }}>
                <input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="메시지를 입력하세요..."
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <button 
                  type="submit"
                  disabled={!newMessage.trim()}
                  style={{ 
                    padding: '0 20px', 
                    borderRadius: '8px', 
                    border: 'none', 
                    backgroundColor: '#4f46e5', 
                    color: 'white', 
                    fontWeight: '600',
                    cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
                    opacity: newMessage.trim() ? 1 : 0.7
                  }}
                >
                  전송
                </button>
              </form>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
              대화 상대를 선택해주세요.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
