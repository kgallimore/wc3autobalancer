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
/*
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
});*/

if (document.readyState !== "loading") {
  console.log("document is ready");
  init();
} else {
  document.addEventListener("DOMContentLoaded", function () {
    console.log("document was not ready");
    init();
  });
}
function init() {
  updateSettings();
  document.querySelectorAll("input, select").forEach((input) => {
    if (input.nodeName === "INPUT" && input.type === "text") {
      input.addEventListener("keyup", updateName);
    } else {
      input.addEventListener("change", updateAutoHostSingle);
    }
  });

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
          value: document.getElementById("autoHostMapName").value,
        },
      });
    }
    if (autoHostGameName.value !== autoHost.gameName) {
      ipcRenderer.send("toMain", {
        messageType: "autoHostSingle",
        data: {
          key: "gameName",
          value: document.getElementById("autoHostGameName").value,
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
  const statusElement = document.getElementById("mainStatus");
  const statusText = document.getElementById("statusText");
  const progressBar = document.getElementById("progressBar");
  const progressBarLabel = document.getElementById("progressBarLabel");

  function updateSettings() {
    document.querySelectorAll("input, select").forEach((input) => {
      if (input.type === "checkbox") {
        input.checked = autoHost[input.getAttribute("data-autoHost-key")];
      } else {
        input.value = autoHost[input.getAttribute("data-autoHost-key")];
      }
    });
    document.getElementById("autoHostSettings").style.display =
      autoHost.type === "off" ? "none" : "block";
  }

  ipcRenderer.on("fromMain", (event, data) => {
    switch (data.messageType) {
      case "statusChange":
        switch (data.data) {
          case "connected":
            statusText.innerText = "Connected to Warcraft";
            statusElement.classList.remove("bg-secondary", "bg-warning");
            statusElement.classList.add("bg-success", "badge");
            break;
          case "disconnected":
            statusText.innerText = "Disconnected from Warcraft";
            statusElement.classList.remove("bg-secondary", "bg-success");
            statusElement.classList.add("bg-warning", "badge");
            break;
        }
        break;
      case "autoHost":
        console.log("autoHost", data.data);
        autoHost = data.data;
        updateSettings();
        break;
      case "lobbyUpdate":
        generateTables(data.data);
        break;
      case "lobbyData":
        generateLobbyData(data.data);
        break;
      case "processing":
        progressBarLabel.innerText = data.data.step;
        progressBar.style.width = data.data.progress.toString() + "%";
        break;
      case "menusChange":
        document.getElementById("menuStateLabel").innerText = data.data;
        break;
      case "error":
        alert(data.data);
        break;
      case "gotMapDirectory":
        document.getElementById("mapDirectorySpan").innerText =
          "\\" + data.data.join("\\");
        break;
      default:
        console.log("Unknown:", data);
    }
  });

  function generateLobbyData(data) {
    try {
      document.getElementById("mapName").innerText = data.mapData.mapName;
      document.getElementById("gameName").innerText = data.mapData.gameName;
      document.getElementById("gameHost").innerText = data.mapData.gameHost;
      document.getElementById(
        "eloAvailable"
      ).innerText = `${data.eloAvailable}. (${data.eloMapName})`;
    } catch (e) {
      console.log(e.message, e.stack);
    }
  }

  // This is going to be a very messy function,placeholder to just get it started
  function generateTables(lobby) {
    try {
      console.log("Generating tables");
      document.getElementById("tablesDiv").innerHTML = "";
      let tbl;
      Object.keys(lobby.lobbyData.teamList.playerTeams).forEach(
        (playerTeam) => {
          tbl = document.createElement("table");
          tbl.classList.add(
            "table",
            "table-hover",
            "table-striped",
            "table-sm"
          );
          let trow = tbl.createTHead().insertRow();
          [`${playerTeam} Players`, "ELO"].forEach((label) => {
            let th = document.createElement("th");
            th.appendChild(document.createTextNode(label));
            trow.appendChild(th);
          });
          let tBody = tbl.createTBody();
          lobby.lobbyData.teamList.playerTeams[playerTeam].slots.forEach(
            (player) => {
              let row = tBody.insertRow();
              row.insertCell().appendChild(document.createTextNode(player));
              let cell = row.insertCell();
              let text = document.createTextNode(
                lobby.eloList && lobby.eloList[player]
                  ? lobby.eloList[player]
                  : "N/A"
              );
              cell.appendChild(text);
            }
          );
          document.getElementById("tablesDiv").appendChild(tbl);
        }
      );
    } catch (e) {
      console.error(e.message, e.stack);
    }
  }
}
