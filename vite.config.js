// [공통 파일] Vite(개발 서버·빌드) + Vitest(테스트) 설정
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    // 각 테스트 파일이 서로의 DB에 영향을 주지 않도록 파일마다 새 환경
    isolate: true,
  },
})
