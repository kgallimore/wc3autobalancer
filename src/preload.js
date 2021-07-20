const { contextBridge, ipcRenderer } = require("electron");
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

  autoHostMapName.addEventListener("keyup", updateName);
  autoHostGameName.addEventListener("keyup", updateName);

  function updateAutoHostSingle(event) {
    const value =
      event.target.nodeName === "INPUT" && event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;
    const key = event.target.getAttribute("data-autoHost-key");
    autoHost[key] = value;
    ipcRenderer.send("toMain", {
      messageType: "autoHostSingle",
      data: {
        key: key,
        value: value,
      },
    });
    if (event.target.getAttribute("data-autoHost-key") === "type") {
      document.getElementById("autoHostSettings").style.display =
        value === "off" ? "none" : "block";
    }
  }

  function updateName(event) {
    if (event.key === "Enter") {
      sendNames();
    } else {
      document.getElementById("saveNameButton").style.display = "block";
    }
  }

  function sendNames() {
    if (autoHostMapName.value !== autoHost.mapName) {
      ipcRenderer.send("toMain", {
        messageType: "autoHostSingle",
        data: {
          key: "mapName",
          value: autoHostMapName.value,
        },
      });
    }
    if (autoHostGameName.value !== autoHost.gameName) {
      ipcRenderer.send("toMain", {
        messageType: "autoHostSingle",
        data: {
          key: "gameName",
          value: autoHostGameName.value,
        },
      });
    }

    document.getElementById("saveNameButton").style.display = "none";
  }

  document
    .getElementById("saveNameButton")
    .addEventListener("click", sendNames);

  document.getElementById("autoHostSettings").style.display =
    autoHost.type === "off" ? "none" : "block";

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

  for (const dependency of ["chrome", "node", "electron"]) {
    console.log(`${dependency}-version`, process.versions[dependency]);
  }
});
