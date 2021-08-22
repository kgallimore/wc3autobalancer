@echo off
IF EXIST "C:\Program Files (x86)\Warcraft III\_retail_\webui\index.js" (
    del "C:\Program Files (x86)\Warcraft III\_retail_\webui\index.js"
)
IF EXIST "C:\Program Files (x86)\Warcraft III\_retail_\webui\index.html" (
    del "C:\Program Files (x86)\Warcraft III\_retail_\webui\index.html"
)
IF EXIST "C:\Program Files (x86)\Warcraft III\_retail_\webui\GlueManagerCompressed.js" (
    del "C:\Program Files (x86)\Warcraft III\_retail_\webui\GlueManagerCompressed.js"
)
mklink /h "C:\Program Files (x86)\Warcraft III\_retail_\webui\index.html" "./webui.html"
mklink /h "C:\Program Files (x86)\Warcraft III\_retail_\webui\index.js" "./webui.js"
mklink /h "C:\Program Files (x86)\Warcraft III\_retail_\webui\GlueManagerCompressed.js" "./GlueManagerCompressed.js"
mklink /h "C:\Program Files (x86)\Warcraft III\_retail_\webui\GlueManagerTest.js" "./GlueManagerTest.js"