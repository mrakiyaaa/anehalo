param([Parameter(Mandatory=$true)][string]$Directory, [switch]$DenyWrite)
$ErrorActionPreference = 'Stop'
$resolvedDirectory = (Resolve-Path -LiteralPath $Directory).Path
$temporaryParent = [System.IO.Path]::GetTempPath().TrimEnd('\')
if (-not $resolvedDirectory.StartsWith("$temporaryParent\anehalo-e2e-", [System.StringComparison]::OrdinalIgnoreCase) -or [System.IO.Path]::GetFileName($resolvedDirectory) -ne 'vault') { throw 'Only an isolated test vault may have its ACL changed.' }
$userIdentifier = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
if ($DenyWrite) { & icacls.exe $resolvedDirectory '/deny' "*${userIdentifier}:(OI)(CI)(W)" | Out-Null }
else { & icacls.exe $resolvedDirectory '/remove:d' "*${userIdentifier}" | Out-Null }
if ($LASTEXITCODE -ne 0) { throw 'Could not change the isolated vault ACL.' }
