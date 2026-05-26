import { useCallback, useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { Card, Dot, Btn } from './ui'
import { TerminalSquare } from 'lucide-react'
import type { Container } from '../lib/api'
import { getToken } from '../lib/auth'

type Status = 'connecting' | 'connected' | 'disconnected'

const THEME = {
  background: '#09090b',
  foreground: '#e4e4e7',
  cursor: '#38bdf8',
  selectionBackground: '#334155',
  black: '#27272a',
  brightBlack: '#52525b',
}

function buildWsUrl(containerName?: string) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const base = `${proto}://${location.host}/api/terminal`
  const params = new URLSearchParams()
  if (containerName) params.set('container', containerName)
  // Un navigateur ne peut pas poser d'en-tête sur un WebSocket : token en query.
  const token = getToken()
  if (token) params.set('token', token)
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

export function TerminalPanel({
  dockerTarget,
  onBack,
}: {
  dockerTarget?: Container
  onBack?: () => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<Status>('connecting')

  const sendSize = useCallback(() => {
    const term = termRef.current
    const fit = fitRef.current
    const ws = wsRef.current
    if (!term || !fit) return
    try {
      fit.fit()
    } catch {
      /* conteneur pas encore mesuré */
    }
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'r', c: term.cols, r: term.rows }))
    }
  }, [])

  const connect = useCallback((containerName?: string) => {
    const term = termRef.current
    if (!term) return
    wsRef.current?.close()
    setStatus('connecting')

    const ws = new WebSocket(buildWsUrl(containerName))
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('connected')
      sendSize()
      term.focus()
    }
    ws.onmessage = (e) => {
      term.write(typeof e.data === 'string' ? e.data : new Uint8Array(e.data))
    }
    ws.onclose = () => {
      setStatus('disconnected')
      term.write('\r\n\x1b[2m— session terminée —\x1b[0m\r\n')
    }
    ws.onerror = () => setStatus('disconnected')
  }, [sendSize])

  // Init xterm une seule fois
  useEffect(() => {
    if (!hostRef.current) return
    const term = new Terminal({
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: window.innerWidth < 640 ? 12 : 13,
      cursorBlink: true,
      theme: THEME,
      scrollback: 5000,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(hostRef.current)
    fit.fit()
    termRef.current = term
    fitRef.current = fit

    term.onData((d) => {
      const ws = wsRef.current
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'i', d }))
    })

    const ro = new ResizeObserver(() => sendSize())
    ro.observe(hostRef.current)

    connect(dockerTarget?.name)

    return () => {
      ro.disconnect()
      wsRef.current?.close()
      term.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const statusLabel =
    status === 'connected' ? 'connecté' : status === 'connecting' ? 'connexion…' : 'déconnecté'

  const title = dockerTarget ? `Console — ${dockerTarget.name}` : 'Terminal'

  return (
    <Card
      title={title}
      icon={<TerminalSquare size={18} />}
      className="md:col-span-2 xl:col-span-3"
      right={
        <span className="flex items-center gap-2 text-xs text-zinc-400">
          {onBack && (
            <Btn tone="sky" onClick={onBack}>
              ← Retour système
            </Btn>
          )}
          <Dot ok={status === 'connected'} warn={status === 'connecting'} />
          {statusLabel}
          {status === 'disconnected' && (
            <Btn tone="sky" onClick={() => connect(dockerTarget?.name)} className="ml-1">
              Reconnecter
            </Btn>
          )}
        </span>
      }
    >
      <div
        ref={hostRef}
        onClick={() => termRef.current?.focus()}
        className="h-[300px] w-full overflow-hidden rounded-lg border border-zinc-800 bg-[#09090b] p-2 sm:h-[440px]"
      />
      {dockerTarget ? (
        <p className="mt-2 text-[11px] text-zinc-600">
          Shell interactif dans le conteneur <span className="text-zinc-400">{dockerTarget.name}</span> · <span className="text-violet-400 cursor-pointer hover:text-violet-300" onClick={onBack}>retour au terminal système</span>
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-zinc-600">
          Shell interactif sur le serveur Unraid · ⚠ accès root — à n'exposer que sur un réseau de confiance
        </p>
      )}
    </Card>
  )
}
