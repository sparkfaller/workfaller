import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useUI } from '../contexts/UIContext'

interface Message {
  id: string
  sender_id: string
  receiver_id?: string
  room_id?: string
  content: string
  created_at: string
  is_read: boolean
  file_url?: string
  file_type?: string
}

interface UserProfile {
  id: string
  full_name: string
  email: string
  avatar_url?: string
  position?: string
}

interface ChatRoom {
  id: string
  name: string
  type: 'group' | 'direct'
  created_by: string
}

export default function Messenger() {
  const { user, profile } = useAuth()
  const { showToast } = useUI()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [lastMessages, setLastMessages] = useState<Record<string, Message>>({})
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  
  // New Features State
  const [searchTerm, setSearchTerm] = useState('')
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [messageSearchIds, setMessageSearchIds] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Group Creation State
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [selectedUsersForGroup, setSelectedUsersForGroup] = useState<Set<string>>(new Set())

  // Ref to track selected user/room in subscription callback
  const selectedUserRef = useRef<string | null>(null)
  const selectedRoomRef = useRef<string | null>(null)

  useEffect(() => {
    selectedUserRef.current = selectedUser?.id || null
    selectedRoomRef.current = selectedRoom?.id || null
    
    if (selectedUser) {
      setSelectedRoom(null)
      fetchMessages(selectedUser.id, undefined)
      markAsRead(selectedUser.id)
    } else if (selectedRoom) {
      setSelectedUser(null)
      fetchMessages(undefined, selectedRoom.id)
      // Mark room as read logic here if needed
    }
  }, [selectedUser, selectedRoom])

  useEffect(() => {
    if (user && profile?.organization_id) {
      fetchUsers()
      fetchRooms()
      fetchLastMessages()
      fetchUnreadCounts()

      const handleNewMessage = (payload: any) => {
        const newMsg = payload.new as Message
        
        // 1. Update Last Messages
        const key = newMsg.room_id || (newMsg.sender_id === user.id ? newMsg.receiver_id : newMsg.sender_id)
        if (key) {
          setLastMessages(prev => ({
            ...prev,
            [key]: newMsg
          }))
        }

        // 2. Update Current Chat if open
        const currentSelectedUserId = selectedUserRef.current
        const currentSelectedRoomId = selectedRoomRef.current
        
        let shouldUpdate = false
        if (currentSelectedUserId) {
          if ((newMsg.sender_id === currentSelectedUserId && newMsg.receiver_id === user.id) || 
              (newMsg.sender_id === user.id && newMsg.receiver_id === currentSelectedUserId)) {
            shouldUpdate = true
            if (newMsg.receiver_id === user.id) markAsRead(currentSelectedUserId)
          }
        } else if (currentSelectedRoomId) {
          if (newMsg.room_id === currentSelectedRoomId) {
            shouldUpdate = true
          }
        }

        if (shouldUpdate) {
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
        }

        // 3. Update Unread Count
        if (newMsg.sender_id !== user.id && !shouldUpdate) {
          const countKey = newMsg.room_id || newMsg.sender_id
          setUnreadCounts(prev => ({
            ...prev,
            [countKey]: (prev[countKey] || 0) + 1
          }))
        }
      }

      // Subscribe to messages
      const channel = supabase
        .channel(`messages:${user.id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages'
        }, (payload) => {
           // Filter logic in client because we need to listen to both direct and room messages
           // Ideally we should use RLS to only receive what we are allowed to see
           const msg = payload.new as Message
           if (msg.receiver_id === user.id || msg.sender_id === user.id || (msg.room_id && rooms.some(r => r.id === msg.room_id))) {
             handleNewMessage(payload)
           }
        })
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [user, profile, rooms]) // Re-subscribe if rooms change to update filter logic if needed

  // Presence & Typing Subscription
  useEffect(() => {
    if (!user) return

    const channel = supabase.channel('global_presence')
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState()
        const onlineIds = new Set<string>()
        for (const id in newState) {
          // @ts-ignore
          if (newState[id][0]?.user_id) onlineIds.add(newState[id][0].user_id)
        }
        setOnlineUsers(onlineIds)
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.sender_id !== user.id) {
           setTypingUsers(prev => {
             const newSet = new Set(prev)
             if (payload.isTyping) newSet.add(payload.sender_id)
             else newSet.delete(payload.sender_id)
             return newSet
           })
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id, online_at: new Date().toISOString() })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  // Message Search Effect
  useEffect(() => {
    const searchMessages = async () => {
      if (!searchTerm.trim() || !user) {
        setMessageSearchIds(new Set())
        return
      }
      
      const { data } = await supabase
        .from('messages')
        .select('sender_id, receiver_id')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .ilike('content', `%${searchTerm}%`)
      
      if (data) {
        const ids = new Set<string>()
        data.forEach(m => {
          ids.add(m.sender_id === user.id ? m.receiver_id : m.sender_id)
        })
        setMessageSearchIds(ids)
      }
    }

    const timeoutId = setTimeout(searchMessages, 500)
    return () => clearTimeout(timeoutId)
  }, [searchTerm, user])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value)
    
    if (!user) return

    // Send typing started
    supabase.channel('global_presence').send({
      type: 'broadcast',
      event: 'typing',
      payload: { sender_id: user.id, isTyping: true }
    })

    // Clear existing timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)

    // Set timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      supabase.channel('global_presence').send({
        type: 'broadcast',
        event: 'typing',
        payload: { sender_id: user.id, isTyping: false }
      })
    }, 2000)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user || (!selectedUser && !selectedRoom)) return

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `${user.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(filePath)

      const payload: any = {
        sender_id: user.id,
        content: file.name,
        file_url: publicUrl,
        file_type: file.type
      }
      if (selectedUser) payload.receiver_id = selectedUser.id
      if (selectedRoom) payload.room_id = selectedRoom.id

      const { data, error } = await supabase
        .from('messages')
        .insert(payload)
        .select()
        .single()

      if (error) throw error

      if (data) {
        setMessages(prev => [...prev, data])
        const key = selectedRoom ? selectedRoom.id : selectedUser!.id
        setLastMessages(prev => ({ ...prev, [key]: data }))
        scrollToBottom()
      }
    } catch (error) {
      console.error('File upload error:', error)
      showToast('파일 업로드에 실패했습니다. (버킷이 존재하는지 확인해주세요)', 'error')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

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
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id},room_id.not.is.null`) // Simplified fetch, filtering in JS for now or improve query
      .order('created_at', { ascending: false })
    
    if (data) {
      const lastMsgs: Record<string, Message> = {}
      data.forEach(msg => {
        if (msg.room_id) {
           if (!lastMsgs[msg.room_id]) lastMsgs[msg.room_id] = msg
        } else {
          const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id
          if (otherId && !lastMsgs[otherId]) {
            lastMsgs[otherId] = msg
          }
        }
      })
      setLastMessages(lastMsgs)
    }
  }

  const fetchRooms = async () => {
    if (!user) return
    const { data } = await supabase
      .from('chat_room_members')
      .select('room_id, chat_rooms(*)')
      .eq('user_id', user.id)
    
    if (data) {
      const myRooms = data.map((d: any) => d.chat_rooms).filter(Boolean)
      setRooms(myRooms)
    }
  }

  const createGroup = async () => {
    if (!user || !newGroupName.trim() || selectedUsersForGroup.size === 0) return

    try {
      // 1. Create Room
      const { data: room, error: roomError } = await supabase
        .from('chat_rooms')
        .insert({ name: newGroupName, type: 'group', created_by: user.id })
        .select()
        .single()
      
      if (roomError) throw roomError

      // 2. Add Members (Self + Selected)
      const members = Array.from(selectedUsersForGroup).map(uid => ({
        room_id: room.id,
        user_id: uid
      }))
      members.push({ room_id: room.id, user_id: user.id })

      const { error: memberError } = await supabase
        .from('chat_room_members')
        .insert(members)
      
      if (memberError) throw memberError

      showToast('그룹 채팅방이 생성되었습니다.', 'success')
      setIsCreateGroupModalOpen(false)
      setNewGroupName('')
      setSelectedUsersForGroup(new Set())
      fetchRooms()
    } catch (error) {
      console.error(error)
      showToast('그룹 생성 실패', 'error')
    }
  }

  const fetchUsers = async () => {
    try {
      // Get all members of the organization directly from profiles
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, position')
        .eq('organization_id', profile?.organization_id)
        .neq('id', user?.id) // Exclude self

      if (profileError) throw profileError
      setUsers(profiles || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const fetchUnreadCounts = async () => {
    if (!user) return
    
    const { data, error } = await supabase
      .from('messages')
      .select('sender_id, room_id')
      .eq('is_read', false)
      .or(`receiver_id.eq.${user.id},room_id.not.is.null`) // Fetch potential unreads
    
    if (data) {
      const counts: Record<string, number> = {}
      data.forEach(msg => {
        // For rooms, we need to check if I've read it. 
        // Current simple logic: if I'm in the room and message is unread (global flag? No, is_read is per message)
        // Real group chat unread needs a separate table `message_reads`. 
        // For this iteration, we'll skip complex group unread counts or assume `is_read` is not used for groups yet.
        // Let's just count DMs for now to avoid complexity explosion.
        if (msg.sender_id !== user.id && !msg.room_id) {
           counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1
        }
      })
      setUnreadCounts(counts)
    }
  }

  const markAsRead = async (targetId: string) => {
    if (!user) return
    
    // Optimistic update
    setUnreadCounts(prev => ({
      ...prev,
      [targetId]: 0
    }))

    // Only mark DMs as read for now
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', targetId)
      .eq('receiver_id', user.id)
      .eq('is_read', false)
  }

  const fetchMessages = async (targetUserId?: string, targetRoomId?: string) => {
    if (!user) return
    
    // Only set loading if it's an initial fetch (not a realtime update)
    if (!targetUserId && !targetRoomId) setLoading(true)
    
    let query = supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })

    if (targetUserId) {
      query = query.or(`and(sender_id.eq.${user.id},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${user.id})`)
    } else if (targetRoomId) {
      query = query.eq('room_id', targetRoomId)
    } else {
      return
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching messages:', error)
      showToast('메시지를 불러오는데 실패했습니다.', 'error')
    } else {
      setMessages(data || [])
    }
    if (!targetUserId && !targetRoomId) setLoading(false)
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || (!selectedUser && !selectedRoom) || !user) return

    const messageContent = newMessage
    setNewMessage('') // Optimistic clear

    const payload: any = {
      sender_id: user.id,
      content: messageContent
    }

    if (selectedUser) payload.receiver_id = selectedUser.id
    if (selectedRoom) payload.room_id = selectedRoom.id

    const { data, error } = await supabase
      .from('messages')
      .insert(payload)
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
      const key = selectedRoom ? selectedRoom.id : selectedUser!.id
      setLastMessages(prev => ({
        ...prev,
        [key]: data
      }))
      
      scrollToBottom()
    }
  }

  return (
    <div className="page-container" style={{ height: 'calc(100vh - 6.25rem)', display: 'flex', flexDirection: 'column' }}>
      <div className="glass-header" style={{ marginBottom: '1.25rem', padding: '0.9375rem 1.875rem' }}>
        <h1 style={{ fontSize: '1.5rem', color: '#4f46e5', margin: 0 }}>메신저</h1>
      </div>

      <div className="glass-panel" style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: 0 }}>
        {/* User List */}
        <div style={{ width: '18.75rem', borderRight: '1px solid rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', backgroundColor: 'rgba(255,255,255,0.5)' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 'bold', color: '#374151' }}>채팅 목록</div>
              <button 
                onClick={() => setIsCreateGroupModalOpen(true)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#4f46e5' }}
                title="그룹 만들기"
              >
                +
              </button>
            </div>
            <input 
              placeholder="이름 검색..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb', width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* Rooms Section */}
            {rooms.length > 0 && (
              <div style={{ padding: '10px 20px', fontSize: '0.8rem', fontWeight: 'bold', color: '#9ca3af' }}>그룹 채팅</div>
            )}
            {rooms.map(room => {
              const lastMsg = lastMessages[room.id]
              return (
                <div
                  key={room.id}
                  onClick={() => setSelectedRoom(room)}
                  style={{
                    padding: '0.9375rem 1.25rem',
                    cursor: 'pointer',
                    backgroundColor: selectedRoom?.id === room.id ? 'rgba(79, 70, 229, 0.1)' : 'transparent',
                    borderLeft: selectedRoom?.id === room.id ? '0.25rem solid #4f46e5' : '0.25rem solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem'
                  }}
                >
                  <div style={{ 
                    width: '2.5rem', 
                    height: '2.5rem', 
                    borderRadius: '8px', 
                    backgroundColor: '#e0e7ff', 
                    color: '#4f46e5',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    flexShrink: 0
                  }}>
                    G
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <div style={{ fontWeight: '600', color: '#374151' }}>{room.name}</div>
                      {lastMsg && (
                        <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                          {new Date(lastMsg.created_at).toLocaleDateString() === new Date().toLocaleDateString() 
                            ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : new Date(lastMsg.created_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                        {lastMsg ? lastMsg.content : '대화가 없습니다.'}
                      </div>
                      {unreadCounts[room.id] > 0 && (
                        <div style={{ 
                          backgroundColor: '#ef4444', 
                          color: 'white', 
                          fontSize: '0.7rem', 
                          fontWeight: 'bold', 
                          minWidth: '1.125rem', 
                          height: '1.125rem', 
                          borderRadius: '0.5625rem', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          padding: '0 0.3125rem',
                          marginLeft: '0.5rem'
                        }}>
                          {unreadCounts[room.id]}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Users Section */}
            <div style={{ padding: '10px 20px', fontSize: '0.8rem', fontWeight: 'bold', color: '#9ca3af', marginTop: '10px' }}>대화 상대</div>
            {users
              .filter(u => {
                const term = searchTerm.toLowerCase()
                const nameMatch = (u.full_name || '').toLowerCase().includes(term)
                const emailMatch = (u.email || '').toLowerCase().includes(term)
                const msgMatch = messageSearchIds.has(u.id)
                return nameMatch || emailMatch || msgMatch
              })
              .sort((a, b) => {
               const msgA = lastMessages[a.id]
               const msgB = lastMessages[b.id]
               if (!msgA && !msgB) return 0
               if (!msgA) return 1
               if (!msgB) return -1
               return new Date(msgB.created_at).getTime() - new Date(msgA.created_at).getTime()
            }).map(u => {
              const lastMsg = lastMessages[u.id]
              const isOnline = onlineUsers.has(u.id)
              return (
              <div
                key={u.id}
                onClick={() => setSelectedUser(u)}
                style={{
                  padding: '0.9375rem 1.25rem',
                  cursor: 'pointer',
                  backgroundColor: selectedUser?.id === u.id ? 'rgba(79, 70, 229, 0.1)' : 'transparent',
                  borderLeft: selectedUser?.id === u.id ? '0.25rem solid #4f46e5' : '0.25rem solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem'
                }}
              >
                <div style={{ position: 'relative' }}>
                  <div style={{ 
                    width: '2.5rem', 
                    height: '2.5rem', 
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
                  {isOnline && (
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: '#10b981',
                      border: '2px solid white'
                    }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ fontWeight: '600', color: '#374151' }}>
                      {u.full_name || '이름 없음'}
                      {u.position && <span style={{ fontSize: '0.8rem', color: '#6b7280', marginLeft: '0.375rem', fontWeight: 'normal' }}>{u.position}</span>}
                    </div>
                    {lastMsg && (
                      <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                        {new Date(lastMsg.created_at).toLocaleDateString() === new Date().toLocaleDateString() 
                          ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : new Date(lastMsg.created_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                      {typingUsers.has(u.id) ? <span style={{ color: '#4f46e5' }}>입력 중...</span> : (lastMsg ? lastMsg.content : u.email)}
                    </div>
                    {unreadCounts[u.id] > 0 && (
                      <div style={{ 
                        backgroundColor: '#ef4444', 
                        color: 'white', 
                        fontSize: '0.7rem', 
                        fontWeight: 'bold', 
                        minWidth: '1.125rem', 
                        height: '1.125rem', 
                        borderRadius: '0.5625rem', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        padding: '0 0.3125rem',
                        marginLeft: '0.5rem'
                      }}>
                        {unreadCounts[u.id]}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )})}
          </div>
        </div>

        {/* Chat Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'rgba(255,255,255,0.3)' }}>
          {selectedUser || selectedRoom ? (
            <>
              <div style={{ padding: '0.9375rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.1)', backgroundColor: 'rgba(255,255,255,0.5)', fontWeight: 'bold', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>{selectedUser ? selectedUser.full_name : selectedRoom?.name}</span>
                {selectedUser?.position && <span style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: 'normal' }}>{selectedUser.position}</span>}
                {selectedUser && typingUsers.has(selectedUser.id) && <span style={{ fontSize: '0.8rem', color: '#4f46e5', marginLeft: 'auto' }}>입력 중...</span>}
              </div>
              
              <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {messages.map((msg, index) => {
                  const isMe = msg.sender_id === user?.id
                  const showDateDivider = index === 0 || new Date(msg.created_at).toDateString() !== new Date(messages[index - 1].created_at).toDateString()
                  
                  return (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                      {showDateDivider && (
                        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0' }}>
                          <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }}></div>
                          <div style={{ padding: '0 10px', fontSize: '0.8rem', color: '#9ca3af' }}>
                            {new Date(msg.created_at).toLocaleDateString()}
                          </div>
                          <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }}></div>
                        </div>
                      )}
                      <div style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                        {/* Show sender name in group chat if not me */}
                        {selectedRoom && !isMe && (
                          <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '2px', marginLeft: '4px' }}>
                            {users.find(u => u.id === msg.sender_id)?.full_name || '알 수 없음'}
                          </div>
                        )}
                        <div style={{ 
                          padding: '0.625rem 0.9375rem', 
                          borderRadius: '0.75rem', 
                          backgroundColor: isMe ? '#4f46e5' : 'white',
                          color: isMe ? 'white' : '#374151',
                          boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.05)',
                          borderTopRightRadius: isMe ? '0.125rem' : '0.75rem',
                          borderTopLeftRadius: isMe ? '0.75rem' : '0.125rem'
                        }}>
                          {msg.file_url ? (
                            msg.file_type?.startsWith('image/') ? (
                              <img 
                                src={msg.file_url} 
                                alt="attached" 
                                style={{ maxWidth: '200px', borderRadius: '8px', cursor: 'pointer' }}
                                onClick={() => window.open(msg.file_url, '_blank')}
                              />
                            ) : (
                              <a 
                                href={msg.file_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ color: isMe ? 'white' : '#4f46e5', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: '5px' }}
                              >
                                📎 {msg.content}
                              </a>
                            )
                          ) : (
                            msg.content
                          )}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.25rem', textAlign: isMe ? 'right' : 'left' }}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSendMessage} style={{ padding: '1.25rem', backgroundColor: 'white', borderTop: '1px solid rgba(0,0,0,0.1)', display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #e5e7eb',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    color: '#6b7280'
                  }}
                  title="파일 첨부"
                >
                  📎
                </button>
                <input
                  value={newMessage}
                  onChange={handleInputChange}
                  placeholder="메시지를 입력하세요..."
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}
                />
                <button 
                  type="submit"
                  disabled={!newMessage.trim()}
                  style={{ 
                    padding: '0 1.25rem', 
                    borderRadius: '0.5rem', 
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

      {/* Create Group Modal */}
      {isCreateGroupModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ backgroundColor: 'white', padding: '1.25rem', borderRadius: '0.75rem', width: '25rem', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ marginTop: 0 }}>그룹 만들기</h2>
            <input
              placeholder="그룹 이름"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              style={{ padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb', marginBottom: '0.9375rem' }}
            />
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '0.375rem', padding: '0.625rem', marginBottom: '0.9375rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(7.5rem, 1fr))', gap: '0.625rem' }}>
              {users.map(u => {
                const isSelected = selectedUsersForGroup.has(u.id)
                return (
                  <div 
                    key={u.id} 
                    onClick={() => {
                      const newSet = new Set(selectedUsersForGroup)
                      if (isSelected) newSet.delete(u.id)
                      else newSet.add(u.id)
                      setSelectedUsersForGroup(newSet)
                    }}
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      alignItems: 'center', 
                      justifyContent: 'center',
                      padding: '0.625rem',
                      borderRadius: '0.5rem',
                      border: isSelected ? '1px solid #3b82f6' : '1px solid #e5e7eb',
                      backgroundColor: isSelected ? '#eff6ff' : 'white',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#374151' }}>{u.full_name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{u.position || '직급 없음'}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.625rem' }}>
              <button onClick={() => setIsCreateGroupModalOpen(false)} style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer' }}>취소</button>
              <button onClick={createGroup} style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none', background: '#4f46e5', color: 'white', cursor: 'pointer' }}>생성</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
