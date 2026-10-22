import { useEffect, useMemo, useRef, useState } from 'react'
import { analyzeSecurityLogs, getAIProviderModels, getAIProviders, type AIModel, type AIProvider, type LogAnalysisResult } from '../../lib/api'

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
type LogEvent = { id: number; line: number; timestamp: string; date: number | null; severity: Severity; source: string; message: string; raw: string }
type SortKey = 'timestamp' | 'severity'

const severityOrder: Severity[] = ['critical', 'high', 'medium', 'low', 'info']
const severityLabels: Record<Severity, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Informational' }
const severityColors: Record<Severity, string> = { critical: '#c95c63', high: '#d97842', medium: '#c99a3d', low: '#3f83b5', info: '#78909c' }
const severityRank: Record<Severity, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 }
const patterns: Array<{ severity: Severity; regex: RegExp }> = [
  { severity: 'critical', regex: /\b(critical|emergency|emerg|fatal|ransomware|data exfiltration|privilege escalation)\b/i },
  { severity: 'high', regex: /\b(error|failed login|authentication failure|unauthorized|malware|sql injection|command injection|access denied|brute.?force)\b/i },
  { severity: 'medium', regex: /\b(warn(?:ing)?|timeout|suspicious|rate limit|invalid token|permission denied|blocked)\b/i },
  { severity: 'low', regex: /\b(retry|deprecated|unusual|not found|reset)\b/i },
]

function classify(raw: string): Severity {
  for (const pattern of patterns) if (pattern.regex.test(raw)) return pattern.severity
  return 'info'
}

function parseDate(value: string) {
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

function parseLine(raw: string, line: number, id: number): LogEvent {
  const timestampMatch = raw.match(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/) || raw.match(/\b\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\b/)
  const levelMatch = raw.match(/\b(critical|fatal|emerg(?:ency)?|error|err|warn(?:ing)?|notice|info|debug)\b/i)
  const sourceMatch = raw.match(/(?:\[([^\]]+)\]|\b(?:host|hostname|service|src|process)=([\w./:-]+))/i)
  const timestamp = timestampMatch?.[0] || '—'
  return { id, line, timestamp, date: parseDate(timestamp), severity: classify(raw), source: sourceMatch?.[1] || sourceMatch?.[2] || levelMatch?.[0] || 'Unknown', message: raw.trim(), raw }
}

function formatTime(date: number | null, fallback: string) {
  if (date === null) return fallback
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

function downloadText(filename: string, content: string, type = 'text/markdown;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function SeverityIcon({ severity }: { severity: Severity }) {
  return <span className="log-severity-icon" style={{ color: severityColors[severity] }} aria-hidden="true">{severity === 'info' ? 'i' : '!'}</span>
}

function TimelineChart({ events }: { events: LogEvent[] }) {
  const dated = events.filter((event) => event.date !== null)
  if (!dated.length) return <p className="log-chart-empty">Timestamped events will appear here after parsing.</p>
  const min = Math.min(...dated.map((event) => event.date as number))
  const max = Math.max(...dated.map((event) => event.date as number))
  const span = Math.max(max - min, 1)
  const bucketCount = Math.min(12, Math.max(4, dated.length))
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({ label: '', values: { critical: 0, high: 0, medium: 0, low: 0, info: 0 } as Record<Severity, number>, index }))
  dated.forEach((event) => {
    const index = Math.min(bucketCount - 1, Math.floor((((event.date as number) - min) / span) * bucketCount))
    buckets[index].values[event.severity] += 1
  })
  const maxTotal = Math.max(...buckets.map((bucket) => severityOrder.reduce((sum, key) => sum + bucket.values[key], 0)), 1)
  return <div className="log-chart" role="img" aria-label="Events over time by severity">
    <div className="log-chart-y"><span>{maxTotal}</span><span>{Math.ceil(maxTotal / 2)}</span><span>0</span></div>
    <div className="log-chart-plot">
      <div className="log-bars">{buckets.map((bucket) => <div className="log-bar-group" key={bucket.index} title={`${severityOrder.reduce((sum, key) => sum + bucket.values[key], 0)} events`}>
        <div className="log-stacked-bar">{severityOrder.map((key) => <span key={key} style={{ height: `${(bucket.values[key] / maxTotal) * 100}%`, background: severityColors[key] }} />)}</div>
        <small>{formatTime(min + (span * (bucket.index + .5)) / bucketCount, '')}</small>
      </div>)}</div>
    </div>
  </div>
}

function DistributionChart({ counts, total }: { counts: Record<Severity, number>; total: number }) {
  const radius = 45
  const circumference = 2 * Math.PI * radius
  let offset = 0
  return <div className="log-distribution">
    <div className="log-donut-wrap">
      <svg viewBox="0 0 120 120" className="log-donut" aria-label={`Distribution of ${total} events`}>
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#e7edf0" strokeWidth="15" />
        {total > 0 && severityOrder.map((key) => {
          const length = (counts[key] / total) * circumference
          const circle = <circle key={key} cx="60" cy="60" r={radius} fill="none" stroke={severityColors[key]} strokeWidth="15" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} />
          offset += length
          return circle
        })}
      </svg>
      <div className="log-donut-total"><strong>{total}</strong><span>log lines</span></div>
    </div>
    <div className="log-legend">{severityOrder.map((key) => <div key={key}><span className="log-legend-dot" style={{ background: severityColors[key] }} /><span>{severityLabels[key]}</span><strong>{counts[key]}</strong><small>{total ? Math.round((counts[key] / total) * 100) : 0}%</small></div>)}</div>
  </div>
}

function OverviewChart({ events }: { events: LogEvent[] }) {
  const categories = severityOrder.map((severity) => ({ severity, total: events.filter((event) => event.severity === severity).length, dated: events.filter((event) => event.severity === severity && event.date !== null).length }))
  const max = Math.max(...categories.map((item) => item.total), 1)
  return <div className="log-overview-chart">{categories.map((item) => <div className="log-overview-row" key={item.severity}><span>{severityLabels[item.severity]}</span><div><i style={{ width: `${(item.total / max) * 100}%`, background: severityColors[item.severity] }} /></div><strong>{item.total}</strong><small>{item.dated ? `${item.dated} timestamped` : 'No timestamp'}</small></div>)}</div>
}

export function LogAnalysisPanel() {
  const [fileName, setFileName] = useState('')
  const [logType, setLogType] = useState('auto_detect')
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>(['critical', 'high', 'medium', 'low', 'info'])
  const [rawText, setRawText] = useState('')
  const [query, setQuery] = useState('')
  const [severity, setSeverity] = useState<Severity | 'all'>('all')
  const [sort, setSort] = useState<SortKey>('timestamp')
  const [sortDescending, setSortDescending] = useState(true)
  const [page, setPage] = useState(1)
  const [activeTab, setActiveTab] = useState<'paste' | 'upload'>('paste')
  const [selectedEvent, setSelectedEvent] = useState<LogEvent | null>(null)
  const [error, setError] = useState('')
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [models, setModels] = useState<AIModel[]>([])
  const [providerId, setProviderId] = useState('')
  const [modelId, setModelId] = useState('')
  const [aiEnabled, setAiEnabled] = useState(true)
  const [aiResult, setAiResult] = useState<LogAnalysisResult | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [insightTab, setInsightTab] = useState<'overview' | 'findings' | 'recommendations' | 'timeline' | 'evidence'>('overview')
  const [expandedFindings, setExpandedFindings] = useState<number[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pageSize = 25

  useEffect(() => {
    let cancelled = false
    getAIProviders().then(async (items) => {
      const enabled = items.filter((item) => item.enabled)
      const modelLists = await Promise.all(enabled.map((item) => getAIProviderModels(item.id)))
      if (cancelled) return
      setProviders(enabled)
      const firstIndex = modelLists.findIndex((list) => list.length > 0)
      if (firstIndex >= 0) { setProviderId(enabled[firstIndex].id); setModels(modelLists[firstIndex]); setModelId(modelLists[firstIndex][0].id) }
    }).catch(() => { if (!cancelled) setAiError('Could not load AI providers. Check Settings → AI Providers.') })
    return () => { cancelled = true }
  }, [])

  const events = useMemo(() => rawText.split(/\r?\n/).map((line, index) => line.trim() ? parseLine(line, index + 1, index) : null).filter((item): item is LogEvent => item !== null), [rawText])
  const counts = useMemo(() => severityOrder.reduce((result, key) => ({ ...result, [key]: events.filter((event) => event.severity === key).length }), {} as Record<Severity, number>), [events])
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return events.filter((event) => (severity === 'all' || event.severity === severity) && (!normalized || event.raw.toLowerCase().includes(normalized))).sort((a, b) => {
      const comparison = sort === 'severity' ? severityRank[a.severity] - severityRank[b.severity] : (a.date || 0) - (b.date || 0)
      return sortDescending ? -comparison : comparison
    })
  }, [events, query, severity, sort, sortDescending])
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visibleEvents = filtered.slice((page - 1) * pageSize, page * pageSize)
  const total = events.length

  function resetFilters() { setQuery(''); setSeverity('all'); setPage(1) }
  function replaceText(text: string, name: string) { setRawText(text); setFileName(name); resetFilters(); setError(''); setAiResult(null) }
  async function loadFile(file?: File) {
    if (!file) return
    const isJson = file.name.toLowerCase().endsWith('.json')
    const sizeLimit = isJson ? 25 * 1024 * 1024 : 10 * 1024 * 1024
    if (file.size > sizeLimit) { setError(`Please select a file smaller than ${isJson ? '25 MB' : '10 MB'}.`); return }
    try {
      const content = await file.text()
      if (isJson) {
        const parsed: unknown = JSON.parse(content)
        if (!parsed || typeof parsed !== 'object' || !('events' in parsed) || !Array.isArray((parsed as { events: unknown }).events)) {
          setError('This JSON does not look like a CyberMind Windows event export. Select windows_events.json from the collector.')
          return
        }
        const exportData = parsed as { computer_name?: string; collected_at?: string; events: Array<Record<string, unknown>> }
        const lines = exportData.events.map((event) => [
          event.time_created || '',
          event.level || 'Unknown',
          event.log_name || 'Windows',
          `EventID=${event.event_id ?? 'Unknown'}`,
          `Provider=${event.provider || 'Unknown'}`,
          event.message || '(No event message)',
        ].filter(Boolean).join(' | '))
        const metadata = [
          '# CyberMind AI Windows Event Export',
          `# Computer: ${exportData.computer_name || 'Unknown'}`,
          `# Collected at: ${exportData.collected_at || 'Unknown'}`,
          `# Events: ${lines.length}`,
          '',
        ].join('\n')
        replaceText(metadata + lines.join('\n'), file.name)
      } else {
        replaceText(content, file.name)
      }
      setActiveTab('upload')
    } catch {
      setError(isJson ? 'Could not parse this JSON file. Please use the original windows_events.json export.' : 'Could not read this file. Try a plain-text .log, .txt, .csv, or Windows event .json file.')
    }
  }
  async function selectProvider(id: string) {
    setProviderId(id); setModelId(''); setModels([]); setAiResult(null)
    try { const nextModels = await getAIProviderModels(id); setModels(nextModels); setModelId(nextModels[0]?.id || '') } catch { setAiError('Could not load models for this provider.') }
  }
  async function runAiAnalysis() {
    if (!rawText.trim() || !providerId || !modelId) return
    setAiLoading(true); setAiError('')
    try { setAiResult(await analyzeSecurityLogs(providerId, modelId, fileName || 'pasted-log.txt', rawText, logType, selectedSeverities)) } catch { setAiError('AI analysis failed. Check provider/model connectivity and the 200,000-character limit.') } finally { setAiLoading(false) }
  }
  function downloadReport() {
    const report = ['# CyberMind AI — Security Log Analysis', '', `- File: ${fileName || 'Pasted log text'}`, `- Analyzed: ${new Date().toLocaleString()}`, `- Non-empty log lines: ${events.length}`, '', '## Severity summary', ...severityOrder.map((key) => `- ${severityLabels[key].toUpperCase()}: ${counts[key]}`), '', '## Flagged and observed events', ...events.map((event) => `### Line ${event.line} — ${event.severity.toUpperCase()}\n\n${event.raw}`), '', '> This is a rule-based triage aid, not a confirmed incident determination. Validate findings against source systems and surrounding events.'].join('\n')
    downloadText('cybermind-security-log-report.md', report)
  }
  function clearAnalysis() { replaceText('', ''); setAiError(''); setAiResult(null); setActiveTab('paste') }
  function toggleSort(nextSort: SortKey) { if (sort === nextSort) setSortDescending((value) => !value); else { setSort(nextSort); setSortDescending(true) } setPage(1) }
  function downloadAiReport() {
    if (!aiResult) return
    const recommendations = aiResult.recommendations || { immediate: [], short_term: [], preventive: [] }
    const report = [
      '# CyberMind AI — AI Security Log Analysis', '',
      `- File: ${aiResult.file_name}`, `- Analyzed: ${new Date().toLocaleString()}`,
      `- Lines analyzed: ${aiResult.lines_analyzed}`, `- Time range: ${aiResult.time_range || 'Not available'}`,
      `- Assessment: ${aiResult.assessment || 'uncertain'}`, '',
      '## Executive summary', aiResult.summary || 'No summary returned.', '',
      '## Key findings',
      ...aiResult.findings.map((finding) => [
        `### ${finding.title} (${finding.severity})`, finding.description,
        `**Why it matters:** ${finding.why_it_matters || 'Not provided.'}`,
        `**Evidence:** ${finding.evidence || 'No linked evidence provided.'}`,
        `**Timestamp/source:** ${finding.timestamp || 'Not provided'} / ${finding.source || 'Not provided'}`,
        `**Recommendation:** ${finding.recommendation}`, `**Follow-up:** ${finding.follow_up || 'Not provided.'}`,
      ].join('\n\n')), '',
      '## Prioritized recommendations',
      ...(['immediate', 'short_term', 'preventive'] as const).flatMap((key) => [`### ${key.replace('_', ' ')}`, ...(recommendations[key] || []).map((item) => `- ${item}`)]), '',
      '## Timeline and correlation', ...((aiResult.timeline || []).map((item) => `- ${item.timestamp || 'Undated'} — ${item.event}. ${item.significance} Evidence: ${item.evidence}`)), '',
      '## Limitations and uncertainty', ...aiResult.limitations.map((item) => `- ${item}`),
    ].join('\n')
    downloadText('cybermind-ai-security-log-analysis.md', report)
  }

  return <section className="log-analysis-panel" aria-labelledby="log-analysis-title">
    <header className="log-dashboard-heading"><div><p className="section-kicker">Security operations · Log triage</p><h2 id="log-analysis-title">Security Log Analysis</h2><p>Upload or paste application, server, authentication, or security logs to surface suspicious events and build a shareable report.</p></div><span className="log-analysis-status"><i /> Rule-based + AI assisted</span></header>

    <section className="log-card log-collector-card" aria-labelledby="windows-collector-title">
      <div className="log-card-heading"><div><h3 id="windows-collector-title">Collect Windows event logs</h3><p>Collect logs on your Windows computer, then import them here for review.</p></div><span className="log-step">QUICK START</span></div>
      <div className="log-collector-steps">
        <article><span>1</span><div><strong>Download the collector</strong><p>Get the read-only PowerShell script. It reads the System and Application logs only.</p><a className="log-collector-link" href="https://raw.githubusercontent.com/anas2808/CyberMind-AI/feature/security-log-analysis/windows_collector/collect_events.ps1" target="_blank" rel="noreferrer">Download Windows collector (.ps1) ↗</a></div></article>
        <article><span>2</span><div><strong>Run it on Windows</strong><p>Open PowerShell in the folder where you saved the script and run:</p><code>powershell -NoProfile -ExecutionPolicy Bypass -File .\collect_events.ps1 -MaxEventsPerLog 200</code><p className="log-collector-note">The JSON export is saved in an <code>output</code> folder beside the script.</p></div></article>
        <article><span>3</span><div><strong>Import the export below</strong><p>Choose <code>windows_events.json</code> under Upload file. Your logs stay in this browser until you explicitly request AI analysis.</p><button type="button" className="log-secondary-button" onClick={() => { setActiveTab('upload'); window.setTimeout(() => fileInputRef.current?.click(), 100) }}>Choose Windows JSON export</button></div></article>
      </div>
      <p className="log-collector-privacy">Privacy: collecting is local and read-only. Clicking “Analyze logs” sends the selected log text to the configured CyberMind AI backend/provider for analysis. Review sensitive details before doing so.</p>
    </section>

    <div className="log-control-grid">
      <section className="log-card log-input-card">
        <div className="log-card-heading"><div><h3>Log input</h3><p>Provide the source data for analysis.</p></div><span className="log-step">01 / INPUT</span></div>
        <div className="log-tabs" role="tablist"><button type="button" className={activeTab === 'paste' ? 'active' : ''} onClick={() => setActiveTab('paste')}>Paste logs</button><button type="button" className={activeTab === 'upload' ? 'active' : ''} onClick={() => setActiveTab('upload')}>Upload file</button></div>
        <label className="log-field">Log type to analyze<select value={logType} onChange={(event) => setLogType(event.target.value)}><option value="auto_detect">Auto-detect from log content</option><option value="windows_security">Windows Security / authentication events</option><option value="windows_system_application">Windows System and Application events</option><option value="web_server">Web server logs (IIS, Nginx, Apache)</option><option value="firewall_network">Firewall and network logs</option><option value="endpoint_edr">Endpoint / antivirus / EDR alerts</option><option value="application_server">Application and server logs</option><option value="database">Database audit and error logs</option><option value="cloud_audit">Cloud and identity audit logs</option></select></label>
        {activeTab === 'paste' ? <label className="log-field">Log content<textarea value={rawText} onChange={(event) => replaceText(event.target.value, 'Pasted log text')} rows={8} placeholder={'2026-08-12T10:15:22Z ERROR Failed login for user admin from 203.0.113.10\n2026-08-12T10:16:01Z WARN Rate limit exceeded for client'} /></label> : <button type="button" className="log-dropzone" onClick={() => fileInputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void loadFile(event.dataTransfer.files[0]) }}><span className="log-upload-icon">↑</span><strong>{fileName || 'Drop a log file here'}</strong><small>or choose a .log, .txt, .csv, or Windows event .json file</small><input ref={fileInputRef} type="file" accept=".log,.txt,.csv,.json,text/plain,text/csv,application/json" onChange={(event) => void loadFile(event.target.files?.[0])} /></button>}
        {fileName && <p className="log-file-name">Selected: <strong>{fileName}</strong> · {total} non-empty lines</p>}
        {error && <p className="project-form-error" role="alert">{error}</p>}
      </section>
      <section className="log-card log-ai-card">
        <div className="log-card-heading"><div><h3>AI analysis</h3><p>Use a configured provider to explain findings.</p></div><span className="log-step">02 / ANALYZE</span></div>
        <label className="log-toggle"><input type="checkbox" checked={aiEnabled} onChange={(event) => setAiEnabled(event.target.checked)} /><span />Enable AI-assisted investigation</label>
        <label className="log-field">Severities to investigate<div className="log-severity-options">{[{ value: 'critical', label: 'Critical' }, { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }, { value: 'info', label: 'Informational' }].map((item) => <label key={item.value} className="log-severity-option"><input type="checkbox" checked={selectedSeverities.includes(item.value)} onChange={(event) => { setSelectedSeverities((current) => event.target.checked ? [...current, item.value] : current.filter((value) => value !== item.value)); setAiResult(null) }} disabled={!aiEnabled || aiLoading} />{item.label}</label>)}</div><small>Select one or more severity levels for the AI to prioritize. All are selected by default.</small></label>
        <div className="log-select-grid"><label className="log-field">AI provider<select value={providerId} onChange={(event) => void selectProvider(event.target.value)} disabled={!aiEnabled}><option value="">Select provider</option>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label><label className="log-field">AI model<select value={modelId} onChange={(event) => { setModelId(event.target.value); setAiResult(null) }} disabled={!aiEnabled || !providerId}><option value="">Select model</option>{models.map((model) => <option key={model.id} value={model.id}>{model.display_name}</option>)}</select></label></div>
        <button type="button" className="dialog-submit-button log-analyze-button" disabled={!aiEnabled || !rawText.trim() || !providerId || !modelId || selectedSeverities.length === 0 || aiLoading} onClick={() => void runAiAnalysis()}>{aiLoading ? 'Analyzing with AI…' : 'Analyze logs'}</button>
        {!providers.length && <p className="project-analysis-hint">Configure and enable a provider and model in Settings → AI Providers.</p>}
        {aiError && <p className="project-form-error" role="alert">{aiError}</p>}
      </section>
    </div>

    <section className="log-card log-actions-card"><div><h3>Quick actions</h3><p>Export the current rule-based triage or start over.</p></div><div className="log-actions"><button type="button" className="dialog-submit-button" disabled={!events.length} onClick={downloadReport}>Download Markdown report</button><button type="button" className="log-secondary-button" disabled title="PDF export is not available yet">PDF summary unavailable</button><button type="button" className="log-secondary-button" onClick={clearAnalysis}>Clear and start new</button></div></section>

    <section className="log-metrics" aria-label="Severity summary">{severityOrder.map((key) => <button type="button" key={key} className={`log-metric ${severity === key ? 'selected' : ''}`} onClick={() => { setSeverity(severity === key ? 'all' : key); setPage(1) }} aria-pressed={severity === key}><SeverityIcon severity={key} /><span><small>{severityLabels[key]}</small><strong>{counts[key]}</strong><em>{total ? `${Math.round((counts[key] / total) * 100)}% of lines` : '0% of lines'}</em></span></button>)}</section>

    <div className="log-chart-grid"><section className="log-card"><div className="log-card-heading"><div><h3>Timeline of events</h3><p>Timestamped events grouped across the submitted log range.</p></div></div><TimelineChart events={events} /><div className="log-chart-legend">{severityOrder.map((key) => <span key={key}><i style={{ background: severityColors[key] }} />{severityLabels[key]}</span>)}</div></section><section className="log-card"><div className="log-card-heading"><div><h3>Event distribution</h3><p>Severity mix across {total} non-empty lines.</p></div></div><DistributionChart counts={counts} total={total} /></section></div>
    <section className="log-card"><div className="log-card-heading"><div><h3>Investigation overview</h3><p>Compare event volume and timestamp coverage by severity.</p></div></div><OverviewChart events={events} /></section>

    <div className="log-lower-grid"><section className="log-card log-events-card"><div className="log-card-heading"><div><h3>Detected security events</h3><p>{filtered.length} of {total} matching events</p></div></div><div className="log-toolbar"><label className="log-search">Search events<input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Message, source, IP address…" /></label><label className="log-field">Severity<select value={severity} onChange={(event) => { setSeverity(event.target.value as Severity | 'all'); setPage(1) }}><option value="all">All severities</option>{severityOrder.map((key) => <option key={key} value={key}>{severityLabels[key]}</option>)}</select></label></div><div className="log-table-wrap"><table className="log-events-table"><thead><tr><th><button type="button" onClick={() => toggleSort('timestamp')}>Timestamp {sort === 'timestamp' ? (sortDescending ? '↓' : '↑') : ''}</button></th><th>Severity</th><th>Event</th><th>Source</th><th /></tr></thead><tbody>{visibleEvents.map((event) => <tr key={event.id}><td>{formatTime(event.date, event.timestamp)}</td><td><span className="log-pill" style={{ color: severityColors[event.severity], background: `${severityColors[event.severity]}18` }}>{severityLabels[event.severity]}</span></td><td><span className="log-event-message">{event.message}</span><small>Line {event.line}</small></td><td>{event.source}</td><td><button type="button" className="log-view-button" onClick={() => setSelectedEvent(event)}>View details</button></td></tr>)}</tbody></table>{!visibleEvents.length && <p className="log-empty">No events match the current filters.</p>}</div>{pageCount > 1 && <div className="log-pagination"><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {pageCount}</span><button type="button" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>Next</button></div>}</section>
      <section className="log-card log-insights-card"><div className="log-card-heading"><div><h3>AI analysis & insights</h3><p>{aiResult ? `${aiResult.findings.length} findings returned by the configured model.` : 'Run AI analysis to add provider-backed context.'}</p></div>{aiResult && <button type="button" className="log-secondary-button" onClick={downloadAiReport}>Download AI report</button>}</div>{aiResult ? <><div className="log-insight-tabs" role="tablist">{([['overview', 'Overview'], ['findings', `Key findings (${aiResult.findings.length})`], ['recommendations', 'Recommendations'], ['timeline', 'Timeline'], ['evidence', 'Evidence']] as const).map(([key, label]) => <button type="button" key={key} className={insightTab === key ? 'active' : ''} onClick={() => setInsightTab(key)}>{label}</button>)}</div>{insightTab === 'overview' && <div className="log-insight-overview"><div className={`log-assessment log-assessment-${aiResult.assessment || 'uncertain'}`}><strong>{(aiResult.assessment || 'uncertain').replace('_', ' ')}</strong><span>AI assessment · severity remains independently classified in the event table</span></div><div className="log-insight-summary"><strong>Executive summary</strong><p>{aiResult.summary || 'The model returned no summary.'}</p><dl><div><dt>Lines analyzed</dt><dd>{aiResult.lines_analyzed}</dd></div><div><dt>Time range</dt><dd>{aiResult.time_range || 'Not available'}</dd></div><div><dt>Findings</dt><dd>{aiResult.findings.length}</dd></div></dl></div><div className="log-limitations"><strong>Limitations and uncertainty</strong>{aiResult.limitations.map((item) => <p key={item}>{item}</p>)}</div></div>}{insightTab === 'findings' && <div className="log-findings-list">{aiResult.findings.length ? aiResult.findings.map((finding, index) => { const expanded = expandedFindings.includes(index); return <article className="log-finding" key={`${finding.title}-${index}`}><button type="button" className="log-finding-toggle" onClick={() => setExpandedFindings((current) => expanded ? current.filter((item) => item !== index) : [...current, index])}><span><strong>{finding.title}</strong><small>{finding.severity} · {finding.timestamp || 'timestamp not provided'}</small></span><b>{expanded ? '−' : '+'}</b></button><p>{finding.description}</p>{expanded && <div className="log-finding-details"><div><strong>Why it matters</strong><p>{finding.why_it_matters || 'The model did not provide additional impact context.'}</p></div><div><strong>Evidence</strong><pre>{finding.evidence || 'No linked evidence was provided.'}</pre></div><div><strong>Source and related events</strong><p>{finding.source || 'Source not provided.'}{finding.related_events?.length ? ` · ${finding.related_events.join(' · ')}` : ''}</p></div><div><strong>Recommended action</strong><p>{finding.recommendation || 'No recommendation provided.'}</p></div><div><strong>Follow-up verification</strong><p>{finding.follow_up || 'No follow-up check was provided.'}</p></div>{finding.confidence && <div><strong>Evidence strength</strong><p>{finding.confidence}</p></div>}</div>}</article> }) : <p className="log-empty">No meaningful security findings were returned. This does not prove the logs are benign.</p>}</div>}{insightTab === 'recommendations' && <div className="log-recommendations">{(['immediate', 'short_term', 'preventive'] as const).map((key) => <div key={key}><h4>{key === 'short_term' ? 'Short-term investigation' : key.charAt(0).toUpperCase() + key.slice(1)}</h4>{(aiResult.recommendations?.[key] || []).length ? <ul>{aiResult.recommendations?.[key].map((item) => <li key={item}>{item}</li>)}</ul> : <p>No recommendations in this category.</p>}</div>)}</div>}{insightTab === 'timeline' && <div className="log-ai-timeline">{aiResult.timeline?.length ? aiResult.timeline.map((item, index) => <article key={`${item.timestamp}-${index}`}><time>{item.timestamp || 'Undated'}</time><div><strong>{item.event}</strong><p>{item.significance}</p><small>Evidence: {item.evidence || 'Not provided'}</small></div></article>) : <p className="log-empty">No supported timestamp correlation was returned.</p>}</div>}{insightTab === 'evidence' && <div className="log-evidence-list"><p>Evidence below is AI-linked text; the original event table remains the source of truth.</p>{aiResult.findings.map((finding, index) => <article key={`${finding.title}-evidence-${index}`}><strong>{finding.title}</strong><pre>{finding.evidence || 'No evidence provided.'}</pre></article>)}</div>}</> : <div className="log-insight-empty"><span>✦</span><strong>AI findings will appear here</strong><p>Run analysis with a configured provider. Rule-based cards and charts remain available without AI.</p></div>}</section></div>
    <p className="log-analysis-disclaimer">Rule-based triage is an indicator, not proof of compromise. Unparsed timestamps remain visible in the event table; validate findings against source systems.</p>
    {selectedEvent && <div className="log-modal-backdrop" role="presentation" onClick={() => setSelectedEvent(null)}><section className="log-modal" role="dialog" aria-modal="true" aria-labelledby="log-detail-title" onClick={(event) => event.stopPropagation()}><div className="log-card-heading"><div><p className="section-kicker">Line {selectedEvent.line}</p><h3 id="log-detail-title">Event details</h3></div><button type="button" className="log-close-button" onClick={() => setSelectedEvent(null)} aria-label="Close event details">×</button></div><dl><dt>Timestamp</dt><dd>{selectedEvent.timestamp}</dd><dt>Severity</dt><dd><span className="log-pill" style={{ color: severityColors[selectedEvent.severity] }}>{severityLabels[selectedEvent.severity]}</span></dd><dt>Source</dt><dd>{selectedEvent.source}</dd><dt>Original log line</dt><dd className="log-raw-line">{selectedEvent.raw}</dd></dl></section></div>}
  </section>
}
