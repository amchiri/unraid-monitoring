import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { usePoll } from '../lib/usePoll'
import { Card, Gauge, Sparkline, ErrorNote, Stat, Skeleton } from './ui'
import { formatBytes, temp } from '../lib/format'
import { Activity } from 'lucide-react'

const MAX_HISTORY = 180

export function MetricsPanel() {
  const { data, error } = usePoll(api.metrics, 2000)
  const [cpuHist, setCpuHist] = useState<number[]>([])
  const [memHist, setMemHist] = useState<number[]>([])
  const last = useRef<string>('')

  useEffect(() => {
    if (!data) return
    // évite les doublons si la même réponse est re-set
    const sig = `${data.cpu.percent}-${data.memory.percent}`
    if (sig === last.current) return
    last.current = sig
    setCpuHist((h) => [...h, data.cpu.percent].slice(-MAX_HISTORY))
    setMemHist((h) => [...h, data.memory.percent].slice(-MAX_HISTORY))
  }, [data])

  const t = data?.temperature

  return (
    <Card title="Performances" icon={<Activity size={18} />}>
      <ErrorNote error={error} />
      {!data && !error && <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-20 w-full" /></div>}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Gauge value={data.cpu.percent} label="CPU" />
            <Gauge
              value={data.memory.percent}
              label="Mémoire"
              sub={`${formatBytes(data.memory.used)} / ${formatBytes(data.memory.total)}`}
            />
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-zinc-500">
                <span>CPU</span>
                <span>{cpuHist.length ? `${cpuHist[cpuHist.length - 1].toFixed(1)}%` : ''}</span>
              </div>
              <Sparkline data={cpuHist} color="#38bdf8" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-zinc-500">
                <span>Mémoire</span>
                <span>{memHist.length ? `${memHist[memHist.length - 1].toFixed(1)}%` : ''}</span>
              </div>
              <Sparkline data={memHist} color="#a78bfa" />
            </div>
          </div>

          {data.memory.swapTotal > 0 && (
            <div className="mt-3 text-[11px] font-medium text-zinc-500">
              Swap : <span className="text-zinc-400">{formatBytes(data.memory.swapUsed)} / {formatBytes(data.memory.swapTotal)}</span> ({data.memory.swapPercent.toFixed(0)}%)
            </div>
          )}

          {t && t.sensors && t.sensors.length > 0 && (
            <div className="mt-6 border-t border-white/5 pt-4">
              <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Capteurs Thermiques</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                {t.sensors
                  .filter((s: any) => s.value != null && s.type !== 'CUSTOM')
                  .sort((a: any, b: any) => b.value - a.value)
                  .map((s: any, i: number) => {
                    const isHot = s.value >= 70
                    const isWarn = s.value >= 55 && s.value < 70
                    const color = isHot ? 'text-rose-400' : isWarn ? 'text-amber-400' : 'text-zinc-300'
                    return (
                      <div key={i} className="flex justify-between items-center text-xs">
                        <span className="truncate pr-2 text-zinc-500" title={s.name}>{s.name}</span>
                        <span className={`font-bold tabular-nums ${color}`}>{temp(s.value)}</span>
                      </div>
                    )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
