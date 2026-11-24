# Reports whether the Windows clipboard holds an image, and its size, as JSON.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$hasImage = [System.Windows.Forms.Clipboard]::ContainsImage()
$width = 0
$height = 0
if ($hasImage) {
  $image = [System.Windows.Forms.Clipboard]::GetImage()
  $width = $image.Width
  $height = $image.Height
  $image.Dispose()
}
@{ hasImage = $hasImage; width = $width; height = $height } | ConvertTo-Json -Compress
