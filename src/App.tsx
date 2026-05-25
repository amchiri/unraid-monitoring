import { useRef, useState } from 'react'
import { api, type Container } from './lib/api'
import { usePoll } from './lib/usePoll'
import { useEcoMode } from './lib/eco'
import { Dot } from './components/ui'
import { MetricsPanel } from './components/MetricsPanel'
import { SystemPanel } from './components/SystemPanel'
import { ArrayPanel } from './components/ArrayPanel'
import { DockerPanel } from './components/DockerPanel'
import { DisksPanel } from './components/DisksPanel'
import { SharesPanel } from './components/SharesPanel'
import { VmsPanel } from './components/VmsPanel'
import { UpsPanel } from './components/UpsPanel'
import { NotificationsPanel } from './components/NotificationsPanel'
import { TerminalPanel } from './components/TerminalPanel'
import { SyslogPanel } from './components/SyslogPanel'
import { temp } from './lib/format'
import { motion, AnimatePresence } from 'framer-motion'

import { Server, Leaf } from 'lucide-react'

function StatPill({ label, value, tone }: { label: string; value: string; tone?: 'warn' | 'bad' }) {
  const color = tone === 'bad' ? 'text-rose-400' : tone === 'warn' ? 'text-amber-400' : 'text-white'
  return (
    <div className="flex shrink-0 flex-col rounded-xl border border-white/5 bg-white/5 px-4 py-2 backdrop-blur-md transition-all hover:bg-white/10 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:hover:bg-transparent">
      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</span>
      <span className={`text-base font-black tabular-nums sm:text-lg ${color}`}>{value}</span>
    </div>
  )
}

export default function App() {
  const { data } = usePoll(api.overview, 3000)
  const { eco, setEco } = useEcoMode()
  const online = data ? !data.system.error : false
  const m = data?.metrics
  const cpu = m?.cpuPercent
  const mem = m?.memPercent

  const [dockerConsole, setDockerConsole] = useState<Container | null>(null)
  const [dockerLogs, setDockerLogs] = useState<Container | null>(null)
  const terminalRef = useRef<HTMLDivElement>(null)
  const syslogRef = useRef<HTMLDivElement>(null)

  function openConsole(c: Container) {
    setDockerConsole(c)
    setTimeout(() => terminalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  function openLogs(c: Container) {
    setDockerLogs(c)
    setTimeout(() => syslogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const FADE_IN = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4 }
  }

  return (
    <div className="app-shell mx-auto max-w-[1600px] px-3 py-3 sm:px-6 sm:py-8">
      <header className="sticky top-0 z-20 mb-6 -mx-3 border-b border-white/5 bg-black/40 px-4 py-4 backdrop-blur-xl sm:static sm:mx-0 sm:mb-8 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-6 sm:rounded-2xl sm:border sm:bg-white/5 sm:px-8 sm:py-6">
        <div className="mb-4 flex items-center justify-between sm:mb-0 w-full sm:w-auto">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white shadow-lg shadow-indigo-500/20">
              <Server size={24} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-lg font-black tracking-tight text-white sm:text-2xl">
                {data?.system.hostname || 'Unraid'} 
                <span className="bg-gradient-to-r from-zinc-500 to-zinc-400 bg-clip-text text-transparent opacity-80">Dashboard</span>
              </h1>
              <p className="flex items-center gap-2 text-xs font-medium text-zinc-500">
                <Dot ok={online} />
                <span className="uppercase tracking-widest">{online ? 'Système en ligne' : 'Connexion perdue'}</span>
                {data?.system.unraid && <span className="hidden opacity-50 sm:inline">· v{data.system.unraid}</span>}
                {data?.system.ip && <span className="opacity-50">· {data.system.ip}</span>}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setEco(!eco)}
            className={`flex sm:hidden h-10 w-10 items-center justify-center rounded-xl transition-all ${eco ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-zinc-400 border border-white/5'}`}
            title="Mode Économie de données"
          >
            <Leaf size={18} />
          </button>
        </div>
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:items-center sm:gap-8 sm:overflow-visible sm:px-0">
          <StatPill label="CPU" value={cpu != null ? `${cpu.toFixed(0)}%` : '—'} tone={cpu && cpu > 90 ? 'bad' : cpu && cpu > 75 ? 'warn' : undefined} />
          <StatPill label="RAM" value={mem != null ? `${mem.toFixed(0)}%` : '—'} tone={mem && mem > 90 ? 'bad' : mem && mem > 75 ? 'warn' : undefined} />
          <StatPill label="Temp" value={temp(m?.cpuTemp)} />
          <StatPill label="Array" value={data?.array.state || '—'} tone={data?.array.state && data.array.state !== 'STARTED' ? 'warn' : undefined} />
          <StatPill label="Docker" value={data ? `${data.docker.running}/${data.docker.total}` : '—'} />
          <StatPill
            label="Alertes"
            value={data?.notifications.unread ? String(data.notifications.unread.alert + data.notifications.unread.warning) : '0'}
            tone={data?.notifications.unread && data.notifications.unread.alert > 0 ? 'bad' : data?.notifications.unread && data.notifications.unread.warning > 0 ? 'warn' : undefined}
          />
          <button 
            onClick={() => setEco(!eco)}
            className={`hidden sm:flex h-10 w-10 items-center justify-center rounded-xl transition-all hover:scale-105 ${eco ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-zinc-400 border border-white/5 hover:bg-white/10'}`}
            title={eco ? "Mode Éco activé (rafraîchissement lent)" : "Activer Mode Éco"}
          >
            <Leaf size={18} />
          </button>
        </div>
      </header>

      <main className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence>
          <motion.div {...FADE_IN} transition={{ delay: 0.05 }}><MetricsPanel /></motion.div>
          <motion.div {...FADE_IN} transition={{ delay: 0.1 }}><SystemPanel /></motion.div>
          <motion.div {...FADE_IN} transition={{ delay: 0.15 }}><NotificationsPanel /></motion.div>
          <motion.div {...FADE_IN} transition={{ delay: 0.2 }}><ArrayPanel /></motion.div>
          <motion.div {...FADE_IN} transition={{ delay: 0.25 }}><DisksPanel /></motion.div>
          <motion.div {...FADE_IN} transition={{ delay: 0.3 }}><SharesPanel /></motion.div>
          <motion.div {...FADE_IN} transition={{ delay: 0.35 }} className="md:col-span-2 xl:col-span-1">
            <DockerPanel onConsole={openConsole} onLogs={openLogs} />
          </motion.div>
          <motion.div {...FADE_IN} transition={{ delay: 0.4 }}><VmsPanel /></motion.div>
          <motion.div {...FADE_IN} transition={{ delay: 0.45 }}><UpsPanel /></motion.div>
          <motion.div {...FADE_IN} transition={{ delay: 0.5 }} className="md:col-span-2 xl:col-span-3" ref={syslogRef}>
            <SyslogPanel
              key={dockerLogs ? `docker-${dockerLogs.name}` : 'syslog'}
              dockerTarget={dockerLogs ?? undefined}
              onBack={dockerLogs ? () => setDockerLogs(null) : undefined}
            />
          </motion.div>
          <motion.div {...FADE_IN} transition={{ delay: 0.55 }} className="md:col-span-2 xl:col-span-3" ref={terminalRef}>
            <TerminalPanel
              key={dockerConsole ? `docker-${dockerConsole.name}` : 'system'}
              dockerTarget={dockerConsole ?? undefined}
              onBack={dockerConsole ? () => setDockerConsole(null) : undefined}
            />
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="mt-8 text-center text-[11px] font-medium tracking-wide text-zinc-600 uppercase">
        Unraid Dashboard · données rafraîchies automatiquement · {data?.fetchedAt ? new Date(data.fetchedAt).toLocaleTimeString('fr-FR') : ''}
      </footer>
    </div>
  )
}
