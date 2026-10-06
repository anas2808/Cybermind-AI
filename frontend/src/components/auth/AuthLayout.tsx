import type { ReactNode } from 'react'

type AuthLayoutProps = {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}

export function AuthLayout({
  eyebrow,
  title,
  description,
  children,
}: AuthLayoutProps) {
  return (
    <main className="auth-shell">
      <section className="auth-brand-panel" aria-label="About CyberMind AI">
        <div className="brand-lockup">
          <img className="brand-logo" src="/branding/logo.svg" alt="CyberMind AI" />
        </div>
        <div className="brand-message">
          <p className="brand-kicker">Intelligence, amplified.</p>
          <h2>Build with clarity. Think beyond limits.</h2>
          <p>AI-powered security analysis for the signals that matter.</p>
          <ul className="brand-capabilities" aria-label="CyberMind capabilities">
            <li>Code</li>
            <li>Logs</li>
            <li>Threats</li>
            <li>Projects</li>
          </ul>
        </div>
        <div className="brand-grid" aria-hidden="true" />
        <span className="brand-orbit brand-orbit-one" aria-hidden="true" />
        <span className="brand-orbit brand-orbit-two" aria-hidden="true" />
      </section>

      <section className="auth-content">
        <div className="auth-card">
          <div className="auth-heading">
            <p className="auth-eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          {children}
        </div>
        <p className="auth-footer">Secure access to your CyberMind workspace</p>
      </section>
    </main>
  )
}
