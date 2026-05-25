import { api } from '../lib/api'
import { usePoll } from '../lib/usePoll'
import { Card, ErrorNote, Bar, Skeleton } from './ui'
import { formatBytes, pct } from '../lib/format'
import { Folder } from 'lucide-react'

export function SharesPanel() {
  const { data, error } = usePoll(api.shares, 30000)

  return (
    <Card title="Partages" icon={<Folder size={18} />} right={data && <span className="text-xs text-zinc-400 font-bold uppercase">{data.length} partages</span>}>
      <ErrorNote error={error} />
      {!data && !error && <div className="space-y-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>}
      {data && (
        <div className="max-h-96 space-y-4 overflow-y-auto pr-1">
          {data.map((s) => {
            const total = s.usedBytes + s.freeBytes
            const p = total ? Math.round((s.usedBytes / total) * 1000) / 10 : null
            return (
              <div key={s.name}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-bold tracking-wide text-zinc-200">{s.name}</span>
                  <span className="text-zinc-500 font-medium tabular-nums">{formatBytes(s.usedBytes)} / {formatBytes(total)} ({pct(p)})</span>
                </div>
                <Bar value={p} />
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
