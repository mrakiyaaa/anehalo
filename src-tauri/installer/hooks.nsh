!macro NSIS_HOOK_PREUNINSTALL
  ; User data belongs to the user, including WebView preferences and persisted grants.
  StrCpy $DeleteAppDataCheckboxState 0
!macroend
