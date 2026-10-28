param(
    [int]$MaxEventsPerLog = 0,
    [string]$OutputPath = (Join-Path $PSScriptRoot 'output\windows_events.json')
)

$ErrorActionPreference = 'Stop'

if ($MaxEventsPerLog -eq 0) {
    $answer = Read-Host 'How many recent events should be collected from EACH log? Enter 1-500 (press Enter for 50)'
    if ([string]::IsNullOrWhiteSpace($answer)) {
        $MaxEventsPerLog = 50
    }
    elseif ($answer -match '^\d+$') {
        $MaxEventsPerLog = [int]$answer
    }
    else {
        throw 'Please enter a whole number from 1 to 500.'
    }
}

if ($MaxEventsPerLog -lt 1 -or $MaxEventsPerLog -gt 500) {
    throw 'MaxEventsPerLog must be between 1 and 500.'
}

$logNames = @('System', 'Application')
$allEvents = [System.Collections.Generic.List[object]]::new()
$collectionErrors = [System.Collections.Generic.List[string]]::new()

Write-Host 'CyberMind AI - Windows Event Log Collector' -ForegroundColor Green
Write-Host 'Read-only mode. No events will be changed or transmitted.'
Write-Host "Maximum events per log: $MaxEventsPerLog (up to $($MaxEventsPerLog * $logNames.Count) total)"

foreach ($logName in $logNames) {
    Write-Host "`n========== $logName ==========" -ForegroundColor Cyan
    try {
        $events = @(Get-WinEvent -FilterHashtable @{ LogName = $logName } -MaxEvents $MaxEventsPerLog -ErrorAction Stop)
        foreach ($event in $events) {
            $allEvents.Add([PSCustomObject]@{
                time_created = if ($event.TimeCreated) { $event.TimeCreated.ToUniversalTime().ToString('o') } else { $null }
                log_name = $event.LogName
                provider = $event.ProviderName
                event_id = $event.Id
                level = $event.LevelDisplayName
                record_id = $event.RecordId
                machine_name = $event.MachineName
                message = $event.Message
            })
        }
        Write-Host "Collected $($events.Count) event(s) from $logName." -ForegroundColor Green
    }
    catch {
        $message = 'Could not read ' + $logName + ': ' + $_.Exception.Message
        $collectionErrors.Add($message)
        Write-Warning $message
    }
}

$resolvedOutputPath = [System.IO.Path]::GetFullPath($OutputPath)
$outputDirectory = Split-Path -Parent $resolvedOutputPath
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

$export = [PSCustomObject]@{
    collected_at = [DateTime]::UtcNow.ToString('o')
    computer_name = $env:COMPUTERNAME
    max_events_per_log = $MaxEventsPerLog
    event_count = $allEvents.Count
    logs_requested = $logNames
    collection_errors = @($collectionErrors.ToArray())
    events = @($allEvents.ToArray())
}

$json = ConvertTo-Json -InputObject $export -Depth 6
[System.IO.File]::WriteAllText($resolvedOutputPath, $json, [System.Text.UTF8Encoding]::new($false))

Write-Host "`nExport complete: $resolvedOutputPath" -ForegroundColor Green
Write-Host "Total events exported: $($allEvents.Count)"
Write-Host 'The JSON file may contain sensitive system details. Keep it local and do not commit it.' -ForegroundColor Yellow
