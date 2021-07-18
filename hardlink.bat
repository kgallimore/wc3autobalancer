@echo off
IF EXIST "C:\Program Files (x86)\Warcraft III\_retail_\webui\index.js" (
    del "C:\Program Files (x86)\Warcraft III\_retail_\webui\index.js"
)
IF EXIST "C:\Program Files (x86)\Warcraft III\_retail_\webui\index.html" (
    del "C:\Program Files (x86)\Warcraft III\_retail_\webui\index.html"
)
mklink /h "C:\Program Files (x86)\Warcraft III\_retail_\webui\index.html" "./webui.html"
mklink /h "C:\Program Files (x86)\Warcraft III\_retail_\webui\index.js" "./webui.js"