param([Parameter(Mandatory=$true)][int]$ApplicationProcessId, [Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'find-native-dialog.ps1')
$dialog = Find-AnehaloDialog -ApplicationProcessId $ApplicationProcessId -Title 'Save as Markdown'
$edits = $dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants,
  [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Edit))
$fileName = $null
foreach ($edit in $edits) { if ($edit.Current.Name -match '^File name') { $fileName = $edit; break } }
if ($null -eq $fileName) {
  Add-Type -AssemblyName System.Windows.Forms
  $applicationShell = New-Object -ComObject WScript.Shell
  if (-not $applicationShell.AppActivate($ApplicationProcessId)) { throw 'The isolated native dialog could not be activated.' }
  [System.Windows.Forms.SendKeys]::SendWait('%n')
  [System.Windows.Forms.SendKeys]::SendWait('^a')
  $escapedDestination = [regex]::Replace($Destination, '[+^%~(){}\[\]]', { param($match) '{' + $match.Value + '}' })
  [System.Windows.Forms.SendKeys]::SendWait($escapedDestination)
  [System.Windows.Forms.SendKeys]::SendWait('%s')
  exit 0
}
$value = $fileName.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
$value.SetValue($Destination)
$save = $dialog.FindFirst([System.Windows.Automation.TreeScope]::Descendants,
  [System.Windows.Automation.AndCondition]::new(
    [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty, '1'),
    [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)))
if ($null -eq $save) { throw 'The native Save button was not found.' }
$invoke = $save.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
$invoke.Invoke()
