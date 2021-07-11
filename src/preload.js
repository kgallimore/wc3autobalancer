const { contextBridge, ipcRenderer, app } = require("electron");
const Store = require("electron-store");
const store = new Store();
// After I stop changing these values around I can just get the whole dict
//var autoHost = store.get("autoHost")
var autoHost = {
  type: store.get("autoHost.type") || "off",
  mapName: store.get("autoHost.mapName") || "",
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
  const autoHostState = document.getElementById("autoHostState");
  const eloLookupState = document.getElementById("eloLookup");
  const autoHostMapName = document.getElementById("autoHostMapName");
  const autoHostGameName = document.getElementById("autoHostGameName");
  const mapDirectorySpan = document.getElementById("mapDirectorySpan");

  autoHostState.value = autoHost.type;
  eloLookupState.value = autoHost.eloLookup;

  autoHostMapName.value = autoHost.mapName;
  autoHostGameName.value = autoHost.gameName;
  mapDirectorySpan.innerText = "\\" + autoHost.mapDirectory.join("\\");

  autoHostState.addEventListener("change", updateAutoHost);

  updateDisabledState(autoHost.type !== "off");

  function updateAutoHost(event) {
    updateDisabledState(autoHostState.value !== "off");

    ipcRenderer.send("toMain", {
      messageType: "autoHost",
      data: {
        type: autoHostState.value,
        mapName: autoHostMapName.value,
        gameName: autoHostGameName.value,
        eloLookup: eloLookupState.value,
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
