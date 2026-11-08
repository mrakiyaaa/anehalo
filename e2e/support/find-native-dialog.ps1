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
