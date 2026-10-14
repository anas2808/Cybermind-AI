param(
    [ValidateRange(1, 500)]
    [int]$MaxEventsPerLog = 200,
    [ValidateRange(5, 1440)]
    [int]$IntervalMinutes = 15
)

$ErrorActionPreference = 'Stop'
$taskName = 'CyberMind AI Automatic Windows Triage'
$worker = Join-Path $PSScriptRoot 'run_automatic_triage.ps1'
if (-not (Test-Path -LiteralPath $worker)) {
    throw "Worker script not found: $worker"
}

$powerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$action = New-ScheduledTaskAction -Execute $powerShell -Argument ('-NoProfile -ExecutionPolicy Bypass -File "' + $worker + '" -MaxEventsPerLog ' + $MaxEventsPerLog) -WorkingDirectory $PSScriptRoot

# Task Scheduler runs with the current user's permissions, without elevation.
$logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$dailyTrigger = New-ScheduledTaskTrigger -Daily -At '00:05'
$repeatTemplate = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) -RepetitionDuration (New-TimeSpan -Hours 23 -Minutes 55)
$dailyTrigger.Repetition = $repeatTemplate.Repetition

$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($logonTrigger, $dailyTrigger) -Principal $principal -Settings $settings -Description 'Locally collect and triage recent Windows System and Application events. Does not upload logs.' -Force | Out-Null

Write-Host 'CyberMind AI automatic triage is installed.' -ForegroundColor Green
Write-Host "Runs at sign-in and every $IntervalMinutes minutes while this user is signed in."
Write-Host 'Logs and reports stay on this computer.'
Write-Host "Task name: $taskName"
Write-Host 'Running the first collection now...'
& $powerShell -NoProfile -ExecutionPolicy Bypass -File $worker -MaxEventsPerLog $MaxEventsPerLog
if ($LASTEXITCODE -ne 0) {
    Write-Warning 'The initial run reported an error. See windows_collector\output\automatic_triage.log.'
}
