param(
    [ValidateRange(1, 500)]
    [int]$MaxEventsPerLog = 50,
    [string]$OutputPath = (Join-Path $PSScriptRoot 'output\windows_events.json')
)

$ErrorActionPreference = 'Stop'
$logNames = @('System', 'Application')
$allEvents = [System.Collections.Generic.List[object]]::new()
$collectionErrors = [System.Collections.Generic.List[string]]::new()

Write-Host 'CyberMind AI - Windows Event Log Collector' -ForegroundColor Green
Write-Host 'Read-only mode. No events will be changed or transmitted.'
Write-Host "Maximum events per log: $MaxEventsPerLog"

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
