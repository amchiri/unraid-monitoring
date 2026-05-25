import { useState } from 'react'
import { api, type Vm } from '../lib/api'
import { usePoll } from '../lib/usePoll'
import { Card, ErrorNote, Dot, Btn, Skeleton } from './ui'
import { MonitorPlay } from 'lucide-react'

function VmRow({ vm, onDone }: { vm: Vm; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const running = vm.state === 'RUNNING'

  async function act(action: 'start' | 'stop') {
    setBusy(true)
    setErr(null)
    try {
      await api.vmAction(vm.id, action)
      setTimeout(onDone, 800)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <tr className="border-t border-white/5">
      <td className="py-2">
        <span className="flex items-center gap-2">
          <Dot ok={running} warn={vm.state === 'PAUSED'} />
          <span className="font-medium text-zinc-200">{vm.name}</span>
          <span className="text-[11px] font-medium tracking-wide text-zinc-500">{vm.state}</span>
        </span>
        {err && <span className="block text-[11px] text-rose-400 mt-1">{err}</span>}
      </td>
      <td className="py-2 text-right">
        <Btn tone={running ? 'red' : 'green'} disabled={busy} onClick={() => act(running ? 'stop' : 'start')}>
          {busy ? '…' : running ? 'Stop' : 'Start'}
        </Btn>
      </td>
    </tr>
  )
}

export function VmsPanel() {
  const { data, error, refresh } = usePoll(api.vms, 15000)

  if (data && !data.available) {
    return (
      <Card title="Machines virtuelles" icon={<MonitorPlay size={18} />}>
        <p className="py-4 text-center text-sm font-medium text-zinc-500">VMs non disponibles sur ce serveur</p>
      </Card>
    )
  }

  return (
    <Card title="Machines virtuelles" icon={<MonitorPlay size={18} />} right={data && <span className="text-xs text-zinc-400 font-bold uppercase">{data.domains.length} vms</span>}>
      <ErrorNote error={error} />
      {!data && !error && <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>}
      {data && (
        <table className="w-full text-sm">
          <tbody>
            {data.domains.map((vm) => (
              <VmRow key={vm.id} vm={vm} onDone={refresh} />
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}
