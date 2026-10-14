param(
    [ValidateRange(1, 500)]
    [int]$MaxEventsPerLog = 50
)

$ErrorActionPreference = "Stop"
$logNames = @("System", "Application")

Write-Host "CyberMind AI - Windows Event Log Collector" -ForegroundColor Green
Write-Host "Read-only mode. No events will be changed or transmitted."
Write-Host "Maximum events per log: $MaxEventsPerLog"

foreach ($logName in $logNames) {
    Write-Host "`n========== $logName ==========" -ForegroundColor Cyan

    try {
        $events = @(
            Get-WinEvent -FilterHashtable @{ LogName = $logName } -MaxEvents $MaxEventsPerLog -ErrorAction Stop |
            Select-Object TimeCreated, LogName, ProviderName, Id, LevelDisplayName, RecordId, Message
        )

        if ($events.Count -eq 0) {
            Write-Host "No events returned for $logName."
            continue
        }

        $events | Format-List | Out-Host
        Write-Host "Collected $($events.Count) event(s) from $logName." -ForegroundColor Green
    }
    catch {
        Write-Warning "Could not read '$logName': $($_.Exception.Message)"
    }
}

Write-Host "`nCollection finished. Events were only read and displayed locally."
