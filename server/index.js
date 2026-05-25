import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import api from './api.js'
import { attachTerminal } from './terminal.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3000
const API_TOKEN = process.env.API_TOKEN?.trim()
const TERMINAL_DISABLED = process.env.TERMINAL_DISABLED === '1'

const app = express()
app.use(cors())
app.use(express.json())

// Auth bearer optionnelle (pour exposer l'API à une app mobile en sécurité)
app.use('/api', (req, res, next) => {
  if (!API_TOKEN) return next() // ouverte en dev
  if (req.path === '/health') return next()
  const auth = req.headers.authorization || ''
  if (auth === `Bearer ${API_TOKEN}`) return next()
  res.status(401).json({ error: 'Non autorisé : token Bearer manquant ou invalide' })
})

app.use('/api', api)

// En production, sert le frontend buildé
if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '..', 'dist')
  app.use(express.static(dist))
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

// Gestionnaire d'erreurs commun
app.use((err, _req, res, _next) => {
  console.error('[api error]', err.message)
  res.status(502).json({ error: err.message })
})

const server = app.listen(PORT, () => {
  console.log(`\n  Unraid Dashboard API  →  http://localhost:${PORT}/api`)
  if (process.env.NODE_ENV === 'production') {
    console.log(`  Dashboard             →  http://localhost:${PORT}`)
  } else {
    console.log(`  Frontend (vite)       →  http://localhost:5173`)
  }
  console.log(`  Auth                  →  ${API_TOKEN ? 'Bearer requis' : 'ouverte (dev)'}`)
  console.log(`  Terminal              →  ${TERMINAL_DISABLED ? 'désactivé' : 'actif (/api/terminal)'}\n`)
})

// Terminal interactif (WebSocket). Donne un shell root sur le serveur :
// fortement recommandé de définir API_TOKEN si l'app est exposée hors du LAN.
if (!TERMINAL_DISABLED) {
  attachTerminal(server, { token: API_TOKEN })
  if (!API_TOKEN) {
    console.warn(
      '  ⚠ Terminal actif sans API_TOKEN : accès shell ouvert à quiconque atteint ce port.\n',
    )
  }
}
