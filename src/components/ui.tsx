import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { vibrate } from '../lib/haptics'

export function Card({
  title,
  icon,
  right,
  children,
  className = '',
}: {
  title?: string
  icon?: ReactNode
  right?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`glass-card rounded-2xl p-4 transition-all duration-300 sm:p-5 ${className}`}
    >
      {title && (
        <header className="mb-4 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[11px] font-bold tracking-widest text-zinc-400 uppercase sm:text-xs">
            {icon && <span className="text-zinc-500">{icon}</span>}
            {title}
          </h2>
          {right}
        </header>
      )}
      {children}
    </section>
  )
}

const BTN_TONE = {
  green: 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20',
  red: 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20',
  sky: 'bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20',
  zinc: 'bg-zinc-800/50 text-zinc-300 border border-zinc-700/50 hover:bg-zinc-700/80',
}

/** Bouton compact mais tactile (cible ≥ 32px), avec retour visuel au tap. */
export function Btn({
  tone = 'zinc',
  className = '',
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: keyof typeof BTN_TONE }) {
  return (
    <button
      {...props}
      onClick={(e) => {
        vibrate('light')
        onClick?.(e)
      }}
      className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide transition-all active:scale-95 disabled:opacity-40 ${BTN_TONE[tone]} ${className}`}
    />
  )
}

const RING = (p: number) => {
  if (p >= 90) return '#f43f5e' // rose-500
  if (p >= 75) return '#f59e0b' // amber-500
  if (p >= 50) return '#eab308' // yellow-500
  return '#10b981' // emerald-500
}

export function Gauge({
  value,
  label,
  sub,
  size = 120,
}: {
  value: number | null | undefined
  label: string
  sub?: string
  size?: number
}) {
  const v = value == null || isNaN(value) ? 0 : Math.max(0, Math.min(100, value))
  const stroke = 8
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - v / 100)
  const color = RING(v)
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ 
              transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s',
              filter: `drop-shadow(0 0 6px ${color}44)`
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black tracking-tight text-white">
            {value == null || isNaN(value) ? '—' : `${Math.round(v)}%`}
          </span>
          {sub && <span className="max-w-[80%] truncate text-[10px] font-medium text-zinc-500 uppercase tracking-tighter">{sub}</span>}
        </div>
      </div>
      <span className="mt-2 text-[11px] font-bold tracking-widest text-zinc-500 uppercase">{label}</span>
    </div>
  )
}

export function Bar({
  value,
  max = 100,
  className = '',
}: {
  value: number | null | undefined
  max?: number
  className?: string
}) {
  const v = value == null ? 0 : Math.max(0, Math.min(max, value))
  const p = (v / max) * 100
  const color = RING(p)
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-white/5 ${className}`}>
      <div
        className="h-full rounded-full"
        style={{ 
          width: `${p}%`, 
          backgroundColor: color, 
          transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: `0 0 10px ${color}44`
        }}
      />
    </div>
  )
}

export function Sparkline({
  data,
  width = 260,
  height = 44,
  color = '#38bdf8',
}: {
  data: number[]
  width?: number
  height?: number
  color?: string
}) {
  if (data.length < 2) {
    return <div style={{ height }} className="flex items-center text-xs text-zinc-600">…</div>
  }
  const max = Math.max(100, ...data)
  const min = 0
  const range = max - min || 1
  const step = width / (data.length - 1)
  const points = data
    .map((d, i) => `${(i * step).toFixed(1)},${(height - ((d - min) / range) * height).toFixed(1)}`)
    .join(' ')
  const area = `0,${height} ${points} ${width},${height}`
  return (
    <svg width={width} height={height} className="w-full" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
      <polygon points={area} fill={color} opacity={0.12} />
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </svg>
  )
}

export function Dot({ ok, warn }: { ok: boolean; warn?: boolean }) {
  const color = warn ? 'bg-amber-500' : ok ? 'bg-green-500' : 'bg-red-500'
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-sm font-medium text-zinc-200">{value}</div>
      {sub && <div className="text-[11px] text-zinc-500">{sub}</div>}
    </div>
  )
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null
  return <div className="rounded-md bg-red-950/50 px-3 py-2 text-xs text-red-300">⚠ {error}</div>
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-white/5 ${className}`} />
  )
}
