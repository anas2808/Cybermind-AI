import { useState, type FormEvent } from 'react'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { PasswordField } from '../../components/auth/PasswordField'
import { supabase } from '../../lib/supabase'

type ResetPasswordPageProps = {
  hasRecoverySession: boolean
  onReturnToLogin: () => void
}

export function ResetPasswordPage({
  hasRecoverySession,
  onReturnToLogin,
}: ResetPasswordPageProps) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirmation?: string }>({})
  const [formMessage, setFormMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [updateComplete, setUpdateComplete] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || updateComplete) return

    if (!hasRecoverySession) {
      setFormMessage('This password reset link is invalid or has expired. Please request a new reset link.')
      return
    }

    const nextErrors: typeof errors = {}
    if (!password) nextErrors.password = 'Enter a new password.'
    else if (password.length < 8) nextErrors.password = 'Use at least 8 characters.'
    if (!confirmation) nextErrors.confirmation = 'Confirm your new password.'
    else if (confirmation !== password) nextErrors.confirmation = 'Passwords do not match.'

    setErrors(nextErrors)
    setFormMessage('')
    if (Object.keys(nextErrors).length > 0) return

    setIsSubmitting(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        setFormMessage(getPasswordUpdateErrorMessage(error.message))
        return
      }

      setUpdateComplete(true)
      setFormMessage('Your password has been updated successfully.')
    } catch {
      setFormMessage('We could not update your password. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleReturnToLogin() {
    if (isSubmitting) return

    if (updateComplete) {
      const { error } = await supabase.auth.signOut()
      if (error) {
        setFormMessage('Your password was updated, but we could not finish signing out. Please try again.')
        return
      }
    }

    onReturnToLogin()
  }

  const sessionError = !hasRecoverySession
    ? 'This password reset link is invalid or has expired. Please request a new reset link.'
    : ''

  return (
    <AuthLayout
      eyebrow="Account recovery"
      title="Reset your password"
      description="Choose a new password for your CyberMind account."
    >
      {sessionError ? (
        <div className="reset-state">
          <p className="form-message" role="alert">{sessionError}</p>
          <button className="primary-button" type="button" onClick={onReturnToLogin}>
            Return to sign in
          </button>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {formMessage && (
            <p className="form-message" role={updateComplete ? 'status' : 'alert'}>
              {formMessage}
            </p>
          )}
          <PasswordField
            id="reset-password"
            label="New password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
            hint="At least 8 characters"
            placeholder="Create a new password"
            disabled={isSubmitting || updateComplete}
          />
          <PasswordField
            id="reset-confirmation"
            label="Confirm new password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            error={errors.confirmation}
            placeholder="Repeat your new password"
            disabled={isSubmitting || updateComplete}
          />
          <button className="primary-button" type="submit" disabled={isSubmitting || updateComplete}>
            {isSubmitting ? 'Updating password...' : updateComplete ? 'Password updated' : 'Update password'}
          </button>
          {updateComplete && (
            <button className="text-button reset-return-button" type="button" onClick={handleReturnToLogin}>
              Continue to sign in
            </button>
          )}
        </form>
      )}
    </AuthLayout>
  )
}

function getPasswordUpdateErrorMessage(errorMessage: string) {
  const normalizedMessage = errorMessage.toLowerCase()

  if (
    normalizedMessage.includes('expired') ||
    normalizedMessage.includes('invalid') ||
    normalizedMessage.includes('session')
  ) {
    return 'This password reset link is invalid or has expired. Please request a new reset link.'
  }

  if (normalizedMessage.includes('password')) {
    return 'Choose a stronger password and try again.'
  }

  return 'We could not update your password. Please try again.'
}
