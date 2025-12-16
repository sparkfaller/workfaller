import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useUI } from '../contexts/UIContext'
import type { DriveFile } from '../types/database.types'

export default function Drive() {
  const { folderId } = useParams<{ folderId: string }>()
  const { user } = useAuth()
  const { showToast, showModal } = useUI()
  const navigate = useNavigate()
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [currentFolder, setCurrentFolder] = useState<DriveFile | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchFiles()
    if (folderId) {
      fetchCurrentFolder()
    } else {
      setCurrentFolder(null)
    }
  }, [folderId])

  const fetchCurrentFolder = async () => {
    if (!folderId) return
    const { data, error } = await supabase
      .from('drive_files')
      .select('*')
      .eq('id', folderId)
      .single()
    
    if (error) {
      console.error('Error fetching folder:', error)
    } else {
      setCurrentFolder(data)
    }
  }

  const fetchFiles = async () => {
    setLoading(true)
    let query = supabase
      .from('drive_files')
      .select('*')
      .order('is_folder', { ascending: false })
      .order('name', { ascending: true })

    if (folderId) {
      query = query.eq('parent_id', folderId)
    } else {
      query = query.is('parent_id', null)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching files:', error)
    } else {
      setFiles(data || [])
    }
    setLoading(false)
  }

  const handleCreateFolder = async () => {
    showModal({
      title: '새 폴더 생성',
      message: '폴더 이름을 입력하세요:',
      type: 'prompt',
      confirmText: '생성',
      onConfirm: async (name) => {
        if (!name || !user) return

        const { error } = await supabase.from('drive_files').insert({
          name,
          is_folder: true,
          parent_id: folderId || null,
          owner_id: user.id,
          type: 'folder'
        })

        if (error) {
          showToast('폴더 생성 실패: ' + error.message, 'error')
        } else {
          showToast('폴더가 생성되었습니다.', 'success')
          fetchFiles()
        }
      }
    })
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user) return

    setUploading(true)
    const file = e.target.files[0]
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random()}.${fileExt}`
    const filePath = `${user.id}/${fileName}`

    try {
      // 1. Storage에 파일 업로드
      const { error: uploadError } = await supabase.storage
        .from('drive')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // 2. DB에 메타데이터 저장
      const { error: dbError } = await supabase.from('drive_files').insert({
        name: file.name,
        size: file.size,
        type: file.type,
        path: filePath,
        parent_id: folderId || null,
        is_folder: false,
        owner_id: user.id
      })

      if (dbError) throw dbError

      showToast('파일이 업로드되었습니다.', 'success')
      fetchFiles()
    } catch (error: any) {
      showToast('파일 업로드 실패: ' + error.message, 'error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDownload = async (file: DriveFile) => {
    if (!file.path) return

    try {
      const { data, error } = await supabase.storage
        .from('drive')
        .download(file.path)

      if (error) throw error

      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error: any) {
      showToast('다운로드 실패: ' + error.message, 'error')
    }
  }

  const handleDelete = async (file: DriveFile) => {
    showModal({
      title: '파일 삭제',
      message: `'${file.name}'을(를) 삭제하시겠습니까?`,
      type: 'confirm',
      confirmText: '삭제',
      onConfirm: async () => {
        try {
          if (!file.is_folder && file.path) {
            // 파일인 경우 Storage에서도 삭제
            const { error: storageError } = await supabase.storage
              .from('drive')
              .remove([file.path])
            
            if (storageError) throw storageError
          }

          // DB에서 삭제 (폴더인 경우 CASCADE로 하위 항목도 삭제됨)
          const { error: dbError } = await supabase
            .from('drive_files')
            .delete()
            .eq('id', file.id)

          if (dbError) throw dbError

          showToast('삭제되었습니다.', 'success')
          fetchFiles()
        } catch (error: any) {
          showToast('삭제 실패: ' + error.message, 'error')
        }
      }
    })
  }

  const formatSize = (bytes?: number) => {
    if (bytes === undefined) return '-'
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link to="/dashboard" style={{ textDecoration: 'none', color: '#6b7280', fontSize: '1.2rem' }}>🏠</Link>
          <span style={{ color: '#9ca3af' }}>/</span>
          <Link to="/drive" style={{ 
            textDecoration: 'none', 
            color: folderId ? '#6b7280' : '#4f46e5', 
            fontWeight: folderId ? 'normal' : 'bold' 
          }}>드라이브</Link>
          {currentFolder && (
            <>
              <span style={{ color: '#9ca3af' }}>/</span>
              <span style={{ fontWeight: 'bold', color: '#4f46e5' }}>{currentFolder.name}</span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={handleCreateFolder}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: 'rgba(255, 255, 255, 0.5)', 
              color: '#374151',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              backdropFilter: 'blur(4px)'
            }}
          >
            📁 새 폴더
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{ padding: '10px 20px' }}
          >
            {uploading ? '업로드 중...' : '📤 파일 업로드'}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'white' }}>로딩 중...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '20px' }}>
          {folderId && (
            <div 
              className="glass-card"
              onClick={() => navigate(currentFolder?.parent_id ? `/drive/${currentFolder.parent_id}` : '/drive')}
              style={{ 
                padding: '20px', 
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '160px',
                background: 'rgba(255, 255, 255, 0.2)'
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>⤴️</div>
              <div style={{ textAlign: 'center', color: '#4b5563', fontWeight: '500' }}>상위 폴더</div>
            </div>
          )}
          
          {files.length === 0 && !folderId && (
            <div className="glass-panel" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px', color: '#4b5563' }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>📭</div>
              <h3>파일이 없습니다</h3>
              <p>새 폴더를 만들거나 파일을 업로드하여 시작하세요.</p>
            </div>
          )}

          {files.map((file) => (
            <div 
              key={file.id}
              className="glass-card"
              style={{ 
                padding: '20px', 
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                minHeight: '160px'
              }}
              onClick={() => {
                if (file.is_folder) {
                  navigate(`/drive/${file.id}`)
                } else {
                  handleDownload(file)
                }
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>
                {file.is_folder ? '📁' : '📄'}
              </div>
              <div style={{ 
                textAlign: 'center', 
                wordBreak: 'break-all', 
                fontWeight: '600', 
                fontSize: '14px',
                color: '#374151',
                width: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}>
                {file.name}
              </div>
              {!file.is_folder && (
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px' }}>
                  {formatSize(file.size)}
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(file)
                }}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  background: 'transparent',
                  border: 'none',
                  padding: '4px',
                  boxShadow: 'none',
                  color: '#ef4444',
                  opacity: 0.6,
                  minWidth: 'auto'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
