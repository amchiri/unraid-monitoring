import { api } from '../lib/api'
import { usePoll } from '../lib/usePoll'
import { Card, ErrorNote, Skeleton } from './ui'
import { Bell, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { ReactNode } from 'react'

const IMPORTANCE: Record<string, { color: string; icon: ReactNode }> = {
  ALERT: { color: 'text-rose-300 bg-rose-500/10 border border-rose-500/20', icon: <AlertCircle size={14} className="text-rose-400" /> },
  WARNING: { color: 'text-amber-300 bg-amber-500/10 border border-amber-500/20', icon: <AlertTriangle size={14} className="text-amber-400" /> },
  INFO: { color: 'text-sky-300 bg-sky-500/10 border border-sky-500/20', icon: <Info size={14} className="text-sky-400" /> },
}

export function NotificationsPanel() {
  const { data, error } = usePoll(api.notifications, 15000)
  const unread = data?.overview?.unread

  return (
    <Card
      title="Notifications"
      icon={<Bell size={18} />}
      right={
        unread && (
          <span className="flex gap-2 text-[11px] font-bold uppercase tracking-widest">
            {unread.alert > 0 && <span className="text-rose-400">{unread.alert} alertes</span>}
            {unread.warning > 0 && <span className="text-amber-400">{unread.warning} avert.</span>}
            {unread.total === 0 && <span className="text-emerald-400">tout va bien</span>}
          </span>
        )
      }
    >
      <ErrorNote error={error} />
      {!data && !error && <div className="space-y-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>}
      {data && data.list.length === 0 && (
        <p className="py-6 text-center text-sm font-medium text-zinc-500">Aucune notification non lue ✓</p>
      )}
      {data && data.list.length > 0 && (
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {data.list.map((n) => {
            const imp = IMPORTANCE[n.importance] || IMPORTANCE.INFO
            return (
              <div key={n.id} className={`rounded-xl px-3 py-2.5 transition-colors hover:brightness-110 ${imp.color}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-bold tracking-tight">
                    {imp.icon} {n.title}
                  </span>
                  <span className="shrink-0 text-[10px] font-medium opacity-60">{n.formattedTimestamp}</span>
                </div>
                {n.subject && <div className="mt-1 text-xs opacity-90">{n.subject}</div>}
                {n.description && <div className="mt-0.5 text-[11px] opacity-70 leading-relaxed">{n.description}</div>}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
