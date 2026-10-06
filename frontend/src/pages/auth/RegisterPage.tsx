import { useState, type FormEvent } from 'react'
import { AuthField } from '../../components/auth/AuthField'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { AuthSocialButtons } from '../../components/auth/AuthSocialButtons'
import { PasswordField } from '../../components/auth/PasswordField'
import { supabase } from '../../lib/supabase'

type RegisterPageProps = {
  onSwitchToLogin: () => void
}

export function RegisterPage({ onSwitchToLogin }: RegisterPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmation?: string }>({})
  const [formMessage, setFormMessage] = useState('')
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'github'>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [registrationComplete, setRegistrationComplete] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || registrationComplete) return

    const nextErrors: typeof errors = {}
    if (!email.trim()) nextErrors.email = 'Enter your email address.'
    else if (!/^\S+@\S+\.\S+$/.test(email)) nextErrors.email = 'Enter a valid email address.'
    if (!password) nextErrors.password = 'Enter a password.'
    if (password.length < 8) nextErrors.password = 'Use at least 8 characters.'
    if (confirmation !== password) nextErrors.confirmation = 'Passwords do not match.'

    setErrors(nextErrors)
    setFormMessage('')
    if (Object.keys(nextErrors).length > 0) return

    setIsSubmitting(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    })
    setIsSubmitting(false)

    if (error) {
      setFormMessage(getRegistrationErrorMessage(error.message))
      return
    }

    setRegistrationComplete(true)
    setFormMessage(
      data.session
        ? 'Your account has been created successfully.'
        : 'Your account has been created. Check your email to confirm your account before signing in.',
    )
  }

  async function handleProviderSelect(provider: 'google' | 'github') {
    if (isSubmitting || registrationComplete) return

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

  const isBusy = Boolean(loadingProvider) || isSubmitting

  return (
    <AuthLayout eyebrow="Get started" title="Create your account" description="Set up your space for more focused thinking.">
      <AuthSocialButtons disabled={isBusy || registrationComplete} loadingProvider={loadingProvider} onProviderSelect={handleProviderSelect} />
      <div className="divider"><span>or use your email</span></div>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {formMessage && (
          <p className="form-message" role={registrationComplete ? 'status' : 'alert'}>
            {formMessage}
          </p>
        )}
        <AuthField id="register-email" label="Email address" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} error={errors.email} placeholder="you@example.com" />
        <PasswordField id="register-password" label="Password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} error={errors.password} hint="At least 8 characters" placeholder="Create a password" />
        <PasswordField id="register-confirmation" label="Confirm password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} error={errors.confirmation} placeholder="Repeat your password" />
        <button className="primary-button" type="submit" disabled={isBusy || registrationComplete}>
          {isSubmitting ? 'Creating account...' : registrationComplete ? 'Account created' : 'Create account'}
        </button>
      </form>
      <p className="terms-copy">By continuing, you agree to use CyberMind responsibly.</p>
      <p className="switch-prompt">Already have an account? <button type="button" className="text-button" onClick={onSwitchToLogin}>Sign in</button></p>
    </AuthLayout>
  )
}

function getRegistrationErrorMessage(errorMessage: string) {
  const normalizedMessage = errorMessage.toLowerCase()

  if (normalizedMessage.includes('already registered') || normalizedMessage.includes('already exists')) {
    return 'An account with this email already exists. Try signing in instead.'
  }

  if (normalizedMessage.includes('password')) {
    return 'Choose a stronger password and try again.'
  }

  if (normalizedMessage.includes('rate limit')) {
    return 'Too many attempts. Please wait a moment and try again.'
  }

  return 'We could not create your account. Please check your details and try again.'
}
