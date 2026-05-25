import { api, type ArrayDisk } from '../lib/api'
import { usePoll } from '../lib/usePoll'
import { Card, Bar, ErrorNote, Dot, Skeleton } from './ui'
import { formatKb, temp, pct } from '../lib/format'
import { HardDrive } from 'lucide-react'

function DiskRow({ d }: { d: ArrayDisk }) {
  const ok = d.status === 'DISK_OK' || d.status === 'DISK_NP_DSBL' || d.status?.includes('OK')
  return (
    <tr className="border-t border-white/5">
      <td className="py-2 pr-2">
        <span className="flex items-center gap-2">
          <Dot ok={ok} />
          <span className="font-medium text-zinc-200">{d.name}</span>
          {d.spinning === false && <span title="En veille" className="text-zinc-600">💤</span>}
        </span>
        <span className="text-[11px] text-zinc-500">{d.device} · {d.fsType || '—'}</span>
      </td>
      <td className="py-2 pr-2 text-right tabular-nums text-zinc-400">{temp(d.temp)}</td>
      <td className="py-2 pr-2 text-right tabular-nums text-zinc-400 whitespace-nowrap">
        {formatKb(d.usedKb)} / {formatKb(d.sizeKb)}
      </td>
      <td className="w-28 py-2">
        <div className="flex items-center gap-2">
          <Bar value={d.percentUsed} className="flex-1" />
          <span className="w-10 text-right text-[11px] tabular-nums text-zinc-500">{pct(d.percentUsed)}</span>
        </div>
      </td>
    </tr>
  )
}

export function ArrayPanel() {
  const { data, error } = usePoll(api.array, 10000)
  const started = data?.state === 'STARTED'

  return (
    <Card
      title="Array & stockage"
      icon={<HardDrive size={18} />}
      right={
        data && (
          <span className="flex items-center gap-2 text-xs">
            <Dot ok={started} warn={!started} />
            <span className="text-zinc-400 font-medium">{data.state}</span>
          </span>
        )
      }
    >
      <ErrorNote error={error} />
      {!data && !error && <div className="space-y-2"><Skeleton className="h-6 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>}
      {data && (
        <>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex-1">
              <div className="mb-2 flex justify-between text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                <span>Capacité totale</span>
                <span>
                  {formatKb(data.capacity.usedKb)} / {formatKb(data.capacity.totalKb)} ({pct(data.capacity.percentUsed)})
                </span>
              </div>
              <Bar value={data.capacity.percentUsed} />
            </div>
          </div>

          {data.parityCheck?.running && (
            <div className="mb-4 rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-4 py-3 text-xs text-indigo-300">
              Contrôle de parité en cours — <span className="font-bold">{pct(data.parityCheck.progress)}</span> · {data.parityCheck.speed}
            </div>
          )}

          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full text-sm">
              <tbody>
                {[...data.parities, ...data.disks, ...data.caches].map((d) => (
                  <DiskRow key={`${d.name}-${d.device}`} d={d} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  )
}
