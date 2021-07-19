const { contextBridge, ipcRenderer, shell } = require("electron");
const Store = require("electron-store");
const store = new Store();
// After I stop changing these values around I can just get the whole dict
//var autoHost = store.get("autoHost")
var autoHost = {
  type: store.get("autoHost.type") || "off",
  private: store.get("autoHost.private") || false,
  sounds: store.get("autoHost.sounds") || false,
  increment: store.get("autoHost.increment") || true,
  mapName: store.get("autoHost.mapName") || "",
  gameName: store.get("autoHost.gameName") || "",
  eloLookup: store.get("autoHost.eloLookup") || "off",
  eloAvailable: store.get("autoHost.eloAvailable") || false,
  eloMapName: store.get("autoHost.eloMapName") || "",
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
  const autoHostPrivateCheck = document.getElementById("autoHostPrivateCheck");
  const autoHostSoundsCheck = document.getElementById("autoHostSoundsCheck");
  const autoHostIncrementCheck = document.getElementById(
    "autoHostIncrementCheck"
  );

  autoHostState.value = autoHost.type;
  eloLookupState.value = autoHost.eloLookup;

  autoHostPrivateCheck.checked = autoHost.private;
  autoHostSoundsCheck.checked = autoHost.sounds;
  autoHostIncrementCheck.checked = autoHost.increment;

  autoHostMapName.value = autoHost.mapName;
  autoHostGameName.value = autoHost.gameName;
  mapDirectorySpan.innerText = "\\" + autoHost.mapDirectory.join("\\");

  autoHostState.addEventListener("change", updateAutoHostSingle);
  autoHostPrivateCheck.addEventListener("change", updateAutoHostSingle);
  eloLookupState.addEventListener("change", updateAutoHostSingle);
  autoHostSoundsCheck.addEventListener("change", updateAutoHostSingle);
  autoHostIncrementCheck.addEventListener("change", updateAutoHostSingle);

  updateDisabledState(autoHost.type !== "off");

  function updateAutoHostSingle(event) {
    updateDisabledState(autoHostState.value !== "off");
    const value =
      event.target.nodeName === "INPUT" && event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;
    ipcRenderer.send("toMain", {
      messageType: "autoHostSingle",
      data: {
        key: event.target.getAttribute("data-autoHost-key"),
        value: value,
        mapName: autoHostMapName.value,
        gameName: autoHostGameName.value,
      },
    });
  }

  document
    .getElementById("autoHostMapDirectory")
    .addEventListener("click", function () {
      ipcRenderer.send("toMain", { messageType: "getMapDirectory" });
    });
  document.getElementById("logsButton").addEventListener("click", function () {
    ipcRenderer.send("toMain", {
      messageType: "openLogs",
    });
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
