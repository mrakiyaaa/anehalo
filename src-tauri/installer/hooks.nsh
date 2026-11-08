!macro NSIS_HOOK_PREUNINSTALL
  ; User data belongs to the user, including WebView preferences and persisted grants.
  StrCpy $DeleteAppDataCheckboxState 0
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; Interactive installs otherwise defer this to an optional finish-page checkbox.
  Call CreateOrUpdateDesktopShortcut
!macroend
