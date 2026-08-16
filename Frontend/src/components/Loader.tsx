type LoaderProps = {
  label?: string
  fullPage?: boolean
  overlay?: boolean
}

function Loader({ label = 'Loading…', fullPage = false, overlay = false }: LoaderProps) {
  const content = (
    <div className="loader" role="status" aria-live="polite" aria-busy="true">
      <span className="loader-ring" aria-hidden="true" />
      {label ? <span className="loader-label">{label}</span> : null}
    </div>
  )

  if (fullPage) {
    return <div className="loader-fullpage">{content}</div>
  }

  if (overlay) {
    return <div className="loader-overlay">{content}</div>
  }

  return content
}

export default Loader
