import { useState, useEffect } from 'react'

export const ECO_EVENT = 'eco-mode-change'

export function getEcoMode(): boolean {
  return localStorage.getItem('unraid-eco-mode') === 'true'
}

export function setEcoMode(enabled: boolean) {
  localStorage.setItem('unraid-eco-mode', String(enabled))
  window.dispatchEvent(new Event(ECO_EVENT))
}

export function useEcoMode() {
  const [eco, setEco] = useState(getEcoMode())
  useEffect(() => {
    const handler = () => setEco(getEcoMode())
    window.addEventListener(ECO_EVENT, handler)
    return () => window.removeEventListener(ECO_EVENT, handler)
  }, [])
  return { eco, setEco: setEcoMode }
}
