import { api } from '../lib/api'
import { usePoll } from '../lib/usePoll'
import { Card, ErrorNote, Bar, Stat, Skeleton } from './ui'
import { formatDuration } from '../lib/format'
import { Battery } from 'lucide-react'

export function UpsPanel() {
  const { data, error } = usePoll(api.ups, 15000)

  if (data && !data.available) {
    return (
      <Card title="Onduleur (UPS)" icon={<Battery size={18} />}>
        <p className="py-4 text-center text-sm font-medium text-zinc-500">Aucun onduleur détecté</p>
      </Card>
    )
  }

  return (
    <Card title="Onduleur (UPS)" icon={<Battery size={18} />}>
      <ErrorNote error={error} />
      {!data && !error && <div className="space-y-4"><Skeleton className="h-6 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-16 w-full" /></div>}
      {data?.devices.map((u) => (
        <div key={u.id} className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-bold tracking-wide text-zinc-200">{u.name}</span>
            <span className="text-xs font-medium text-zinc-500">{u.model} · {u.status}</span>
          </div>
          <div>
            <div className="mb-2 flex justify-between text-[11px] font-bold uppercase tracking-widest text-zinc-500">
              <span>Batterie</span>
              <span>{u.battery.chargeLevel}% · {formatDuration(u.battery.estimatedRuntime * 60)}</span>
            </div>
            <Bar value={u.battery.chargeLevel} />
          </div>
          <div className="grid grid-cols-3 gap-2 border-t border-white/5 pt-3">
            <Stat label="Charge" value={`${u.power.loadPercentage}%`} />
            <Stat label="Puissance" value={`${Math.round(u.power.currentPower)} W`} />
            <Stat label="Entrée" value={`${Math.round(u.power.inputVoltage)} V`} />
          </div>
        </div>
      ))}
    </Card>
  )
}
