import React from 'react'
import ReactDOM from 'react-dom/client'
import { Auth0Provider } from '@auth0/auth0-react'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Auth0Provider
      domain="dev-x4vn1xnajg1ucyjl.us.auth0.com" // Replace with your Auth0 domain
      clientId="qiuwiFy3UauKnf8nxMbTrOQrSI3ZUN47" // Replace with your Auth0 client ID
      authorizationParams={{
        redirect_uri: window.location.origin,
      }}
    >
      <App />
    </Auth0Provider>
  </React.StrictMode>,
)
