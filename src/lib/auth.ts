import { useSyncExternalStore } from 'react'

// ---------------------------------------------------------------------------
// Token d'accès API (côté navigateur / PWA).
//
// Quand le serveur définit API_TOKEN, tout /api/* (sauf /health) exige
// `Authorization: Bearer <token>` et le WebSocket terminal exige `?token=`.
// On stocke le token dans localStorage (persiste même en PWA installée) et on
// l'envoie à chaque requête. `needsAuth` passe à true dès qu'un appel renvoie
// 401, ce qui déclenche l'écran de saisie.
// ---------------------------------------------------------------------------

const TOKEN_KEY = 'unraid_token'

let needsAuth = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setToken(token: string) {
  try {
    const t = token.trim()
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* localStorage indisponible (mode privé) */
  }
  needsAuth = false
  emit()
}

/** Appelé par le client API quand un appel renvoie 401. */
export function markAuthRequired() {
  if (!needsAuth) {
    needsAuth = true
    emit()
  }
}

// Store React : expose l'état `needsAuth` aux composants.
const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
const snapshot = () => needsAuth

export function useAuthRequired(): boolean {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
