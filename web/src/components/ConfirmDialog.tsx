import { type ReactNode, useEffect, useRef } from 'react'
import { Button } from './ui'

/** A modal confirmation built on the native <dialog>, which handles focus and Escape for us. */
export function ConfirmDialog({
  title,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
  children,
}: {
  title: string
  confirmLabel: string
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => dialog?.close()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onCancel()
      }}
    >
      <h2 id="dialog-title">{title}</h2>
      <div className="dialog-body">{children}</div>
      <div className="dialog-actions">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="success" icon="check" loading={busy} onClick={onConfirm}>
          {busy ? 'Processing…' : confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}
