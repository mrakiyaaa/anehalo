function Find-AnehaloDialog {
  param([int]$ApplicationProcessId, [string]$Title)
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
  $deadline = [DateTime]::UtcNow.AddSeconds(15)
  while ([DateTime]::UtcNow -lt $deadline) {
    $windows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll(
      [System.Windows.Automation.TreeScope]::Descendants,
      [System.Windows.Automation.AndCondition]::new(
        [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ProcessIdProperty, $ApplicationProcessId),
        [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Window)))
    foreach ($window in $windows) {
      if ($window.Current.Name -eq $Title -and $window.Current.ClassName -eq '#32770' -and -not $window.Current.IsOffscreen -and $window.Current.IsEnabled -and $window.Current.BoundingRectangle.Width -gt 0) { return $window }
    }
    Start-Sleep -Milliseconds 100
  }
  throw "The isolated native dialog did not open: $Title"
}

# UI Automation keeps reporting a closed dialog as present for a while, so ask Windows directly.
function Wait-AnehaloDialogClosed {
  param([IntPtr]$Handle, [int]$Seconds = 3)
  if (-not ('AnehaloWindowState' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class AnehaloWindowState {
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
}
'@
  }
  $deadline = [DateTime]::UtcNow.AddSeconds($Seconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    if (-not [AnehaloWindowState]::IsWindowVisible($Handle)) { return $true }
    Start-Sleep -Milliseconds 100
  }
  return $false
}

# A native dialog fills in its own default value just after it opens and can overwrite a value
# set too early, which leaves the dialog open. Repeat the attempt until the dialog closes.
function Complete-AnehaloDialog {
  param($Dialog, [scriptblock]$Attempt, [string]$Description)
  $handle = [IntPtr]$Dialog.Current.NativeWindowHandle
  $deadline = [DateTime]::UtcNow.AddSeconds(15)
  while ([DateTime]::UtcNow -lt $deadline) {
    & $Attempt
    if (Wait-AnehaloDialogClosed -Handle $handle) { return }
  }
  throw "The native dialog did not accept the $Description."
}
