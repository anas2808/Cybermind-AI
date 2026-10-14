# Windows Event Collection and Offline Triage

CyberMind AI can collect recent Windows events and generate a local Markdown triage report automatically. It uses PowerShell and Python's standard library; the scripts do not upload or transmit event logs.

## Recommended: set up automatic collection once

From the repository root in PowerShell, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\windows_collector\setup_automatic_triage.ps1
```

This registers a Windows Scheduled Task for the current Windows user. It runs at sign-in and then every 15 minutes while that user is signed in, collecting up to 200 recent events from each of the System and Application logs and refreshing the report. Python 3 must be installed and available as `python` on PATH. The setup does not request administrator privileges.

To choose a different event limit or interval:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\windows_collector\setup_automatic_triage.ps1 -MaxEventsPerLog 100 -IntervalMinutes 30
```

The interval must be 5–1440 minutes and the event limit 1–500 per log.

The report and local run log are written to:

- `windows_collector/output/windows_triage_report.md`
- `windows_collector/output/automatic_triage.log`

To open the report:

```powershell
code .\windows_collector\output\windows_triage_report.md
```

To check task status:

```powershell
Get-ScheduledTask -TaskName 'CyberMind AI Automatic Windows Triage'
Get-ScheduledTaskInfo -TaskName 'CyberMind AI Automatic Windows Triage'
```

To uninstall automatic collection:

```powershell
Unregister-ScheduledTask -TaskName 'CyberMind AI Automatic Windows Triage' -Confirm:$false
```

The scheduled task runs with the current user's permissions and while the user is signed in; it is not an elevated system-wide service. Every person/computer must approve this one-time setup locally. Collection is limited to System and Application logs; Security logs are not collected.

## Manual mode

Collect events:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\windows_collector\collect_events.ps1
```

Generate the report:

```powershell
python .\windows_collector\analyze_events.py
```

Custom input/output:

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

Exports, reports, and the run log may contain sensitive machine or application details. They are ignored by Git. Review them locally and do not commit them.
