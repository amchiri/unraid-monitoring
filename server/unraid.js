import 'dotenv/config'

const URL = process.env.UNRAID_GRAPHQL_URL
const KEY = process.env.UNRAID_API_KEY

if (!URL || !KEY) {
  console.warn('[unraid] UNRAID_GRAPHQL_URL ou UNRAID_API_KEY manquant dans .env')
}

/**
 * Exécute une requête GraphQL contre le serveur Unraid.
 * Lève une erreur si la requête échoue entièrement.
 */
export async function gql(query, variables = {}) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': KEY,
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(20000),
  })

  if (!res.ok) {
    throw new Error(`Unraid GraphQL HTTP ${res.status}`)
  }

  const json = await res.json()
  if (json.errors?.length) {
    // On remonte le premier message, mais on garde data si partiel
    const err = new Error(json.errors.map((e) => e.message).join('; '))
    err.graphqlErrors = json.errors
    err.data = json.data
    throw err
  }
  return json.data
}

/** Variante tolérante : renvoie { data, error } sans lever. */
export async function gqlSafe(query, variables = {}) {
  try {
    const data = await gql(query, variables)
    return { data, error: null }
  } catch (e) {
    return { data: e.data ?? null, error: e.message }
  }
}

// ---------------------------------------------------------------------------
// Requêtes par section (isolées : une section absente ne casse pas le reste)
// ---------------------------------------------------------------------------

export const Q = {
  online: `{ online }`,

  system: `{
    info {
      time
      os { hostname distro release kernel arch uptime uefi }
      cpu { manufacturer brand cores threads speed speedmax }
      system { manufacturer model }
      versions { core { unraid api kernel } }
      memory { layout { size type clockSpeed } }
      primaryNetwork { name ipAddress macAddress }
      networkInterfaces { name ipAddress macAddress status }
    }
  }`,

  metrics: `{
    metrics {
      cpu { percentTotal cpus { percentTotal } }
      memory { total used free available percentTotal swapTotal swapUsed percentSwapTotal }
      temperature {
        summary { average warningCount criticalCount hottest { name current { value unit } } }
        sensors { name current { value unit status } type location }
      }
    }
  }`,

  array: `{
    array {
      state
      capacity { kilobytes { free used total } disks { free used total } }
      parities { name device status temp size numErrors }
      disks { name device status temp size fsType fsSize fsFree fsUsed numReads numWrites numErrors rotational isSpinning }
      caches { name device status temp size fsType fsSize fsFree fsUsed }
      boot { name device status temp size }
      parityCheckStatus { running progress speed errors date duration }
    }
  }`,

  disks: `{
    disks {
      id name device type vendor size temperature smartStatus interfaceType isSpinning
    }
  }`,

  docker: `{
    docker {
      containers {
        id names image state status created autoStart autoStartOrder
        isUpdateAvailable isOrphaned iconUrl webUiUrl
        ports { privatePort publicPort type }
      }
    }
  }`,

  vms: `{
    vms { domains { id name state } }
  }`,

  shares: `{
    shares { name comment used free size cache color }
  }`,

  ups: `{
    upsDevices {
      id name model status
      battery { chargeLevel estimatedRuntime health }
      power { inputVoltage outputVoltage loadPercentage nominalPower currentPower }
    }
  }`,

  notifications: `{
    notifications {
      overview { unread { total info warning alert } archive { total } }
      list(filter: { type: UNREAD, offset: 0, limit: 25 }) {
        id title subject description importance type timestamp formattedTimestamp link
      }
    }
  }`,
}
