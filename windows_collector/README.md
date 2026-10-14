# Offline Windows Event Triage

This helper extends the read-only Windows Event Log Collector with local duplicate grouping and cautious review priorities. It uses Python's standard library only and does not upload or transmit logs.

## 1. Collect events

From the repository root in PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\windows_collector\collect_events.ps1
```

The collector currently reads System and Application logs.

## 2. Generate the report

```powershell
python .\windows_collector\analyze_events.py
```

By default, it reads `windows_collector/output/windows_events.json` and writes `windows_collector/output/windows_triage_report.md`.

Use a custom path with:

```powershell
python .\windows_collector\analyze_events.py .\path\to\windows_events.json --output .\triage-report.md
```

## Priority logic

- Event ID 5038: LOW when isolated, MEDIUM when repeated at least three times. It is not proof of malware.
- Event ID 1102 in the Security log: HIGH review priority; verify whether clearing the audit log was authorized. The current collector does not collect Security, so this applies only if an export contains that channel.
- Event ID 4625 in the Security log: conservative failed-logon thresholds; counts alone do not confirm brute force.
- Operational Error/Critical levels: LOW by default, because event level alone does not establish a security threat.
- Other events: informational unless there is a specific cautious heuristic.

These heuristics are explainable review aids, not a guarantee of detection. Validate important groups against original Event Viewer details and nearby events.

## Privacy

The script reads a local JSON export and writes a local Markdown report. It does not call an AI provider or send data over the network. Exports and reports may contain sensitive machine or application details; do not commit them.