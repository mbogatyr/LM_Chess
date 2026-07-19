import { useCallback, useState } from 'react'

const STORAGE_KEY = 'lmchess.sound'

// Sound is on by default; only an explicit 'off' mutes it.
function readMuted(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'off'
}

export function useSoundPref(): { muted: boolean; toggle: () => void } {
  const [muted, setMuted] = useState(readMuted)

  const toggle = useCallback(() => {
    setMuted((prev) => {
      const next = !prev
      if (next) localStorage.setItem(STORAGE_KEY, 'off')
      else localStorage.removeItem(STORAGE_KEY)
      return next
    })
  }, [])

  return { muted, toggle }
}
