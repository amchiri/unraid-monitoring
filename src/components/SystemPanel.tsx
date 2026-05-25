import { api } from '../lib/api'
import { usePoll } from '../lib/usePoll'
import { Card, ErrorNote, Stat, Skeleton } from './ui'
import { formatUptime } from '../lib/format'
import { Monitor } from 'lucide-react'

export function SystemPanel() {
  const { data, error } = usePoll(api.overview, 5000)
  const s = data?.system
  const m = data?.system

  return (
    <Card title="Système" icon={<Monitor size={18} />}>
      <ErrorNote error={error || s?.error || null} />
      {!data && !error && <div className="grid grid-cols-2 gap-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>}
      {s && (
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Hôte" value={s.hostname || '—'} />
          <Stat label="Unraid" value={s.unraid ? `v${s.unraid}` : '—'} sub={s.apiVersion ? `API ${s.apiVersion}` : undefined} />
          <Stat label="Uptime" value={formatUptime(s.uptime)} />
          <Stat label="Adresse IP" value={s.ip || '—'} />
          <Stat label="CPU" value={s.cpu || '—'} sub={s.cores ? `${s.cores} cœurs / ${s.threads} threads` : undefined} />
          <Stat label="Modèle" value={m?.model || '—'} sub={s.kernel ? `kernel ${s.kernel}` : undefined} />
        </div>
      )}
    </Card>
  )
}
