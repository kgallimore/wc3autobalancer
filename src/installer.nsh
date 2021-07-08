!macro customInstall
    ${If} ${FileExists} "C:\Program Files (x86)\Warcraft III\_retail_\webui\*.*"
        ; folder exists
    ${Else}
        CreateDirectory "C:\Program Files (x86)\Warcraft III\_retail_\webui"
    ${EndIf}
    CopyFiles /SILENT "$INSTDIR\webui.html" "C:\Program Files (x86)\Warcraft III\_retail_\webui\index.html"
    CopyFiles /SILENT "$INSTDIR\webui.js" "C:\Program Files (x86)\Warcraft III\_retail_\webui\index.js"
    Delete "$INSTDIR\webui.html"
    Delete "$INSTDIR\webui.js"
    ${ifNot} ${isUpdated}
        WriteRegDWORD SHCTX "SOFTWARE\Blizzard Entertainment\Warcraft III" "Allow Local Files" 0x00000001
    ${endIf}
!macroend

!macro customUnInstall
    DeleteRegValue SHCTX "SOFTWARE\Blizzard Entertainment\Warcraft III" "Allow Local Files"
    DeleteRegKey /ifempty SHCTX "SOFTWARE\Blizzard Entertainment\Warcraft III"
    Delete "C:\Program Files (x86)\Warcraft III\_retail_\webui\index.html"
    Delete "C:\Program Files (x86)\Warcraft III\_retail_\webui\index.js"
 !macroend