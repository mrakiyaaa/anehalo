param([Parameter(Mandatory=$true)][int]$ApplicationProcessId, [Parameter(Mandatory=$true)][string]$Directory)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'find-native-dialog.ps1')
$dialog = Find-AnehaloDialog -ApplicationProcessId $ApplicationProcessId -Title 'Choose a location for Anehalo'

# Windows does not expose the folder dialog's footer controls through UI Automation.
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class AnehaloFolderDialog {
  [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr window, int identifier);
  [DllImport("user32.dll", CharSet = CharSet.Unicode, EntryPoint = "SendMessageW")]
  public static extern IntPtr SetText(IntPtr window, uint message, IntPtr parameter, string text);
  [DllImport("user32.dll", EntryPoint = "SendMessageW")]
  public static extern IntPtr Send(IntPtr window, uint message, IntPtr parameter, IntPtr data);
}
'@
$windowHandle = [IntPtr]$dialog.Current.NativeWindowHandle
$folderField = [AnehaloFolderDialog]::GetDlgItem($windowHandle, 1152)
$selectButton = [AnehaloFolderDialog]::GetDlgItem($windowHandle, 1)
if ($folderField -eq [IntPtr]::Zero -or $selectButton -eq [IntPtr]::Zero) { throw 'The isolated folder dialog controls were not found.' }
if ([AnehaloFolderDialog]::SetText($folderField, 12, [IntPtr]::Zero, $Directory) -eq [IntPtr]::Zero) { throw 'The folder dialog path could not be set.' }
[void][AnehaloFolderDialog]::Send($selectButton, 0x00F5, [IntPtr]::Zero, [IntPtr]::Zero)
