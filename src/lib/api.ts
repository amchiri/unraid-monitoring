import { getToken, markAuthRequired } from './auth'

const BASE = '/api'

function authHeaders(): Record<string, string> {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders() })
  if (res.status === 401) {
    markAuthRequired()
    throw new Error('Token d’accès requis')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

async function post<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: authHeaders() })
  if (res.status === 401) {
    markAuthRequired()
    throw new Error('Token d’accès requis')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
  return body
}

// ---- Types ----------------------------------------------------------------

export interface Overview {
  fetchedAt: string
  system: {
    hostname?: string
    distro?: string
    uptime?: string
    kernel?: string
    unraid?: string
    apiVersion?: string
    cpu?: string
    cores?: number
    threads?: number
    model?: string
    ip?: string
    error?: string
  }
  metrics: {
    cpuPercent?: number
    memPercent?: number
    memUsed?: number
    memTotal?: number
    cpuTemp?: number | null
    tempAverage?: number | null
    tempHottest?: { name: string; value: number; type?: string } | null
    error?: string
  }
  array: {
    state?: string
    capacity?: { totalKb: number; usedKb: number; freeKb: number; percentUsed: number | null }
    diskCount?: number
    cacheCount?: number
    parityRunning?: boolean
    error?: string
  }
  docker: { total: number; running: number; updatesAvailable: number; error?: string }
  vms: { available: boolean; total?: number; running?: number }
  ups: { available: boolean; devices?: UpsDevice[] }
  notifications: { unread?: { total: number; info: number; warning: number; alert: number }; error?: string }
}

export interface Metrics {
  cpu: { percent: number; cores: number[] }
  memory: {
    total: number; used: number; free: number; available: number
    percent: number; swapTotal: number; swapUsed: number; swapPercent: number
  }
  temperature: {
    cpu: number | null; diskMax: number | null; nvmeMax: number | null; gpuMax: number | null
    average: number | null; hottest: { name: string; value: number; type: string } | null
    warnings: number; criticals: number
    sensors: { name: string; value: number; unit: string; status: string; type: string; location: string | null }[]
  } | null
}

export interface ArrayDisk {
  name: string; device: string; status: string; temp: number | null
  fsType: string | null; sizeKb: number | null; usedKb: number | null; freeKb: number | null
  percentUsed: number | null; spinning: boolean | null
  reads: number | null; writes: number | null; errors: number | null
}

export interface ArrayInfo {
  state: string
  capacity: { totalKb: number; usedKb: number; freeKb: number; percentUsed: number | null }
  parityCheck: { running: boolean | null; progress: number | null; speed: string | null; errors: number | null; date: string | null; duration: number | null } | null
  parities: ArrayDisk[]; disks: ArrayDisk[]; caches: ArrayDisk[]; boot: ArrayDisk | null
}

export interface PhysicalDisk {
  id: string; name: string; device: string; type: string; vendor: string
  sizeBytes: number; temperature: number | null; smartStatus: string; interface: string; spinning: boolean
}

export interface Container {
  id: string; name: string; image: string; state: string; status: string
  autoStart: boolean; updateAvailable: boolean; orphaned: boolean
  icon: string | null; webUi: string | null
  ports: { private: number; public: number; type: string }[]
}
export interface DockerInfo { total: number; running: number; updatesAvailable: number; containers: Container[] }

export interface Share {
  name: string; comment: string; usedBytes: number; freeBytes: number; sizeBytes: number; cache: boolean | null; color: string | null
}

export interface Vm { id: string; name: string; state: string }
export interface VmsInfo { available: boolean; reason?: string; domains: Vm[] }

export interface UpsDevice {
  id: string; name: string; model: string; status: string
  battery: { chargeLevel: number; estimatedRuntime: number; health: string }
  power: { inputVoltage: number; outputVoltage: number; loadPercentage: number; nominalPower: number; currentPower: number }
}
export interface UpsInfo { available: boolean; reason?: string; devices: UpsDevice[] }

export interface NotificationsInfo {
  overview: { unread: { total: number; info: number; warning: number; alert: number }; archive: { total: number } }
  list: { id: string; title: string; subject: string; description: string; importance: string; type: string; timestamp: string; formattedTimestamp: string; link: string }[]
}

// ---- Endpoints ------------------------------------------------------------

export const api = {
  overview: () => get<Overview>('/overview'),
  metrics: () => get<Metrics>('/metrics'),
  array: () => get<ArrayInfo>('/array'),
  disks: () => get<PhysicalDisk[]>('/disks'),
  docker: () => get<DockerInfo>('/docker'),
  shares: () => get<Share[]>('/shares'),
  vms: () => get<VmsInfo>('/vms'),
  ups: () => get<UpsInfo>('/ups'),
  notifications: () => get<NotificationsInfo>('/notifications'),
  dockerAction: (id: string, action: 'start' | 'stop' | 'pause' | 'unpause') =>
    post(`/docker/${encodeURIComponent(id)}/${action}`),
  vmAction: (id: string, action: 'start' | 'stop' | 'pause' | 'resume' | 'forceStop' | 'reboot' | 'reset') =>
    post(`/vms/${encodeURIComponent(id)}/${action}`),
}
