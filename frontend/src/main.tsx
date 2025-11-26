import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { initSentry } from './lib/sentry-config'

initSentry().catch((error) => {

})

// StrictMode disabled in production to avoid double renders and improve performance
const AppRoot = (
  <BrowserRouter>
    <App />
  </BrowserRouter>
)

ReactDOM.createRoot(document.getElementById('root')!).render(
  import.meta.env.DEV ? (
    <React.StrictMode>
      {AppRoot}
    </React.StrictMode>
  ) : (
    AppRoot
  ),
)
