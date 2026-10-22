import { useMemo, useState } from 'react'
import './WindowsAutomaticTriagePanel.css'

type WindowsEvent = {
  time_created?: string | null
  log_name?: string | null
  provider?: string | null
  event_id?: string | number | null
  level?: string | null
  record_id?: string | number | null
  machine_name?: string | null
  message?: string | null
}
type WindowsExport = {
  computer_name?: string
  collected_at?: string
  event_count?: number
  collection_errors?: string[]
  events: WindowsEvent[]
}
type Priority = 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL'
type EventGroup = {
  logName: string
  provider: string
  eventId: string
  message: string
  count: number
  priority: Priority
  title: string
  rationale: string
  firstSeen: string
  lastSeen: string
  recordIds: string[]
}
const priorities: Priority[] = ['HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL']

function normalizeMessage(value: unknown) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/g, '<guid>')
}
function classify(events: WindowsEvent[]): Pick<EventGroup, 'priority' | 'title' | 'rationale'> {
  const first = events[0]
  const id = String(first.event_id ?? '')
  const log = String(first.log_name ?? '').toLowerCase()
  const message = events.map((event) => String(event.message || '')).join(' ').toLowerCase()
  if (id === '5038') return events.length >= 3
    ? { priority: 'MEDIUM', title: 'Repeated Code Integrity warning', rationale: 'Repeated hash-validation warnings merit checking the affected file, signer, and nearby events. This is not proof of malware.' }
    : { priority: 'LOW', title: 'Code Integrity warning', rationale: 'An isolated hash-validation warning is not proof of malware; verify the file and signer if unexpected.' }
  if (log === 'security' && id === '4625') {
    if (events.length >= 20) return { priority: 'MEDIUM', title: 'Repeated failed logons', rationale: 'Check account names, source addresses, logon types, and the time window. Count alone does not confirm brute force.' }
    if (events.length >= 5) return { priority: 'LOW', title: 'Multiple failed logons', rationale: 'Review whether failures cluster around one account or source; mistyped credentials are also possible.' }
    return { priority: 'INFORMATIONAL', title: 'Failed logon', rationale: 'A small number of failed logons is common; review surrounding context before escalating.' }
  }
  if (log === 'security' && id === '1102') return { priority: 'HIGH', title: 'Security audit log cleared', rationale: 'Verify who cleared the Security audit log, whether it was authorized, and what events preceded it.' }
  if (['malware detected', 'ransomware', 'credential theft'].some((term) => message.includes(term))) return { priority: 'MEDIUM', title: 'Security wording requires validation', rationale: 'Validate the full event and related evidence; keyword matching is not confirmation.' }
  const level = String(first.level || '').toLowerCase()
  if (level === 'critical' || level === 'error') return { priority: 'LOW', title: 'Operational error', rationale: 'The event level alone does not establish a security threat; check service or application impact.' }
  if (level === 'warning' || level === 'warn') return { priority: 'INFORMATIONAL', title: 'Operational warning', rationale: 'Review if this coincides with other unusual events or user-visible impact.' }
  return { priority: 'INFORMATIONAL', title: 'Routine event', rationale: 'This event group alone does not support a strong security conclusion.' }
}
function triage(events: WindowsEvent[]): EventGroup[] {
  const groups = new Map<string, WindowsEvent[]>()
  for (const event of events) {
    const key = JSON.stringify([event.log_name || '', event.provider || '', String(event.event_id ?? ''), normalizeMessage(event.message)])
    groups.set(key, [...(groups.get(key) || []), event])
  }
  const rank: Record<Priority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, INFORMATIONAL: 3 }
  return [...groups.entries()].map(([key, items]) => {
    const [logName, provider, eventId] = JSON.parse(key) as [string, string, string, string]
    const ordered = [...items].sort((a, b) => String(a.time_created || '').localeCompare(String(b.time_created || '')))
    const times = ordered.map((item) => item.time_created).filter((value): value is string => Boolean(value))
    const finding = classify(items)
    return {
      logName, provider, eventId, message: String(items[0].message || '(No message provided)'),
      count: items.length, ...finding, firstSeen: times[0] || '', lastSeen: times[times.length - 1] || '',
      recordIds: items.map((item) => item.record_id).filter((value) => value !== null && value !== undefined).map(String),
    }
  }).sort((a, b) => rank[a.priority] - rank[b.priority] || b.count - a.count || a.logName.localeCompare(b.logName) || a.eventId.localeCompare(b.eventId))
}
function downloadReport(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
function reportText(data: WindowsExport, groups: EventGroup[]) {
  const counts = Object.fromEntries(priorities.map((priority) => [priority, groups.filter((group) => group.priority === priority).length])) as Record<Priority, number>
  const lines = [
    '# CyberMind AI — Offline Windows Event Triage', '',
    '- Computer: ' + (data.computer_name || 'Unknown'),
    '- Collected at (UTC): ' + (data.collected_at || 'Unknown'),
    '- Raw events: ' + (data.event_count ?? data.events.length),
    '- Unique event groups: ' + groups.length,
    '- Collection errors: ' + (data.collection_errors?.length || 0), '',
    '## Triage overview', '', '| Review priority | Groups |', '|---|---:|',
    ...priorities.map((priority) => '| ' + priority + ' | ' + counts[priority] + ' |'),
    '', '> Heuristic review priorities are not proof of compromise. Results were processed locally in your browser.',
    '', '## Event groups', '',
  ]
  if (!groups.length) lines.push('No events were present in the input export.')
  groups.forEach((group, index) => lines.push(
    '### ' + (index + 1) + '. ' + group.title + ' — ' + group.priority, '',
    '- Log: ' + (group.logName || 'Unknown'), '- Provider: ' + (group.provider || 'Unknown'),
    '- Event ID: ' + (group.eventId || 'Unknown'), '- Repeated count: ' + group.count,
    '- First seen: ' + (group.firstSeen || 'Not available'), '- Last seen: ' + (group.lastSeen || 'Not available'),
    '- Record IDs: ' + (group.recordIds.slice(0, 20).join(', ') || 'Not available'),
    '', group.message.replace(/\n/g, ' '), '', '**Why this priority:** ' + group.rationale, '',
  ))
  if (data.collection_errors?.length) lines.push('## Collection warnings', '', ...data.collection_errors.map((error) => '- ' + error), '')
  lines.push('## Validation checklist', '', '1. Review HIGH and MEDIUM groups against original Event Viewer entries.', '2. Check nearby events and whether approved maintenance explains the activity.', '3. Do not treat event level, keyword matches, or repeated messages alone as proof of an attack.', '')
  return lines.join('\n')
}

export function WindowsAutomaticTriagePanel() {
  const [fileName, setFileName] = useState('')
  const [data, setData] = useState<WindowsExport | null>(null)
  const [error, setError] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const groups = useMemo(() => data ? triage(data.events) : [], [data])
  const visibleGroups = useMemo(() => groups.filter((group) =>
    (priorityFilter === 'ALL' || group.priority === priorityFilter) &&
    (!search.trim() || [group.title, group.message, group.provider, group.eventId, group.logName].join(' ').toLowerCase().includes(search.trim().toLowerCase()))
  ), [groups, priorityFilter, search])
  const counts = useMemo(() => Object.fromEntries(priorities.map((priority) => [priority, groups.filter((group) => group.priority === priority).length])) as Record<Priority, number>, [groups])

  async function loadExport(file?: File) {
    if (!file) return
    setError('')
    setBusy(true)
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('Choose a JSON export smaller than 25 MB.')
      const parsed: unknown = JSON.parse(await file.text())
      if (!parsed || typeof parsed !== 'object' || !('events' in parsed) || !Array.isArray((parsed as { events: unknown }).events)) {
        throw new Error('This file is not a CyberMind Windows event export with an events array.')
      }
      const exportData = parsed as WindowsExport
      if (!exportData.events.every((event) => event && typeof event === 'object')) throw new Error('The events array contains an invalid event.')
      setData(exportData)
      setFileName(file.name)
      setPriorityFilter('ALL')
      setSearch('')
    } catch (cause) {
      setData(null)
      setFileName('')
      setError(cause instanceof Error ? cause.message : 'Could not read this JSON export.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="windows-triage-panel log-card" aria-labelledby="windows-triage-title">
    <div className="log-card-heading">
      <div><h3 id="windows-triage-title">Automatic Windows log triage</h3><p>Review repeated events and security review priorities locally, without sending logs to an AI provider.</p></div>
      <span className="log-step">LOCAL ANALYSIS</span>
    </div>
    <div className="windows-triage-intro">
      <div><strong>Already ran the Windows collector?</strong><p>Upload its <code>windows_events.json</code> export. CyberMind AI will group repeated events, apply the same conservative triage rules as the offline analyzer, and create a report in this page.</p></div>
      <label className="windows-triage-upload">
        <span>{busy ? 'Reading export…' : fileName ? 'Choose another JSON export' : 'Choose Windows JSON export'}</span>
        <input type="file" accept=".json,application/json" disabled={busy} onChange={(event) => { void loadExport(event.target.files?.[0]); event.currentTarget.value = '' }} />
      </label>
    </div>
    {error && <p className="project-form-error" role="alert">{error}</p>}
    {data && <>
      <div className="windows-triage-file"><strong>{fileName}</strong><span>{data.computer_name || 'Unknown computer'} · {data.event_count ?? data.events.length} raw events · {groups.length} event groups</span><button type="button" className="log-secondary-button" onClick={() => downloadReport('cybermind-windows-triage-report.md', reportText(data, groups))}>Download Markdown report</button></div>
      <div className="windows-triage-metrics">
        {priorities.map((priority) => <button type="button" key={priority} className={'windows-triage-metric priority-' + priority.toLowerCase() + (priorityFilter === priority ? ' selected' : '')} onClick={() => setPriorityFilter(priorityFilter === priority ? 'ALL' : priority)} aria-pressed={priorityFilter === priority}><span>{priority}</span><strong>{counts[priority]}</strong><small>event groups</small></button>)}
      </div>
      <div className="windows-triage-tools"><label>Search findings<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Event ID, provider, message…" /></label><label>Priority<select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as Priority | 'ALL')}><option value="ALL">All priorities</option>{priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label></div>
      {data.collection_errors?.length ? <div className="windows-triage-warning"><strong>Collection warnings</strong><ul>{data.collection_errors.map((item, index) => <li key={index}>{item}</li>)}</ul></div> : null}
      <div className="windows-triage-results">
        {visibleGroups.map((group, index) => <article className="windows-triage-result" key={group.logName + group.provider + group.eventId + group.message}>
          <div className="windows-triage-result-heading"><span className={'windows-triage-priority priority-' + group.priority.toLowerCase()}>{group.priority}</span><span>Event ID {group.eventId || 'unknown'}</span><span>{group.count} occurrence{group.count === 1 ? '' : 's'}</span></div>
          <h4>{group.title}</h4><p>{group.rationale}</p>
          <details><summary>View evidence and event details</summary><dl><dt>Log / provider</dt><dd>{group.logName || 'Unknown'} / {group.provider || 'Unknown'}</dd><dt>First seen</dt><dd>{group.firstSeen || 'Not available'}</dd><dt>Last seen</dt><dd>{group.lastSeen || 'Not available'}</dd><dt>Record IDs</dt><dd>{group.recordIds.slice(0, 20).join(', ') || 'Not available'}</dd><dt>Event message</dt><dd className="windows-triage-message">{group.message}</dd></dl></details>
        </article>)}
        {!visibleGroups.length && <p className="log-empty">No event groups match this search and priority.</p>}
      </div>
      <p className="windows-triage-disclaimer">This is rule-based triage, not proof of compromise. The browser processes the selected export locally; no AI request is made by this feature. Validate important findings against Event Viewer and surrounding events.</p>
    </>}
  </section>
}
