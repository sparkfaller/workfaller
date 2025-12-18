import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (error: any) {
  console.error('Failed to render app:', error)
  document.body.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; padding: 20px; text-align: center; font-family: sans-serif;">
      <h1 style="color: #ef4444;">애플리케이션 로드 실패</h1>
      <p style="color: #374151; max-width: 500px;">
        앱을 시작하는 도중 오류가 발생했습니다.<br/>
        환경 변수 설정이 올바른지 확인해주세요.
      </p>
      <pre style="background: #f3f4f6; padding: 15px; border-radius: 8px; color: #ef4444; overflow-x: auto; max-width: 100%; text-align: left;">
        ${error?.message || JSON.stringify(error)}
      </pre>
    </div>
  `
}
