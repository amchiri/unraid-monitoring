import { Router } from 'express'
import { gql, gqlSafe, Q } from './unraid.js'

const router = Router()

// ---------------------------------------------------------------------------
// Helpers de normalisation
// ---------------------------------------------------------------------------

const num = (v) => (v == null ? null : Number(v))

function normalizeContainer(c) {
  return {
    id: c.id,
    name: (c.names?.[0] || '').replace(/^\//, ''),
    image: c.image,
    state: c.state, // RUNNING | EXITED | PAUSED ...
    status: c.status,
    autoStart: c.autoStart,
    updateAvailable: c.isUpdateAvailable === true,
    orphaned: c.isOrphaned === true,
    icon: c.iconUrl || null,
    webUi: c.webUiUrl || null,
    ports: (c.ports || []).map((p) => ({
      private: p.privatePort,
      public: p.publicPort,
      type: p.type,
    })),
  }
}

// Les capteurs de type CUSTOM (ex: Corsair Commander Pro) renvoient des RPM /
// tensions mal étiquetés en CELSIUS → on les exclut des agrégats de température.
const RELIABLE_TEMP_TYPES = ['CPU_CORE', 'CPU_PACKAGE', 'DISK', 'NVME', 'GPU']

function buildTemperature(t) {
  const sensors = (t.sensors || []).map((s) => ({
    name: s.name,
    value: num(s.current?.value),
    unit: s.current?.unit,
    status: s.current?.status,
    type: s.type,
    location: s.location,
  }))
  const real = sensors.filter(
    (s) => RELIABLE_TEMP_TYPES.includes(s.type) && s.value != null,
  )
  const byType = (type) => real.filter((s) => s.type === type).map((s) => s.value)
  const max = (arr) => (arr.length ? Math.max(...arr) : null)
  const avg = (arr) =>
    arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null

  const cpuPackage = byType('CPU_PACKAGE')
  const cpu = cpuPackage.length ? max(cpuPackage) : max(byType('CPU_CORE'))
  const realValues = real.map((s) => s.value)
  const hottest = real.reduce(
    (h, s) => (h == null || s.value > h.value ? s : h),
    null,
  )

  return {
    cpu,
    diskMax: max(byType('DISK')),
    nvmeMax: max(byType('NVME')),
    gpuMax: max(byType('GPU')),
    average: avg(realValues),
    hottest: hottest ? { name: hottest.name, value: hottest.value, type: hottest.type } : null,
    warnings: real.filter((s) => s.status === 'WARNING').length,
    criticals: real.filter((s) => s.status === 'CRITICAL').length,
    sensors, // liste complète (avec CUSTOM) pour la vue détaillée
  }
}

function arrayDiskUsage(d) {
  // les tailles sont en Ko
  const size = num(d.fsSize) || num(d.size)
  const used = num(d.fsUsed)
  const free = num(d.fsFree)
  const pct = size && used != null ? Math.round((used / size) * 1000) / 10 : null
  return {
    name: d.name,
    device: d.device,
    status: d.status,
    temp: num(d.temp),
    fsType: d.fsType ?? null,
    sizeKb: size,
    usedKb: used,
    freeKb: free,
    percentUsed: pct,
    spinning: d.isSpinning ?? null,
    reads: num(d.numReads),
    writes: num(d.numWrites),
    errors: num(d.numErrors),
  }
}

// ---------------------------------------------------------------------------
// Sections (lecture)
// ---------------------------------------------------------------------------

router.get('/health', async (_req, res) => {
  const { data, error } = await gqlSafe(Q.online)
  res.json({ ok: !error, unraidOnline: data?.online ?? false, error })
})

router.get('/system', async (_req, res, next) => {
  try {
    const { info } = await gql(Q.system)
    res.json({
      time: info.time,
      hostname: info.os?.hostname,
      os: info.os,
      cpu: info.cpu,
      system: info.system,
      versions: info.versions?.core,
      memoryLayout: info.memory?.layout || [],
      network: {
        primary: info.primaryNetwork,
        interfaces: info.networkInterfaces || [],
      },
    })
  } catch (e) {
    next(e)
  }
})

router.get('/metrics', async (_req, res, next) => {
  try {
    const { metrics } = await gql(Q.metrics)
    res.json({
      cpu: {
        percent: num(metrics.cpu?.percentTotal),
        cores: (metrics.cpu?.cpus || []).map((c) => num(c.percentTotal)),
      },
      memory: {
        total: num(metrics.memory?.total),
        used: num(metrics.memory?.used),
        free: num(metrics.memory?.free),
        available: num(metrics.memory?.available),
        percent: num(metrics.memory?.percentTotal),
        swapTotal: num(metrics.memory?.swapTotal),
        swapUsed: num(metrics.memory?.swapUsed),
        swapPercent: num(metrics.memory?.percentSwapTotal),
      },
      temperature: metrics.temperature
        ? buildTemperature(metrics.temperature)
        : null,
    })
  } catch (e) {
    next(e)
  }
})

router.get('/array', async (_req, res, next) => {
  try {
    const { array } = await gql(Q.array)
    const cap = array.capacity?.kilobytes || {}
    res.json({
      state: array.state,
      capacity: {
        totalKb: num(cap.total),
        usedKb: num(cap.used),
        freeKb: num(cap.free),
        percentUsed:
          cap.total && cap.used
            ? Math.round((num(cap.used) / num(cap.total)) * 1000) / 10
            : null,
      },
      parityCheck: array.parityCheckStatus
        ? {
            running: array.parityCheckStatus.running,
            progress: num(array.parityCheckStatus.progress),
            speed: array.parityCheckStatus.speed,
            errors: num(array.parityCheckStatus.errors),
            date: array.parityCheckStatus.date,
            duration: num(array.parityCheckStatus.duration),
          }
        : null,
      parities: (array.parities || []).map(arrayDiskUsage),
      disks: (array.disks || []).map(arrayDiskUsage),
      caches: (array.caches || []).map(arrayDiskUsage),
      boot: array.boot ? arrayDiskUsage(array.boot) : null,
    })
  } catch (e) {
    next(e)
  }
})

router.get('/disks', async (_req, res, next) => {
  try {
    const { disks } = await gql(Q.disks)
    res.json(
      (disks || []).map((d) => ({
        id: d.id,
        name: d.name,
        device: d.device,
        type: d.type,
        vendor: d.vendor,
        sizeBytes: num(d.size),
        temperature: num(d.temperature),
        smartStatus: d.smartStatus,
        interface: d.interfaceType,
        spinning: d.isSpinning,
      })),
    )
  } catch (e) {
    next(e)
  }
})

router.get('/docker', async (_req, res, next) => {
  try {
    const { docker } = await gql(Q.docker)
    const containers = (docker.containers || []).map(normalizeContainer)
    res.json({
      total: containers.length,
      running: containers.filter((c) => c.state === 'RUNNING').length,
      updatesAvailable: containers.filter((c) => c.updateAvailable).length,
      containers,
    })
  } catch (e) {
    next(e)
  }
})

router.get('/vms', async (_req, res) => {
  const { data, error } = await gqlSafe(Q.vms)
  if (error || !data?.vms) {
    return res.json({ available: false, reason: error, domains: [] })
  }
  res.json({
    available: true,
    domains: (data.vms.domains || []).map((d) => ({
      id: d.id,
      name: d.name,
      state: d.state,
    })),
  })
})

router.get('/shares', async (_req, res, next) => {
  try {
    const { shares } = await gql(Q.shares)
    res.json(
      (shares || []).map((s) => ({
        name: s.name,
        comment: s.comment,
        usedBytes: num(s.used),
        freeBytes: num(s.free),
        sizeBytes: num(s.size),
        cache: s.cache,
        color: s.color,
      })),
    )
  } catch (e) {
    next(e)
  }
})

router.get('/ups', async (_req, res) => {
  const { data, error } = await gqlSafe(Q.ups)
  if (error || !data?.upsDevices) {
    return res.json({ available: false, reason: error, devices: [] })
  }
  res.json({
    available: true,
    devices: (data.upsDevices || []).map((u) => ({
      id: u.id,
      name: u.name,
      model: u.model,
      status: u.status,
      battery: u.battery,
      power: u.power,
    })),
  })
})

router.get('/notifications', async (_req, res, next) => {
  try {
    const { notifications } = await gql(Q.notifications)
    res.json({
      overview: notifications.overview,
      list: notifications.list || [],
    })
  } catch (e) {
    next(e)
  }
})

// ---------------------------------------------------------------------------
// Vue d'ensemble agrégée (un seul appel pour le dashboard / l'app mobile)
// Résiliente : chaque section échoue indépendamment.
// ---------------------------------------------------------------------------

router.get('/overview', async (_req, res) => {
  const [system, metrics, array, docker, vms, ups, notifications] =
    await Promise.all([
      gqlSafe(Q.system),
      gqlSafe(Q.metrics),
      gqlSafe(Q.array),
      gqlSafe(Q.docker),
      gqlSafe(Q.vms),
      gqlSafe(Q.ups),
      gqlSafe(Q.notifications),
    ])

  const sysInfo = system.data?.info
  const m = metrics.data?.metrics
  const arr = array.data?.array
  const containers = (docker.data?.docker?.containers || []).map(
    normalizeContainer,
  )
  const cap = arr?.capacity?.kilobytes || {}

  res.json({
    fetchedAt: new Date().toISOString(),
    system: sysInfo
      ? {
          hostname: sysInfo.os?.hostname,
          distro: sysInfo.os?.distro,
          uptime: sysInfo.os?.uptime,
          kernel: sysInfo.os?.kernel,
          unraid: sysInfo.versions?.core?.unraid,
          apiVersion: sysInfo.versions?.core?.api,
          cpu: sysInfo.cpu?.brand,
          cores: sysInfo.cpu?.cores,
          threads: sysInfo.cpu?.threads,
          model: sysInfo.system?.model,
          ip: sysInfo.primaryNetwork?.ipAddress,
        }
      : { error: system.error },
    metrics: m
      ? {
          cpuPercent: num(m.cpu?.percentTotal),
          memPercent: num(m.memory?.percentTotal),
          memUsed: num(m.memory?.used),
          memTotal: num(m.memory?.total),
          ...(() => {
            const temp = m.temperature ? buildTemperature(m.temperature) : null
            return {
              cpuTemp: temp?.cpu ?? null,
              tempAverage: temp?.average ?? null,
              tempHottest: temp?.hottest ?? null,
            }
          })(),
        }
      : { error: metrics.error },
    array: arr
      ? {
          state: arr.state,
          capacity: {
            totalKb: num(cap.total),
            usedKb: num(cap.used),
            freeKb: num(cap.free),
            percentUsed:
              cap.total && cap.used
                ? Math.round((num(cap.used) / num(cap.total)) * 1000) / 10
                : null,
          },
          diskCount: (arr.disks || []).length,
          cacheCount: (arr.caches || []).length,
          parityRunning: arr.parityCheckStatus?.running ?? false,
        }
      : { error: array.error },
    docker: {
      total: containers.length,
      running: containers.filter((c) => c.state === 'RUNNING').length,
      updatesAvailable: containers.filter((c) => c.updateAvailable).length,
      error: docker.error,
    },
    vms: vms.data?.vms
      ? {
          available: true,
          total: (vms.data.vms.domains || []).length,
          running: (vms.data.vms.domains || []).filter(
            (d) => d.state === 'RUNNING',
          ).length,
        }
      : { available: false },
    ups: ups.data?.upsDevices
      ? { available: true, devices: ups.data.upsDevices }
      : { available: false },
    notifications: notifications.data?.notifications
      ? { unread: notifications.data.notifications.overview?.unread }
      : { error: notifications.error },
  })
})

// ---------------------------------------------------------------------------
// Contrôles (mutations) — Docker & VM
// ---------------------------------------------------------------------------

const DOCKER_ACTIONS = {
  start: 'start',
  stop: 'stop',
  pause: 'pause',
  unpause: 'unpause',
}

router.post('/docker/:id/:action', async (req, res, next) => {
  const { id, action } = req.params
  const field = DOCKER_ACTIONS[action]
  if (!field) {
    return res
      .status(400)
      .json({ error: `Action invalide. Autorisées: ${Object.keys(DOCKER_ACTIONS).join(', ')}` })
  }
  try {
    const data = await gql(
      `mutation($id: PrefixedID!) { docker { ${field}(id: $id) { id state } } }`,
      { id },
    )
    res.json({ ok: true, container: data.docker?.[field] })
  } catch (e) {
    next(e)
  }
})

const VM_ACTIONS = {
  start: 'start',
  stop: 'stop',
  pause: 'pause',
  resume: 'resume',
  forceStop: 'forceStop',
  reboot: 'reboot',
  reset: 'reset',
}

router.post('/vms/:id/:action', async (req, res, next) => {
  const { id, action } = req.params
  const field = VM_ACTIONS[action]
  if (!field) {
    return res
      .status(400)
      .json({ error: `Action invalide. Autorisées: ${Object.keys(VM_ACTIONS).join(', ')}` })
  }
  try {
    const data = await gql(
      `mutation($id: PrefixedID!) { vm { ${field}(id: $id) } }`,
      { id },
    )
    res.json({ ok: true, result: data.vm?.[field] })
  } catch (e) {
    next(e)
  }
})

// ... at the end of the file, before export default router
import { execFile } from 'child_process'
import { promisify } from 'util'
import { hostArgv } from './host.js'
const execFileAsync = promisify(execFile)

router.get('/syslog', async (req, res, next) => {
  try {
    // hostArgv : sur l'hôte via nsenter si HOST_ACCESS (le syslog vit côté hôte).
    const [file, args] = hostArgv('tail', ['-n', '50', '/var/log/syslog'])
    const { stdout } = await execFileAsync(file, args, {
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024,
    })
    res.json({ logs: stdout })
  } catch (e) {
    // Si on n'est pas sur Unraid ou pas root, on renvoie une erreur ou un mock
    res.json({ logs: 'Impossible de lire /var/log/syslog : ' + e.message })
  }
})

router.get('/docker/:name/logs', async (req, res) => {
  const { name } = req.params
  if (!/^[a-zA-Z0-9_.\-]+$/.test(name)) {
    return res.status(400).json({ error: 'Nom de conteneur invalide' })
  }
  try {
    // hostArgv : `docker` de l'hôte via nsenter si HOST_ACCESS.
    const [file, args] = hostArgv('docker', ['logs', '--tail', '200', name])
    const { stdout, stderr } = await execFileAsync(file, args, {
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024,
    })
    res.json({ logs: (stdout + stderr) || '(aucun log)' })
  } catch (e) {
    res.json({ logs: 'Erreur : ' + (e.stderr || e.message) })
  }
})

export default router
