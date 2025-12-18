import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUI } from '../contexts/UIContext'

export default function Signup() {
  const navigate = useNavigate()
  const { showToast } = useUI()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  
  // Password Strength State
  const [passwordStrength, setPasswordStrength] = useState(0) // 0: None, 1: Weak, 2: Medium, 3: Strong

  useEffect(() => {
    calculatePasswordStrength(password)
  }, [password])

  const calculatePasswordStrength = (pwd: string) => {
    if (!pwd) {
      setPasswordStrength(0)
      return
    }
    let score = 0
    if (pwd.length >= 8) score++
    if (/[0-9]/.test(pwd)) score++
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) score++
    if (/[A-Z]/.test(pwd)) score++
    
    // Normalize to 1-3
    if (score <= 1) setPasswordStrength(1)
    else if (score <= 3) setPasswordStrength(2)
    else setPasswordStrength(3)
  }

  const getStrengthLabel = () => {
    switch (passwordStrength) {
      case 1: return { text: '약함', color: '#ef4444', width: '33%' }
      case 2: return { text: '보통', color: '#f59e0b', width: '66%' }
      case 3: return { text: '강함', color: '#10b981', width: '100%' }
      default: return { text: '', color: '#e5e7eb', width: '0%' }
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (passwordStrength < 2) {
        throw new Error('비밀번호가 너무 약합니다. 8자 이상, 숫자/특수문자를 포함해주세요.')
      }

      // 1. Sign up user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (authError) throw authError

      if (authData.user) {
        // 2. Create Profile Only (No Org)
        const { error: rpcError } = await supabase.rpc('complete_signup_v2', {
          p_user_id: authData.user.id,
          p_user_email: email,
          p_user_full_name: fullName
        })

        if (rpcError) throw rpcError

        showToast('회원가입이 완료되었습니다. 로그인해주세요.', 'success')
        navigate('/login')
      }
    } catch (error: any) {
      showToast('회원가입 실패: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const strength = getStrengthLabel()

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      padding: '1.25rem'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '25rem',
        padding: '2.5rem',
        borderRadius: '1.5rem'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '1.875rem' }}>
          <h1 style={{ fontSize: '2rem', color: '#4f46e5', marginBottom: '0.625rem' }}>Workfaller</h1>
          <p style={{ color: '#6b7280' }}>새로운 계정을 생성하세요</p>
        </div>

        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#374151', fontSize: '0.9rem' }}>이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="glass-input"
              placeholder="name@company.com"
              required
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#374151', fontSize: '0.9rem' }}>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="glass-input"
              placeholder="••••••••"
              required
              style={{ width: '100%' }}
            />
            {/* Password Strength Meter */}
            {password && (
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ 
                  height: '0.25rem', 
                  background: '#e5e7eb', 
                  borderRadius: '0.125rem', 
                  overflow: 'hidden',
                  marginBottom: '0.25rem'
                }}>
                  <div style={{ 
                    height: '100%', 
                    width: strength.width, 
                    background: strength.color, 
                    transition: 'all 0.3s ease' 
                  }} />
                </div>
                <span style={{ fontSize: '0.8rem', color: strength.color }}>
                  보안 수준: {strength.text}
                </span>
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#374151', fontSize: '0.9rem' }}>이름</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="glass-input"
              placeholder="홍길동"
              required
              style={{ width: '100%' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="glass-button"
            style={{
              marginTop: '0.625rem',
              background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
              color: 'white',
              border: 'none'
            }}
          >
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.9rem', color: '#6b7280' }}>
          이미 계정이 있으신가요?{' '}
          <Link to="/login" style={{ color: '#4f46e5', textDecoration: 'none', fontWeight: 600 }}>
            로그인
          </Link>
        </div>
      </div>
    </div>
  )
}
