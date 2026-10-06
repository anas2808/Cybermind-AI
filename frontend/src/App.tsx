import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import './App.css'
import { DashboardShell } from './components/layout/DashboardShell'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'
import { supabase } from './lib/supabase'

type AuthView = 'login' | 'register'

function App() {
  const [view, setView] = useState<AuthView>('login')
  const [isResetRoute, setIsResetRoute] = useState(() => window.location.pathname === '/reset-password')
  const [session, setSession] = useState<Session | null>(null)
  const [hasRecoverySession, setHasRecoverySession] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [authError, setAuthError] = useState('')
  const [isSigningOut, setIsSigningOut] = useState(false)

  useEffect(() => {
    let isMounted = true
    const isRecoveryCallback = window.location.pathname === '/reset-password'
      && window.location.hash.includes('type=recovery')

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!isMounted) return
        if (error) {
          setAuthError('We could not restore your session. Please sign in again.')
        } else {
          setSession(data.session)
          if (isRecoveryCallback && data.session) {
            setHasRecoverySession(true)
          }
        }
        setIsInitializing(false)
      })
      .catch(() => {
        if (!isMounted) return
        setAuthError('We could not restore your session. Please sign in again.')
        setIsInitializing(false)
      })

    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return

      if (
        event === 'INITIAL_SESSION' ||
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'SIGNED_OUT' ||
        event === 'PASSWORD_RECOVERY'
      ) {
        setSession(nextSession)
        setAuthError('')
        setIsInitializing(false)
        if (event === 'PASSWORD_RECOVERY') {
          setHasRecoverySession(Boolean(nextSession))
        } else if (event === 'SIGNED_OUT') {
          setHasRecoverySession(false)
        }
      }
    })

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  async function handleSignOut() {
    if (isSigningOut) return

    setIsSigningOut(true)
    setAuthError('')
    const { error } = await supabase.auth.signOut()
    setIsSigningOut(false)

    if (error) {
      setAuthError('We could not sign you out. Please try again.')
    }
  }

  if (isInitializing) {
    return (
      <main className="auth-loading" aria-live="polite">
        <p>Restoring your CyberMind session...</p>
      </main>
    )
  }

  if (isResetRoute) {
    return (
      <ResetPasswordPage
        hasRecoverySession={hasRecoverySession}
        onReturnToLogin={() => {
          window.history.replaceState({}, '', '/')
          setHasRecoverySession(false)
          setIsResetRoute(false)
          setView('login')
        }}
      />
    )
  }

  if (session) {
    return (
      <DashboardShell
        email={session.user.email}
        error={authError}
        isSigningOut={isSigningOut}
        onSignOut={handleSignOut}
      />
    )
  }

  return view === 'login' ? (
    <>
      {authError && <p className="auth-global-error" role="alert">{authError}</p>}
      <LoginPage onSwitchToRegister={() => setView('register')} />
    </>
  ) : (
    <RegisterPage onSwitchToLogin={() => setView('login')} />
  )
}

export default App
