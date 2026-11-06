import { type FormEvent, useId, useState } from 'react'
import { ApiError } from '../lib/api'
import { Banner, Button, Field } from './ui'

/** A one-field form (used for "create home" and "add member") with validation and error display. */
export function NameForm({
  label,
  placeholder,
  submitLabel,
  onSubmit,
}: {
  label: string
  placeholder: string
  submitLabel: string
  onSubmit: (name: string) => Promise<void>
}) {
  const inputId = useId()
  const [name, setName] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    const trimmed = name.trim()
    if (!trimmed) {
      setFieldError(`${label} is required.`)
      return
    }
    if (trimmed.length > 120) {
      setFieldError(`${label} must be 120 characters or fewer.`)
      return
    }

    setFieldError(null)
    setServerError(null)
    setPending(true)
    try {
      await onSubmit(trimmed)
      setName('')
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : 'Something went wrong.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="stack" onSubmit={handleSubmit} noValidate>
      <Field label={label} htmlFor={inputId} error={fieldError}>
        <input
          id={inputId}
          value={name}
          placeholder={placeholder}
          maxLength={120}
          autoComplete="off"
          aria-invalid={fieldError !== null}
          onChange={(event) => {
            setName(event.target.value)
            setFieldError(null)
          }}
        />
      </Field>
      {serverError && <Banner tone="error">{serverError}</Banner>}
      <Button type="submit" icon="plus" loading={pending}>
        {submitLabel}
      </Button>
    </form>
  )
}
