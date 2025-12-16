import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

interface ModalOptions {
  title: string
  message?: string
  content?: ReactNode
  type?: 'alert' | 'confirm' | 'prompt'
  onConfirm?: (value?: string) => void
  onCancel?: () => void
  confirmText?: string
  cancelText?: string
}

interface UIContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
  showModal: (options: ModalOptions) => void
  closeModal: () => void
}

const UIContext = createContext<UIContextType | undefined>(undefined)

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [modal, setModal] = useState<ModalOptions | null>(null)
  const [promptValue, setPromptValue] = useState('')

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  const showModal = useCallback((options: ModalOptions) => {
    setModal(options)
    setPromptValue('')
  }, [])

  const closeModal = useCallback(() => {
    setModal(null)
    setPromptValue('')
  }, [])

  return (
    <UIContext.Provider value={{ showToast, showModal, closeModal }}>
      {children}
      
      {/* Toast Container */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {toasts.map((toast) => (
          <div key={toast.id} className="glass-card" style={{
            padding: '12px 24px',
            backgroundColor: toast.type === 'error' ? 'rgba(239, 68, 68, 0.9)' : 
                           toast.type === 'success' ? 'rgba(16, 185, 129, 0.9)' : 
                           'rgba(59, 130, 246, 0.9)',
            color: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            animation: 'slideIn 0.3s ease-out',
            minWidth: '200px'
          }}>
            {toast.message}
          </div>
        ))}
      </div>

      {/* Modal Container */}
      {modal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div className="glass-panel" style={{
            padding: '30px',
            width: '90%',
            maxWidth: '400px',
            backgroundColor: 'white'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px' }}>{modal.title}</h3>
            {modal.message && <p style={{ marginBottom: '20px', color: '#4b5563' }}>{modal.message}</p>}
            {modal.content}
            
            {modal.type === 'prompt' && (
              <input
                type="text"
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                style={{ marginBottom: '20px', width: '100%' }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    modal.onConfirm?.(promptValue)
                    closeModal()
                  }
                }}
              />
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              {modal.type !== 'alert' && (
                <button
                  onClick={() => {
                    modal.onCancel?.()
                    closeModal()
                  }}
                  style={{
                    backgroundColor: '#e5e7eb',
                    color: '#374151'
                  }}
                >
                  {modal.cancelText || '취소'}
                </button>
              )}
              <button
                onClick={() => {
                  modal.onConfirm?.(modal.type === 'prompt' ? promptValue : undefined)
                  closeModal()
                }}
              >
                {modal.confirmText || '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </UIContext.Provider>
  )
}

export function useUI() {
  const context = useContext(UIContext)
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider')
  }
  return context
}
