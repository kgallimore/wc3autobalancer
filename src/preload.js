const { contextBridge, ipcRenderer, app } = require("electron");
const Store = require("electron-store");
const store = new Store();
// After I stop changing these values aroung I can just get the whole dict
//var autoHost = store.get("autoHost")
var autoHost = {
  enabled: store.get("autoHost.enabled") || false,
  mapName: store.get("autoHost.mapName") || "",
  ghostHost: store.get("autoHost.ghostHost") || false,
  gameName: store.get("autoHost.gameName") || "",
  eloLookup: store.get("autoHost.eloLookup") || "off",
  mapDirectory: store.get("autoHost.mapDirectory") || ["Download"],
};
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
  const mapDirectorySpan = document.getElementById("mapDirectorySpan");

  autoHostCheck.checked = autoHost.enabled;
  ghostHostCheck.checked = autoHost.ghostHost;

  autoHostMapName.value = autoHost.mapName;
  autoHostGameName.value = autoHost.gameName;
  mapDirectorySpan.innerText = "\\" + autoHost.mapDirectory.join("\\");

  document.querySelector(`input[value="${autoHost.eloLookup}"]`).checked = true;

  document
    .querySelectorAll("input[type='checkbox'], input[type='radio']")
    .forEach((input) => {
      input.addEventListener("change", updateAutoHost);
    });

  updateDisabledState(autoHost.enabled);

  function updateAutoHost(event) {
    updateDisabledState(autoHostCheck.checked);

    ipcRenderer.send("toMain", {
      messageType: "autoHost",
      data: {
        enabled: autoHostCheck.checked,
        ghostHost: ghostHostCheck.checked,
        mapName: autoHostMapName.value,
        gameName: autoHostGameName.value,
        eloLookup: document.querySelector("input[type='radio']:checked").value,
        mapDirectory: store.get("autoHost.mapDirectory"),
      },
    });
  }

  document
    .getElementById("autoHostMapDirectory")
    .addEventListener("click", function () {
      ipcRenderer.send("toMain", { messageType: "getMapDirectory" });
    });
  /*
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

*/
  for (const dependency of ["chrome", "node", "electron"]) {
    console.log(`${dependency}-version`, process.versions[dependency]);
  }
});
function updateDisabledState(autoHostEnabled) {
  document.querySelectorAll("input.auto-host-enabled").forEach((element) => {
    element.disabled = !autoHostEnabled;
  });

  document.querySelectorAll("input.auto-host-disabled").forEach((element) => {
    element.disabled = autoHostEnabled;
  });
}
