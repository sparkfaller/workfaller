import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'radial-gradient(circle at center, #e0e7ff 0%, #f3f4f6 100%)',
      padding: '20px'
    }}>
      <div style={{ 
        textAlign: 'center', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        gap: '1.5rem',
        maxWidth: '600px'
      }}>
        <div style={{ position: 'relative' }}>
          <h1 style={{ 
            fontSize: 'clamp(6rem, 15vw, 10rem)', 
            margin: 0, 
            lineHeight: 0.9, 
            fontWeight: 800,
            background: 'linear-gradient(180deg, #4f46e5 0%, rgba(79, 70, 229, 0.4) 100%)', 
            WebkitBackgroundClip: 'text', 
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 30px rgba(79, 70, 229, 0.2))'
          }}>
            404
          </h1>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '120%',
            height: '40%',
            background: 'radial-gradient(circle, rgba(79, 70, 229, 0.2) 0%, transparent 70%)',
            filter: 'blur(20px)',
            zIndex: -1
          }} />
        </div>
        
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1f2937', margin: 0 }}>
          길을 잃으셨나요?
        </h2>
        
        <p style={{ color: '#6b7280', maxWidth: '400px', margin: 0, lineHeight: 1.6 }}>
          요청하신 페이지를 찾을 수 없습니다. 주소를 다시 확인하시거나 홈으로 돌아가세요.
        </p>

        <Link to="/" style={{ 
          marginTop: '1rem',
          padding: '12px 32px',
          background: '#4f46e5',
          color: 'white',
          borderRadius: '9999px',
          fontWeight: 600,
          textDecoration: 'none',
          boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(79, 70, 229, 0.4)'
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.3)'
        }}
        >
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  )
}
