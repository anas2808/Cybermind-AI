param(
    [ValidateRange(1, 500)]
    [int]$MaxEventsPerLog = 200
)

$ErrorActionPreference = 'Stop'
$collector = Join-Path $PSScriptRoot 'collect_events.ps1'
$analyzer = Join-Path $PSScriptRoot 'analyze_events.py'
$outputDir = Join-Path $PSScriptRoot 'output'
$jsonPath = Join-Path $outputDir 'windows_events.json'
$reportPath = Join-Path $outputDir 'windows_triage_report.md'
$runLog = Join-Path $outputDir 'automatic_triage.log'

New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
function Write-RunLog([string]$Message) {
    Add-Content -LiteralPath $runLog -Value ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message) -Encoding UTF8
}

try {
    Write-RunLog "Starting automatic collection (up to $MaxEventsPerLog events per log)."
    & "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File $collector -MaxEventsPerLog $MaxEventsPerLog -OutputPath $jsonPath *>> $runLog
    if ($LASTEXITCODE -ne 0) { throw "Collector process returned exit code $LASTEXITCODE." }
    if (-not (Test-Path -LiteralPath $jsonPath)) { throw 'Collector did not create the JSON export.' }

    $python = Get-Command python.exe -ErrorAction SilentlyContinue
    if (-not $python) { $python = Get-Command python -ErrorAction SilentlyContinue }
    if (-not $python) { throw 'Python was not found. Install Python 3 and ensure it is on PATH for this Windows user.' }

    & $python.Source $analyzer $jsonPath --output $reportPath *>> $runLog
    if ($LASTEXITCODE -ne 0) { throw "Analyzer returned exit code $LASTEXITCODE." }
    Write-RunLog "Success. Report updated at $reportPath. No network upload is performed."
}
catch {
    Write-RunLog ("ERROR: " + $_.Exception.Message)
    exit 1
}
