import { useEffect, useRef } from 'react'
import { Card, ErrorNote, Skeleton, Btn } from './ui'
import { usePoll } from '../lib/usePoll'
import { ScrollText } from 'lucide-react'
import type { Container } from '../lib/api'

async function fetchSyslog() {
  const res = await fetch('/api/syslog')
  if (!res.ok) throw new Error('Erreur chargement logs')
  const json = await res.json()
  return json.logs as string
}

function makeDockerLogsFetcher(name: string) {
  return async function fetchDockerLogs() {
    const res = await fetch(`/api/docker/${encodeURIComponent(name)}/logs`)
    if (!res.ok) throw new Error('Erreur chargement logs')
    const json = await res.json()
    return json.logs as string
  }
}

export function SyslogPanel({
  dockerTarget,
  onBack,
}: {
  dockerTarget?: Container
  onBack?: () => void
}) {
  const fetcher = dockerTarget ? makeDockerLogsFetcher(dockerTarget.name) : fetchSyslog
  const { data, error } = usePoll(fetcher, 3000)
  const scrollRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [data])

  const title = dockerTarget ? `Logs — ${dockerTarget.name}` : 'Logs Système (syslog)'

  return (
    <Card
      title={title}
      icon={<ScrollText size={18} />}
      className="md:col-span-2 xl:col-span-3"
      right={
        onBack && (
          <Btn tone="sky" onClick={onBack}>
            ← Retour syslog
          </Btn>
        )
      }
    >
      <ErrorNote error={error} />
      {!data && !error && <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>}
      {data && (
        <pre
          ref={scrollRef}
          className="h-[250px] w-full overflow-y-auto rounded-lg border border-white/5 bg-[#050507] p-3 text-[10px] sm:text-xs text-zinc-400 font-mono leading-relaxed"
        >
          {data}
        </pre>
      )}
    </Card>
  )
}
