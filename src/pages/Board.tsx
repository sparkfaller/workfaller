import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useUI } from '../contexts/UIContext'
import type { Post } from '../types/database.types'

export default function Board() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const { showToast, showModal } = useUI()

  useEffect(() => {
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false })

    if (error) {
      showToast('게시글을 불러오는데 실패했습니다.', 'error')
    } else {
      setPosts(data || [])
    }
    setLoading(false)
  }

  const handleCreatePost = () => {
    let title = ''
    let content = ''
    let category = 'notice'

    showModal({
      title: '새 게시글 작성',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>
          <select 
            onChange={(e) => category = e.target.value}
            defaultValue="notice"
            style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ddd' }}
          >
            <option value="notice">공지사항</option>
            <option value="announcement">발표</option>
            <option value="discussion">토론</option>
          </select>
          <input 
            placeholder="제목" 
            onChange={(e) => title = e.target.value}
            style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ddd' }}
          />
          <textarea 
            placeholder="내용" 
            onChange={(e) => content = e.target.value}
            rows={5}
            style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ddd', resize: 'vertical' }}
          />
        </div>
      ),
      confirmText: '작성',
      onConfirm: async () => {
        if (!title || !content) {
          showToast('제목과 내용을 입력해주세요.', 'error')
          return
        }
        
        const { error } = await supabase.from('posts').insert({
          title,
          content,
          category,
          author_id: user?.id
        })

        if (error) {
          showToast('게시글 작성 실패: ' + error.message, 'error')
        } else {
          showToast('게시글이 작성되었습니다.', 'success')
          fetchPosts()
        }
      }
    })
  }

  const handleDelete = async (id: string) => {
    showModal({
      title: '게시글 삭제',
      message: '정말 이 게시글을 삭제하시겠습니까?',
      type: 'confirm',
      onConfirm: async () => {
        const { error } = await supabase.from('posts').delete().eq('id', id)
        if (error) {
          showToast('삭제 실패: ' + error.message, 'error')
        } else {
          showToast('게시글이 삭제되었습니다.', 'success')
          fetchPosts()
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
        marginBottom: '30px',
        padding: '15px 30px',
        borderRadius: '16px',
        borderBottom: 'none'
      }}>
        <h1 style={{ fontSize: '1.5rem', color: '#4f46e5' }}>게시판</h1>
        <button onClick={handleCreatePost}>✏️ 글쓰기</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>로딩 중...</div>
      ) : (
        <div className="grid-layout">
          {posts.map((post) => (
            <div key={post.id} className="glass-card" style={{ padding: '25px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <span style={{ 
                  padding: '4px 8px', 
                  borderRadius: '4px', 
                  fontSize: '12px', 
                  backgroundColor: post.category === 'notice' ? '#fee2e2' : '#e0e7ff',
                  color: post.category === 'notice' ? '#ef4444' : '#4f46e5',
                  fontWeight: 'bold'
                }}>
                  {post.category === 'notice' ? '공지' : post.category === 'announcement' ? '발표' : '토론'}
                </span>
                {user?.id === post.author_id && (
                  <button 
                    onClick={() => handleDelete(post.id)}
                    style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: 'transparent', color: '#ef4444', boxShadow: 'none' }}
                  >
                    삭제
                  </button>
                )}
              </div>
              <h3 style={{ margin: '0 0 10px 0' }}>{post.title}</h3>
              <PostContent content={post.content} />
              <div style={{ fontSize: '12px', color: '#6b7280', display: 'flex', justifyContent: 'space-between' }}>
                <span>{(post as any).profiles?.full_name || '익명'}</span>
                <span>{new Date(post.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PostContent({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false)
  const maxLength = 150
  const shouldTruncate = content.length > maxLength

  return (
    <div style={{ marginBottom: '15px' }}>
      <p style={{ 
        color: '#4b5563', 
        margin: 0, 
        whiteSpace: 'pre-wrap', 
        wordBreak: 'break-word',
        lineHeight: '1.6'
      }}>
        {expanded || !shouldTruncate ? content : `${content.slice(0, maxLength)}...`}
      </p>
      {shouldTruncate && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(!expanded)
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#4f46e5',
            padding: '5px 0',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: '500'
          }}
        >
          {expanded ? '접기' : '더 보기'}
        </button>
      )}
    </div>
  )
}
