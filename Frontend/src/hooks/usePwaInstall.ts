import { useCallback, useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let savedPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

function isStandaloneDisplay() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && Boolean(window.navigator.standalone))
  )
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

function notify() {
  for (const listener of listeners) listener()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    savedPrompt = event as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    savedPrompt = null
    notify()
  })
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => savedPrompt
  )
  const [installed, setInstalled] = useState(() =>
    typeof window === 'undefined' ? false : isStandaloneDisplay()
  )

  useEffect(() => {
    const sync = () => {
      setDeferredPrompt(savedPrompt)
      setInstalled(isStandaloneDisplay())
    }
    listeners.add(sync)
    sync()
    return () => {
      listeners.delete(sync)
    }
  }, [])

  const install = useCallback(async () => {
    if (!savedPrompt) return false
    await savedPrompt.prompt()
    const choice = await savedPrompt.userChoice
    savedPrompt = null
    setDeferredPrompt(null)
    if (choice.outcome === 'accepted') setInstalled(true)
    notify()
    return choice.outcome === 'accepted'
  }, [])

  return {
    canInstall: Boolean(deferredPrompt) && !installed,
    installed,
    isIos: typeof window !== 'undefined' && isIosDevice(),
    install,
  }
}
