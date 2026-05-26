import { WebSocketServer } from 'ws'
import { spawn, execFile } from 'node:child_process'
import { readlinkSync, readFileSync, readdirSync, existsSync } from 'node:fs'
import { HOST_ACCESS, systemShellExec, dockerConsoleExec } from './host.js'

// ---------------------------------------------------------------------------
// Terminal interactif (vrai PTY) sans module natif.
//
// node-pty exige une compilation native (python + gcc) absente d'Unraid. On
// contourne via la commande système `script` (util-linux) qui alloue un vrai
// pseudo-terminal noyau : top/htop/nano, couleurs et signaux fonctionnent.
//   script -qfc "<cmd>" /dev/null   →  lance <cmd> dans un PTY, I/O sur stdio.
// Le resize se fait en retrouvant le /dev/pts/N de l'enfant puis
// `stty -F /dev/pts/N rows R cols C` (qui émet SIGWINCH au groupe au premier plan).
// ---------------------------------------------------------------------------

const DEFAULT_COLS = 80
const DEFAULT_ROWS = 24

function startDir() {
  const c = process.env.TERMINAL_CWD?.trim()
  if (c && existsSync(c)) return c
  if (existsSync('/mnt/user')) return '/mnt/user'
  return process.env.HOME || '/'
}

/** Retrouve le /dev/pts/N de l'enfant direct du process `script`. */
function findPts(scriptPid) {
  let pids
  try {
    pids = readdirSync('/proc').filter((n) => /^\d+$/.test(n))
  } catch {
    return null
  }
  for (const pid of pids) {
    let ppid
    try {
      const status = readFileSync(`/proc/${pid}/status`, 'utf8')
      ppid = status.match(/^PPid:\s*(\d+)/m)?.[1]
    } catch {
      continue
    }
    if (ppid !== String(scriptPid)) continue
    try {
      const tty = readlinkSync(`/proc/${pid}/fd/0`)
      if (tty.startsWith('/dev/pts/')) return tty
    } catch {
      /* ignore */
    }
  }
  return null
}

/** Tente de récupérer le pts pendant ~1,5 s (le shell met un instant à démarrer). */
function resolvePts(scriptPid, onFound) {
  let tries = 0
  const tick = () => {
    const pts = findPts(scriptPid)
    if (pts) return onFound(pts)
    if (++tries < 15) setTimeout(tick, 100)
  }
  tick()
}

// Shells actifs : permet de tout tuer si le serveur s'arrête (sinon les PTY
// survivent, ex. à chaque redémarrage de `node --watch` en dev).
const children = new Set()
let shutdownHooked = false
function hookShutdown() {
  if (shutdownHooked) return
  shutdownHooked = true
  const killAll = () => {
    for (const c of children) {
      try {
        c.kill('SIGKILL')
      } catch {
        /* ignore */
      }
    }
  }
  process.on('exit', killAll)
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      killAll()
      process.exit(0)
    })
  }
}

function spawnShell(cols, rows, containerName) {
  // Taille initiale appliquée avant de céder la main au shell/conteneur.
  const stty = `stty rows ${rows} cols ${cols} 2>/dev/null; `
  let startup, cwd
  if (containerName) {
    startup = stty + dockerConsoleExec(containerName)
    cwd = '/'
  } else {
    startup = stty + systemShellExec()
    // En mode hôte, le cwd cible (/mnt/user) n'existe pas dans le conteneur :
    // on démarre `script` à la racine du conteneur, le `cd` se fait après nsenter.
    cwd = HOST_ACCESS ? '/' : startDir()
  }
  const child = spawn('script', ['-qfc', startup, '/dev/null'], {
    cwd,
    env: { ...process.env, TERM: 'xterm-256color' },
  })
  children.add(child)
  child.once('exit', () => children.delete(child))
  return child
}

function handleConnection(ws, req) {
  let cols = DEFAULT_COLS
  let rows = DEFAULT_ROWS
  let containerName = null
  try {
    const url = new URL(req.url, 'http://localhost')
    const c = url.searchParams.get('container')
    if (c && /^[a-zA-Z0-9_.\-]+$/.test(c)) containerName = c
  } catch { /* ignore */ }
  const child = spawnShell(cols, rows, containerName)
  let ptsPath = null
  let alive = true

  resolvePts(child.pid, (pts) => {
    ptsPath = pts
    resize(cols, rows) // applique la taille réelle dès qu'on connaît le pts
  })

  function resize(c, r) {
    cols = c
    rows = r
    if (!ptsPath) return
    execFile('stty', ['-F', ptsPath, 'rows', String(r), 'cols', String(c)], () => {})
  }

  const send = (data) => {
    if (ws.readyState === ws.OPEN) ws.send(data)
  }
  child.stdout.on('data', send)
  child.stderr.on('data', send)

  child.on('exit', () => {
    alive = false
    if (ws.readyState === ws.OPEN) ws.close()
  })

  ws.on('message', (raw) => {
    let msg
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }
    if (msg.type === 'i' && alive) {
      child.stdin.write(msg.d)
    } else if (msg.type === 'r' && typeof msg.c === 'number' && typeof msg.r === 'number') {
      resize(Math.max(1, msg.c | 0), Math.max(1, msg.r | 0))
    }
  })

  const cleanup = () => {
    if (!alive) return
    alive = false
    try {
      child.kill('SIGHUP')
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      try {
        child.kill('SIGKILL')
      } catch {
        /* ignore */
      }
    }, 1500)
  }
  ws.on('close', cleanup)
  ws.on('error', cleanup)
}

/**
 * Attache le terminal WebSocket sur /api/terminal au serveur HTTP existant.
 * Si `token` est défini, exige ?token=<token> dans l'URL de connexion
 * (les navigateurs ne peuvent pas poser d'en-tête Authorization sur un WebSocket).
 */
export function attachTerminal(server, { token } = {}) {
  hookShutdown()
  const wss = new WebSocketServer({ noServer: true })
  wss.on('connection', (ws, req) => handleConnection(ws, req))

  server.on('upgrade', (req, socket, head) => {
    let url
    try {
      url = new URL(req.url, 'http://localhost')
    } catch {
      return socket.destroy()
    }
    if (url.pathname !== '/api/terminal') return // autre upgrade (HMR vite, etc.)

    if (token && url.searchParams.get('token') !== token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      return socket.destroy()
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
  })

  return wss
}
