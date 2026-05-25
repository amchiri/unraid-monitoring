import { useState } from 'react'
import { api, type Container } from '../lib/api'
import { usePoll } from '../lib/usePoll'
import { Card, ErrorNote, Dot, Btn, Skeleton } from './ui'
import { Box, Play, Square, TerminalSquare, ScrollText } from 'lucide-react'

// ... ContainerIcon and ContainerRow definitions ...
function ContainerIcon({ c }: { c: Container }) {
  const [broken, setBroken] = useState(false)
  if (c.icon && !broken) {
    return (
      <img
        src={c.icon}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        className="h-8 w-8 shrink-0 rounded-md bg-zinc-800 object-contain"
      />
    )
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-sm font-semibold text-zinc-400">
      {c.name.charAt(0).toUpperCase()}
    </span>
  )
}

function ContainerRow({
  c, onDone, onConsole, onLogs,
}: {
  c: Container
  onDone: () => void
  onConsole: (c: Container) => void
  onLogs: (c: Container) => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const running = c.state === 'RUNNING'

  async function act(action: 'start' | 'stop') {
    setBusy(true)
    setErr(null)
    try {
      await api.dockerAction(c.id, action)
      setTimeout(onDone, 600)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3 border-t border-white/5 py-2">
      <ContainerIcon c={c} />
      <div className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <Dot ok={running} warn={c.state === 'PAUSED'} />
          <span className="truncate font-medium text-zinc-200">{c.name}</span>
          {c.updateAvailable && (
            <span title="Mise à jour disponible" className="rounded bg-amber-500/20 px-1 text-[10px] text-amber-400">maj</span>
          )}
          {c.orphaned && <span title="Orphelin" className="text-zinc-600">⚠</span>}
        </span>
        <span className="block truncate text-[11px] text-zinc-500">{err || c.status}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={() => onConsole(c)}
          title={`Console — ${c.name}`}
          className="rounded-md border border-violet-500/20 bg-violet-500/10 p-1.5 text-violet-400 transition hover:bg-violet-500/20"
        >
          <TerminalSquare size={13} />
        </button>
        <button
          onClick={() => onLogs(c)}
          title={`Logs — ${c.name}`}
          className="rounded-md border border-zinc-700 bg-zinc-800 p-1.5 text-zinc-400 transition hover:bg-zinc-700"
        >
          <ScrollText size={13} />
        </button>
        {c.webUi && (
          <a
            href={c.webUi}
            target="_blank"
            rel="noopener noreferrer"
            title={`Ouvrir ${c.name}`}
            className="rounded-md bg-sky-500/10 border border-sky-500/20 px-2 py-1.5 text-xs font-medium text-sky-400 transition hover:bg-sky-500/20"
          >
            Ouvrir ↗
          </a>
        )}
        <Btn tone={running ? 'red' : 'green'} disabled={busy} onClick={() => act(running ? 'stop' : 'start')}>
          {busy ? '…' : running ? 'Stop' : 'Start'}
        </Btn>
      </div>
    </div>
  )
}

export function DockerPanel({
  onConsole,
  onLogs,
}: {
  onConsole: (c: Container) => void
  onLogs: (c: Container) => void
}) {
  const { data, error, refresh } = usePoll(api.docker, 5000)
  const [busy, setBusy] = useState(false)

  const groupAct = async (action: 'start' | 'stop') => {
    if (!data) return
    if (!confirm(`Voulez-vous vraiment ${action === 'start' ? 'démarrer' : 'arrêter'} tous les conteneurs ?`)) return
    setBusy(true)
    const targets = data.containers.filter((c) => action === 'start' ? c.state !== 'RUNNING' : c.state === 'RUNNING')
    for (const c of targets) {
      try { await api.dockerAction(c.id, action) } catch (e) { console.error(e) }
    }
    setTimeout(() => { refresh(); setBusy(false) }, 1000)
  }

  return (
    <Card
      title="Docker"
      icon={<Box size={18} />}
      right={
        data && (
          <span className="flex items-center gap-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">
            <span className="flex gap-1">
              <button disabled={busy} onClick={() => groupAct('start')} className="p-1 hover:text-emerald-400 transition-colors" title="Tout démarrer"><Play size={14} /></button>
              <button disabled={busy} onClick={() => groupAct('stop')} className="p-1 hover:text-rose-400 transition-colors" title="Tout arrêter"><Square size={14} /></button>
            </span>
            <span>
              <span className="text-zinc-300">{data.running}</span>/{data.total} actifs
              {data.updatesAvailable > 0 && <span className="ml-2 text-amber-400">· {data.updatesAvailable} maj</span>}
            </span>
          </span>
        )
      }
    >
      <ErrorNote error={error} />
      {!data && !error && <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>}
      {data && (
        <div className="max-h-96 overflow-y-auto pr-1">
          {[...data.containers]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((c) => (
              <ContainerRow key={c.id} c={c} onDone={refresh} onConsole={onConsole} onLogs={onLogs} />
            ))}
        </div>
      )}
    </Card>
  )
}
