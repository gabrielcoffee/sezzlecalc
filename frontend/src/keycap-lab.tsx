// Entry for the dev-only keycap lab. Open http://localhost:5173/keycap-lab.html
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { KeycapLab } from '@/components/calculator/KeycapLab'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <KeycapLab />
  </StrictMode>,
)
