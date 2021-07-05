const { contextBridge, ipcRenderer } = require("electron");
const Store = require("electron-store");
const store = new Store();

var autoHost = store.get("autoHost");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("api", {
  send: (channel, data) => {
    // whitelist channels
    let validChannels = ["toMain"];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  receive: (channel, func) => {
    let validChannels = ["fromMain"];
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
});

window.addEventListener("DOMContentLoaded", () => {
  const autoHostCheck = document.getElementById("autoHostCheck");
  const ghostHostCheck = document.getElementById("ghostHostCheck");
  const autoHostMapName = document.getElementById("autoHostMapName");
  function updateAutoHost(event) {
    autoHostMapName.disabled = event.currentTarget.checked;
    ipcRenderer.send("toMain", {
      messageType: "autoHost",
      data: {
        enabled: autoHostCheck.checked,
        ghost: ghostHostCheck.checked,
        mapName: autoHostMapName.value,
      },
    });
  }
  autoHostCheck.checked = autoHost.enabled || false;
  autoHostMapName.disabled = autoHost.enabled || false;
  ghostHostCheck.disabled = autoHost.ghostHost || false;
  ghostHostCheck.value = autoHost.ghostHost || false;
  autoHostMapName.value = autoHost.mapName || "";
  autoHostCheck.addEventListener("change", updateAutoHost);
  ghostHostCheck.addEventListener("change", updateAutoHost);
  /*
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const dependency of ["chrome", "node", "electron"]) {
    replaceText(`${dependency}-version`, process.versions[dependency]);
  }*/
});
