export function formatBytes(bytes: number | null | undefined, decimals = 1): string {
  if (bytes == null || isNaN(bytes)) return '—'
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'Ko', 'Mo', 'Go', 'To', 'Po']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return `${(bytes / Math.pow(k, i)).toFixed(decimals)} ${sizes[i]}`
}

/** Les capacités Unraid (array/disques) sont exprimées en kilo-octets. */
export function formatKb(kb: number | null | undefined, decimals = 1): string {
  if (kb == null) return '—'
  return formatBytes(kb * 1024, decimals)
}

export function formatUptime(uptime: string | null | undefined): string {
  if (!uptime) return '—'
  // uptime est une date ISO de démarrage ou une durée ; on tente une date
  const d = new Date(uptime)
  if (!isNaN(d.getTime())) {
    const secs = Math.floor((Date.now() - d.getTime()) / 1000)
    if (secs > 0) return formatDuration(secs)
  }
  return uptime
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return '—'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (d) parts.push(`${d}j`)
  if (h) parts.push(`${h}h`)
  if (m && !d) parts.push(`${m}min`)
  return parts.length ? parts.join(' ') : `${seconds}s`
}

export function pct(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—'
  return `${v.toFixed(v < 10 ? 1 : 0)}%`
}

export function temp(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${Math.round(v)}°C`
}
