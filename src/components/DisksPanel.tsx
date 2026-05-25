import { api } from '../lib/api'
import { usePoll } from '../lib/usePoll'
import { Card, ErrorNote, Dot, Skeleton } from './ui'
import { formatBytes, temp } from '../lib/format'
import { Disc } from 'lucide-react'

export function DisksPanel() {
  const { data, error } = usePoll(api.disks, 30000)

  return (
    <Card title="Disques physiques (SMART)" icon={<Disc size={18} />} right={data && <span className="text-xs text-zinc-400 font-bold uppercase">{data.length} disques</span>}>
      <ErrorNote error={error} />
      {!data && !error && <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>}
      {data && (
        <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full text-sm">
          <tbody>
            {data.map((d) => {
              const ok = d.smartStatus === 'OK'
              return (
                <tr key={d.id} className="border-t border-white/5">
                  <td className="py-2 pr-2">
                    <span className="flex items-center gap-2">
                      <Dot ok={ok} warn={d.smartStatus === 'UNKNOWN'} />
                      <span className="font-medium text-zinc-200">{d.name}</span>
                    </span>
                    <span className="text-[11px] text-zinc-500">{d.vendor} · {d.interface} · {d.type}</span>
                  </td>
                  <td className="py-2 pr-2 text-right text-[11px] font-medium text-zinc-500">{d.smartStatus}</td>
                  <td className="py-2 pr-2 text-right tabular-nums text-zinc-400">{temp(d.temperature)}</td>
                  <td className="py-2 text-right tabular-nums text-zinc-400">{formatBytes(d.sizeBytes)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      )}
    </Card>
  )
}
