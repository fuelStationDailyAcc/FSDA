import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_CHECK_MS = 60 * 60 * 1000

function PwaUpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      window.setInterval(() => {
        void registration.update()
      }, UPDATE_CHECK_MS)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="pwa-banner" role="status">
      <p>A new version of PetroBook is ready.</p>
      <div className="pwa-banner-actions">
        <button type="button" className="btn btn-sm" onClick={() => void updateServiceWorker(true)}>
          Reload
        </button>
        <button type="button" className="btn-ghost btn-sm" onClick={() => setNeedRefresh(false)}>
          Later
        </button>
      </div>
    </div>
  )
}

export default PwaUpdateBanner
