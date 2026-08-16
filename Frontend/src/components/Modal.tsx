import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react'

type ModalProps = {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
}

export function Modal({ title, open, onClose, children }: ModalProps) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={ref}
      >
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  )
}

type FormProps = {
  onSubmit: (e: FormEvent) => void
  children: ReactNode
  error?: string
  submitting?: boolean
  submitLabel?: string
  onCancel: () => void
}

export function ModalForm({
  onSubmit,
  children,
  error,
  submitting,
  submitLabel = 'Save',
  onCancel,
}: FormProps) {
  return (
    <form onSubmit={onSubmit}>
      <div className="modal-grid">{children}</div>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="modal-actions">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
