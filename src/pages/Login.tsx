import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useUI } from '../contexts/UIContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, sendMagicLink, user } = useAuth()
  const { showToast } = useUI()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) {
      navigate('/dashboard')
    }
  }, [user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await signIn(email, password)
      showToast('로그인되었습니다.', 'success')
      navigate('/dashboard')
    } catch (err) {
      showToast('로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.', 'error')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleMagicLink = async () => {
    if (!email) {
      showToast('이메일을 입력해주세요.', 'error')
      return
    }
    setLoading(true)
    try {
      await sendMagicLink(email)
      showToast('로그인 링크가 이메일로 전송되었습니다. 메일함을 확인해주세요.', 'success')
    } catch (err: any) {
      showToast('전송 실패: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      padding: '20px'
    }}>
      <div className="glass-panel" style={{ 
        width: '100%', 
        maxWidth: '400px', 
        padding: '40px' 
      }}>
        <h1 style={{ 
          textAlign: 'center', 
          marginBottom: '30px',
          color: '#4f46e5',
          fontSize: '2rem'
        }}>WorkFaller</h1>
        <h2 style={{ 
          textAlign: 'center', 
          marginBottom: '30px', 
          fontSize: '1.2rem',
          color: '#4b5563'
        }}>로그인</h2>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="email" style={{ 
              display: 'block', 
              marginBottom: '8px',
              fontWeight: '500',
              color: '#374151'
            }}>
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="name@company.com"
            />
          </div>
          <div style={{ marginBottom: '25px' }}>
            <label htmlFor="password" style={{ 
              display: 'block', 
              marginBottom: '8px',
              fontWeight: '500',
              color: '#374151'
            }}>
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              marginTop: '10px'
            }}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
          <button
            type="button"
            onClick={handleMagicLink}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '14px',
              marginTop: '10px',
              background: 'transparent',
              border: '1px solid #4f46e5',
              color: '#4f46e5'
            }}
          >
            매직 링크로 로그인 (비밀번호 없이)
          </button>
        </form>
        
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <Link to="/signup" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.9rem' }}>
            계정이 없으신가요? 회원가입
          </Link>
        </div>
      </div>
    </div>
  )
}
