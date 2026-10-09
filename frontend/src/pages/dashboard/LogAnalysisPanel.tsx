import { useEffect, useMemo, useState } from 'react'
import { ApiError, analyzeSecurityLogs, getAIProviderModels, getAIProviders, type AIModel, type AIProvider, type LogAnalysisResult } from '../../lib/api'

type LogEvent = { id: number; line: number; timestamp: string; severity: 'critical' | 'high' | 'medium' | 'low' | 'info'; source: string; message: string; raw: string }
const patterns: Array<{ severity: LogEvent['severity']; regex: RegExp }> = [
  { severity: 'critical', regex: /\b(critical|emergency|emerg|fatal|ransomware|data exfiltration|privilege escalation)\b/i },
  { severity: 'high', regex: /\b(error|failed login|authentication failure|unauthorized|malware|sql injection|command injection|access denied|brute.?force)\b/i },
  { severity: 'medium', regex: /\b(warn(?:ing)?|timeout|suspicious|rate limit|invalid token|permission denied|blocked)\b/i },
  { severity: 'low', regex: /\b(retry|deprecated|unusual|not found|reset)\b/i },
]
function classify(raw: string): LogEvent['severity'] {
  for (const pattern of patterns) if (pattern.regex.test(raw)) return pattern.severity
  if (/\b(info|notice|debug|started|completed|success|accepted)\b/i.test(raw)) return 'info'
  return 'info'
}
function parseLine(raw: string, line: number, id: number): LogEvent {
  const timestampMatch = raw.match(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/ )
    || raw.match(/\b\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\b/)
  const levelMatch = raw.match(/\b(critical|fatal|emerg(?:ency)?|error|err|warn(?:ing)?|notice|info|debug)\b/i)
  const sourceMatch = raw.match(/(?:\[([^\]]+)\]|\b(?:host|hostname|service|src|process)=([\w./:-]+))/i)
  const severity = classify(raw)
  return { id, line, timestamp: timestampMatch?.[0] || '—', severity, source: sourceMatch?.[1] || sourceMatch?.[2] || levelMatch?.[0] || 'Unknown', message: raw.trim(), raw }
}
export function LogAnalysisPanel() {
  const [fileName, setFileName] = useState('')
  const [rawText, setRawText] = useState('')
  const [query, setQuery] = useState('')
  const [severity, setSeverity] = useState('all')
  const [error, setError] = useState('')
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [models, setModels] = useState<AIModel[]>([])
  const [providerId, setProviderId] = useState('')
  const [modelId, setModelId] = useState('')
  const [aiResult, setAiResult] = useState<LogAnalysisResult | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  useEffect(() => { let cancelled = false; getAIProviders().then(async (items) => { const enabled = items.filter(item => item.enabled); if (cancelled) return; setProviders(enabled); const modelLists = await Promise.all(enabled.map(item => getAIProviderModels(item.id))); if (cancelled) return; const firstIndex = modelLists.findIndex(list => list.length > 0); if (firstIndex >= 0) { setProviderId(enabled[firstIndex].id); setModels(modelLists[firstIndex]); setModelId(modelLists[firstIndex][0].id) } }).catch(() => { if (!cancelled) setAiError('Could not load AI providers. Check the backend connection and Settings → AI Providers.') }); return () => { cancelled = true } }, [])
  async function selectProvider(id: string) { setProviderId(id); setModelId(''); setModels([]); setAiResult(null); try { const found = await getAIProviderModels(id); setModels(found); setModelId(found[0]?.id || '') } catch { setAiError('Could not load models for this provider.') } }
  async function runAiAnalysis() { if (!rawText.trim() || !providerId || !modelId) return; setAiLoading(true); setAiError(''); setAiResult(null); try { setAiResult(await analyzeSecurityLogs(providerId, modelId, fileName || 'pasted-log.txt', rawText)) } catch (err) { setAiError(err instanceof ApiError ? `AI analysis failed (HTTP ${err.status}): ${err.detail || err.message}` : err instanceof Error ? `AI analysis failed: ${err.message}` : 'AI analysis failed due to an unexpected error. Check the backend terminal for details.') } finally { setAiLoading(false) } }
  const events = useMemo(() => rawText.split(/\r?\n/).map((line, index) => line.trim() ? parseLine(line, index + 1, index) : null).filter((item): item is LogEvent => item !== null), [rawText])
  const filtered = useMemo(() => events.filter((event) => (severity === 'all' || event.severity === severity) && (!query || event.raw.toLowerCase().includes(query.toLowerCase()))), [events, severity, query])
  const counts = useMemo(() => ({ critical: events.filter(e => e.severity === 'critical').length, high: events.filter(e => e.severity === 'high').length, medium: events.filter(e => e.severity === 'medium').length, low: events.filter(e => e.severity === 'low').length, info: events.filter(e => e.severity === 'info').length }), [events])
  async function loadFile(file?: File) {
    if (!file) return
    setError('')
    if (file.size > 10 * 1024 * 1024) { setError('Please select a log file smaller than 10 MB.'); return }
    try { setRawText(await file.text()); setFileName(file.name); setQuery(''); setSeverity('all') }
    catch { setError('Could not read this file. Try a plain-text .log, .txt, or .csv file.') }
  }
  function downloadReport() {
    const report = ['# CyberMind AI — Security Log Analysis', '', `- File: ${fileName || 'Pasted log text'}`, `- Analyzed: ${new Date().toLocaleString()}`, `- Non-empty log lines: ${events.length}`, '', '## Severity summary', ...Object.entries(counts).map(([key, value]) => `- ${key.toUpperCase()}: ${value}`), '', '## Flagged and observed events', ...filtered.map(event => `### Line ${event.line} — ${event.severity.toUpperCase()}\n\n${event.raw}`), '', '> This is a rule-based triage aid, not a confirmed incident determination. Validate findings against source systems and surrounding events.'].join('\n')
    const url = URL.createObjectURL(new Blob([report], { type: 'text/markdown;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'cybermind-security-log-report.md'; anchor.click(); URL.revokeObjectURL(url)
  }
  return <section className="log-analysis-panel project-detail-surface" aria-labelledby="log-analysis-title">
    <div className="project-analysis-heading"><div><p className="section-kicker">Security operations · Log triage</p><h3 id="log-analysis-title">Security Log Analysis</h3><p>Upload or paste application, server, authentication, or security logs to surface suspicious events and build a shareable report.</p></div><span className="project-analysis-step">LOG / 01</span></div>
    <div className="log-analysis-upload">
      <label className="log-analysis-file-label">Choose log file <input type="file" accept=".log,.txt,.csv,text/plain,text/csv" onChange={event => void loadFile(event.target.files?.[0])} /></label>
      <span>{fileName || 'Plain text · .log / .txt / .csv · up to 10 MB'}</span>
    </div>
    <label className="log-analysis-paste-label">Or paste log content<textarea value={rawText} onChange={event => { setRawText(event.target.value); setFileName('Pasted log text'); setError('') }} rows={7} placeholder={'2026-08-12T10:15:22Z ERROR Failed login for user admin from 203.0.113.10\n2026-08-12T10:16:01Z WARN Rate limit exceeded for client'} /></label>
    {error && <p className="project-form-error" role="alert">{error}</p>}
    <div className="log-ai-controls">
      <div><p className="section-kicker">AI-assisted investigation</p><strong>Analyze logs with your configured AI model</strong><p>Log content is sent to the selected provider through your CyberMind backend.</p></div>
      <div className="log-ai-selects">
        <label>AI provider<select value={providerId} onChange={event => void selectProvider(event.target.value)}><option value="">Select provider</option>{providers.map(provider => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label>
        <label>AI model<select value={modelId} onChange={event => { setModelId(event.target.value); setAiResult(null) }} disabled={!providerId}><option value="">Select model</option>{models.map(model => <option key={model.id} value={model.id}>{model.display_name}</option>)}</select></label>
        <button type="button" className="dialog-submit-button" disabled={!rawText.trim() || !providerId || !modelId || aiLoading} onClick={() => void runAiAnalysis()}>{aiLoading ? 'Analyzing with AI…' : 'Run AI analysis'}</button>
      </div>
      {!providers.length && <p className="project-analysis-hint">Configure and enable a provider and model in Settings → AI Providers to use AI analysis.</p>}
      {aiError && <p className="project-form-error" role="alert">{aiError}</p>}
    </div>
    {aiResult && <section className="log-ai-result" aria-live="polite">
      <div className="project-analysis-heading"><div><p className="section-kicker">AI analysis result</p><h3>Investigation summary</h3><p>{aiResult.lines_analyzed} lines analyzed · {aiResult.findings.length} findings</p></div><span className="project-analysis-step">AI / REPORT</span></div>
      <p>{aiResult.summary || 'The model returned no summary.'}</p>
      {!aiResult.findings.length ? <p className="project-analysis-hint">No specific security findings were returned. This does not guarantee the logs are benign.</p> : aiResult.findings.map((finding, index) => <article className="project-security-finding" key={finding.title + index}><div className="project-security-finding-top"><strong>{finding.title}</strong><span>{finding.severity}</span></div><p>{finding.description}</p><div><strong>Evidence</strong><p>{finding.evidence}</p></div><div><strong>Recommendation</strong><p>{finding.recommendation}</p></div></article>)}
      <ul>{aiResult.limitations.map(item => <li key={item}>{item}</li>)}</ul>
      <button type="button" className="dialog-submit-button" onClick={() => { const report = ['# CyberMind AI — AI Security Log Analysis', '', `File: ${aiResult.file_name}`, `Lines analyzed: ${aiResult.lines_analyzed}`, '', '## Summary', aiResult.summary, '', '## Findings', ...aiResult.findings.map(f => `### ${f.title} (${f.severity})\n\n${f.description}\n\n**Evidence:** ${f.evidence}\n\n**Recommendation:** ${f.recommendation}`), '', '## Limitations', ...aiResult.limitations.map(item => `- ${item}`)].join('\n'); const url = URL.createObjectURL(new Blob([report], {type:'text/markdown;charset=utf-8'})); const a = document.createElement('a'); a.href=url; a.download='cybermind-ai-security-log-analysis.md'; a.click(); URL.revokeObjectURL(url) }}>Download AI analysis report</button>
    </section>}
    <div className="log-analysis-summary" aria-label="Severity counts">
      {(['critical','high','medium','low','info'] as const).map(level => <button type="button" key={level} className={`log-severity-card log-severity-${level}`} onClick={() => setSeverity(severity === level ? 'all' : level)} aria-pressed={severity === level}><span>{level}</span><strong>{counts[level]}</strong></button>)}
    </div>
    <div className="log-analysis-toolbar"><label>Search logs <input value={query} onChange={event => setQuery(event.target.value)} placeholder="IP, username, error text…" /></label><label>Severity <select value={severity} onChange={event => setSeverity(event.target.value)}><option value="all">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="info">Info</option></select></label><button type="button" className="dialog-submit-button" disabled={!events.length} onClick={downloadReport}>Download Markdown report</button></div>
    <p className="log-analysis-disclaimer">Rule-based triage only: matching keywords are indicators, not proof of compromise. Lines without a recognized keyword are classified as informational.</p>
    <div className="log-analysis-results"><div className="log-analysis-results-heading"><strong>Events</strong><span>{filtered.length} of {events.length} lines</span></div>
      {!events.length ? <p className="project-analysis-hint">Choose a file or paste log lines above to begin analysis. Your log text is processed in this browser and is not sent to the backend by this panel.</p> : !filtered.length ? <p className="project-analysis-hint">No lines match the current search and severity filters.</p> : filtered.slice(0, 500).map(event => <article className="log-analysis-event" key={event.id}><div className="log-analysis-event-meta"><span className={`log-severity-pill log-severity-${event.severity}`}>{event.severity}</span><span>Line {event.line}</span><span>{event.timestamp}</span><span>{event.source}</span></div><p>{event.message}</p></article>)}
      {filtered.length > 500 && <p className="project-analysis-hint">Showing first 500 matching lines. Narrow your search to inspect more specific events.</p>}
    </div>
  </section>
}
