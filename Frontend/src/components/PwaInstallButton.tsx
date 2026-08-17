import { useEffect, useRef, useState } from 'react'
import { usePwaInstall } from '../hooks/usePwaInstall'

function PwaInstallButton() {
  const { canInstall, installed, isIos, install } = usePwaInstall()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDocDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [])

  if (installed) return null

  async function handleClick() {
    if (canInstall) {
      const accepted = await install()
      if (accepted) setOpen(false)
      return
    }
    setOpen((prev) => !prev)
  }

  return (
    <div className="pwa-install" ref={wrapRef}>
      <button
        type="button"
        className="pwa-install-btn"
        aria-label="Install FuelSNC"
        title="Install FuelSNC"
        aria-expanded={open}
        onClick={() => void handleClick()}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 3a1 1 0 0 1 1 1v8.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.42L11 12.59V4a1 1 0 0 1 1-1Zm-7 14a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z"
          />
        </svg>
      </button>
      {open ? (
        <div className="pwa-install-pop" role="dialog" aria-label="Install FuelSNC">
          <p>
            {isIos
              ? 'On iPhone or iPad, tap Share in Safari, then Add to Home Screen.'
              : 'Install FuelSNC to open it like an app. If your browser shows an install icon in the address bar, you can use that too.'}
          </p>
          {canInstall ? (
            <button type="button" className="btn btn-sm" onClick={() => void install()}>
              Install
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default PwaInstallButton
