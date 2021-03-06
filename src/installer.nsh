!macro customInstall
    WriteRegDWORD SHCTX "SOFTWARE\Blizzard Entertainment\Warcraft III" "Allow Local Files" 0x00000001
    ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Warcraft III" "InstallLocation"
    ${If} ${FileExists} "$0\_retail_\webui\*.*"
        ; folder exists
    ${Else}
        CreateDirectory "$0\_retail_\webui"
    ${EndIf}
    CopyFiles /SILENT "$INSTDIR\webui.html" "$0\_retail_\webui\index.html"
    CopyFiles /SILENT "$INSTDIR\webui.js" "$0\_retail_\webui\index.js"
    Delete "$INSTDIR\webui.html"
    Delete "$INSTDIR\webui.js"
!macroend

!macro customUnInstall
    ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Warcraft III" "InstallLocation"
    DeleteRegValue SHCTX "SOFTWARE\Blizzard Entertainment\Warcraft III" "Allow Local Files"
    DeleteRegKey /ifempty SHCTX "SOFTWARE\Blizzard Entertainment\Warcraft III"
    Delete "$0\_retail_\webui\index.html"
    Delete "$0\_retail_\webui\index.js"
 !macroend