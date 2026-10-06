import { useState, type FormEvent } from 'react'
import { AuthField } from '../../components/auth/AuthField'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { AuthSocialButtons } from '../../components/auth/AuthSocialButtons'
import { PasswordField } from '../../components/auth/PasswordField'
import { supabase } from '../../lib/supabase'

type LoginPageProps = {
  onSwitchToRegister: () => void
}

export function LoginPage({ onSwitchToRegister }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [formMessage, setFormMessage] = useState('')
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'github'>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loginComplete, setLoginComplete] = useState(false)
  const [showResetRequest, setShowResetRequest] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetFieldError, setResetFieldError] = useState('')
  const [resetMessage, setResetMessage] = useState('')
  const [isResetSubmitting, setIsResetSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || loginComplete) return

    const nextErrors: typeof errors = {}
    if (!email.trim()) nextErrors.email = 'Enter your email address.'
    else if (!/^\S+@\S+\.\S+$/.test(email)) nextErrors.email = 'Enter a valid email address.'
    if (!password) nextErrors.password = 'Enter your password.'

    setErrors(nextErrors)
    setFormMessage('')
    if (Object.keys(nextErrors).length > 0) return

    setIsSubmitting(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        setFormMessage(getLoginErrorMessage(error.message))
        return
      }

      if (!data.session) {
        setFormMessage('We could not complete sign in. Please try again.')
        return
      }

      setLoginComplete(true)
      setFormMessage('Signed in successfully.')
    } catch {
      setFormMessage('We could not connect to authentication. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleProviderSelect(provider: 'google' | 'github') {
    if (isSubmitting || loginComplete) return

    setLoadingProvider(provider)

    if (provider === 'github') {
      setFormMessage('')
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'github',
          options: {
            redirectTo: window.location.origin,
          },
        })

        if (error) {
          setFormMessage('We could not start GitHub sign in. Please try again.')
          setLoadingProvider(undefined)
        }
      } catch {
        setFormMessage('We could not start GitHub sign in. Please try again.')
        setLoadingProvider(undefined)
      }
      return
    }

    setFormMessage('')

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      })

      if (error) {
        setFormMessage('We could not start Google sign in. Please try again.')
        setLoadingProvider(undefined)
      }
    } catch {
      setFormMessage('We could not start Google sign in. Please try again.')
      setLoadingProvider(undefined)
    }
  }

  async function handleResetRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isResetSubmitting) return

    const trimmedEmail = email.trim()
    setResetError('')
    setResetFieldError('')
    setResetMessage('')

    if (!trimmedEmail) {
      setResetFieldError('Enter your email address.')
      return
    }

    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setResetFieldError('Enter a valid email address.')
      return
    }

    setIsResetSubmitting(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        setResetError('We could not send reset instructions. Please try again.')
        return
      }

      setResetMessage(
        "If an account exists for this email, we've sent instructions to reset your password. Check your inbox.",
      )
    } catch {
      setResetError('We could not send reset instructions. Please try again.')
    } finally {
      setIsResetSubmitting(false)
    }
  }

  function returnToLogin() {
    setShowResetRequest(false)
    setResetError('')
    setResetFieldError('')
    setResetMessage('')
  }

  const isBusy = Boolean(loadingProvider) || isSubmitting

  if (showResetRequest) {
    return (
      <AuthLayout
        eyebrow="Account recovery"
        title="Reset your password"
        description="Enter your email and we'll send you a secure reset link."
      >
        <form className="auth-form" onSubmit={handleResetRequest} noValidate>
          {resetError && <p className="form-message" role="alert">{resetError}</p>}
          {resetMessage && <p className="form-message" role="status">{resetMessage}</p>}
          <AuthField
            id="reset-email"
            label="Email address"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={resetFieldError}
            placeholder="you@example.com"
            disabled={isResetSubmitting}
          />
          <button className="primary-button" type="submit" disabled={isResetSubmitting}>
            {isResetSubmitting ? 'Sending instructions...' : 'Send reset instructions'}
          </button>
        </form>
        <p className="switch-prompt">
          <button type="button" className="text-button" onClick={returnToLogin} disabled={isResetSubmitting}>
            Return to sign in
          </button>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout eyebrow="Welcome back" title="Sign in to CyberMind" description="Continue where your thinking left off.">
      <AuthSocialButtons disabled={isBusy || loginComplete} loadingProvider={loadingProvider} onProviderSelect={handleProviderSelect} />
      <div className="divider"><span>or continue with email</span></div>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {formMessage && (
          <p className="form-message" role={loginComplete ? 'status' : 'alert'}>
            {formMessage}
          </p>
        )}
        <AuthField id="login-email" label="Email address" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} error={errors.email} placeholder="you@example.com" disabled={isBusy || loginComplete} />
        <PasswordField id="login-password" label="Password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} error={errors.password} placeholder="Enter your password" disabled={isBusy || loginComplete} />
        <div className="form-options">
          <label className="checkbox-label"><input type="checkbox" disabled={isBusy || loginComplete} /> <span>Remember me</span></label>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setShowResetRequest(true)
              setFormMessage('')
              setErrors({})
              setResetError('')
              setResetFieldError('')
              setResetMessage('')
            }}
            disabled={isBusy || loginComplete}
          >
            Forgot password?
          </button>
        </div>
        <button className="primary-button" type="submit" disabled={isBusy || loginComplete}>
          {isSubmitting ? 'Signing in...' : loginComplete ? 'Signed in' : 'Sign in'}
        </button>
      </form>
      <p className="switch-prompt">New to CyberMind? <button type="button" className="text-button" onClick={onSwitchToRegister}>Create an account</button></p>
    </AuthLayout>
  )
}

function getLoginErrorMessage(errorMessage: string) {
  const normalizedMessage = errorMessage.toLowerCase()

  if (
    normalizedMessage.includes('email not confirmed') ||
    normalizedMessage.includes('email_not_confirmed')
  ) {
    return 'Please confirm your email address before signing in.'
  }

  if (
    normalizedMessage.includes('invalid login credentials') ||
    normalizedMessage.includes('invalid email') ||
    normalizedMessage.includes('invalid password')
  ) {
    return 'Your email or password is incorrect.'
  }

  if (normalizedMessage.includes('network') || normalizedMessage.includes('fetch')) {
    return 'We could not connect to authentication. Please try again.'
  }

  return 'We could not sign you in. Please check your details and try again.'
}
