import type { InputHTMLAttributes } from 'react'

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  hint?: string
}

export function AuthField({ label, error, hint, id, ...props }: AuthFieldProps) {
  const messageId = `${id}-message`

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        {...props}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? messageId : undefined}
        className={error ? 'input input-error' : 'input'}
      />
      {(error || hint) && (
        <p id={messageId} className={error ? 'field-message field-error' : 'field-message'}>
          {error || hint}
        </p>
      )}
    </div>
  )
}
