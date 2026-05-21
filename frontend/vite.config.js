import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In production we serve the React bundle through Django + WhiteNoise under
// `/static/`. Setting `base` here makes Vite rewrite the asset paths inside
// the generated index.html so they look like `/static/assets/xxx.js`
// instead of the default `/assets/xxx.js`. Without this, the production
// site would 404 on every bundled JS/CSS asset and fall back to the SPA
// catch-all (returning index.html as text/html for the J