const { contextBridge, ipcRenderer } = require("electron");
const Store = require("electron-store");
const store = new Store();

var autoHost = store.get("autoHost") || {
  enabled: false,
  mapName: "",
  ghostHost: false,
  gameName: "",
};
console.log(autoHost);
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
  const autoHostGameName = document.getElementById("autoHostGameName");

  function updateAutoHost(event) {
    autoHostMapName.disabled = autoHostCheck.checked;
    autoHostGameName.disabled = autoHostCheck.checked;
    ghostHostCheck.disabled = !autoHostCheck.checked;
    ipcRenderer.send("toMain", {
      messageType: "autoHost",
      data: {
        enabled: autoHostCheck.checked,
        ghostHost: ghostHostCheck.checked,
        mapName: autoHostMapName.value,
        gameName: autoHostGameName.value,
      },
    });
  }
  autoHostCheck.checked = autoHost.enabled;
  ghostHostCheck.checked = autoHost.ghostHost;

  ghostHostCheck.disabled = !autoHost.enabled;

  autoHostMapName.disabled = autoHost.enabled;
  autoHostMapName.value = autoHost.mapName;

  autoHostGameName.disabled = autoHost.enabled;
  autoHostGameName.value = autoHost.gameName;

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
