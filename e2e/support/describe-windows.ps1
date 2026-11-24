# Lists the windows the application owns, to explain a native dialog that did not finish.
param([Parameter(Mandatory=$true)][int]$ApplicationProcessId)
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$windows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll(
  [System.Windows.Automation.TreeScope]::Descendants,
  [System.Windows.Automation.AndCondition]::new(
    [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ProcessIdProperty, $ApplicationProcessId),
    [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Window)))
foreach ($window in $windows) {
  '{0} [{1}] offscreen={2} enabled={3}' -f $window.Current.Name, $window.Current.ClassName, $window.Current.IsOffscreen, $window.Current.IsEnabled
}
