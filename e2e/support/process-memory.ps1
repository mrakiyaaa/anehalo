param([Parameter(Mandatory=$true)][int]$ApplicationProcessId)
$ErrorActionPreference = 'Stop'
$processes = Get-CimInstance Win32_Process
$identifiers = [System.Collections.Generic.HashSet[int]]::new()
$null = $identifiers.Add($ApplicationProcessId)
do {
  $added = $false
  foreach ($process in $processes) {
    if ($identifiers.Contains([int]$process.ParentProcessId) -and $identifiers.Add([int]$process.ProcessId)) { $added = $true }
  }
} while ($added)
$workingSet = 0L
foreach ($process in $processes) {
  if ($identifiers.Contains([int]$process.ProcessId)) { $workingSet += [long]$process.WorkingSetSize }
}
@{ processCount = $identifiers.Count; residentMegabytes = $workingSet / 1MB } | ConvertTo-Json -Compress
