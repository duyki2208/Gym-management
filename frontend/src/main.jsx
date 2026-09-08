import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Chặn lỗi rác từ bug của Chrome DevTools Live Metrics (Chromium Issue #555794190: reportAllChanges - reading 'startTime')
window.addEventListener('error', (event) => {
  if (
    event.message?.includes("reading 'startTime'") ||
    event.error?.stack?.includes('reportAllChanges')
  ) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
