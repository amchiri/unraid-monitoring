import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { getToken, setToken } from '../lib/auth'
import { Btn } from './ui'

/**
 * Saisie du token d'accès API. Affiché automatiquement quand un appel a renvoyé
 * 401 (`forced`), ou ouvert manuellement pour changer le token.
 * À l'enregistrement, on recharge la page : tous les fetch et le WebSocket
 * terminal repartent avec le nouveau token.
 */
export function TokenGate({ forced, onClose }: { forced: boolean; onClose: () => void }) {
  const [value, setValue] = useState(getToken())

  function save() {
    setToken(value)
    location.reload()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
            <KeyRound size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Token d’accès</h2>
            <p className="text-xs text-zinc-400">
              {forced ? 'Accès protégé : saisis le token API.' : 'Modifier le token API enregistré.'}
            </p>
          </div>
        </div>

        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="API_TOKEN"
          autoFocus
          autoComplete="off"
          className="mb-4 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500/50"
        />

        <div className="flex justify-end gap-2">
          {!forced && (
            <Btn tone="zinc" onClick={onClose}>
              Annuler
            </Btn>
          )}
          <Btn tone="sky" onClick={save}>
            Enregistrer
          </Btn>
        </div>

        <p className="mt-3 text-[11px] text-zinc-600">
          Stocké sur cet appareil et envoyé en en-tête <code>Authorization: Bearer</code>. Doit
          correspondre à la variable <code>API_TOKEN</code> du conteneur.
        </p>
      </div>
    </div>
  )
}
