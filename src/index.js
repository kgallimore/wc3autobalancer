const statusElement = document.getElementById("mainStatus");
const statusText = document.getElementById("statusText");
const progressBar = document.getElementById("progressBar");
const progressBarLabel = document.getElementById("progressBarLabel");
window.api.receive("fromMain", (data) => {
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
    case "lobbyUpdate":
      generateTables(data.data);
      break;
    case "lobbyData":
      generateLobbyData(data.data);
      break;
    case "processing":
      progressBar.style.width = data.data.progress.toString() + "%";
      progressBarLabel.innerText = data.data.step;
      console.log(data.data.progress);
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
  document.getElementById("mapName").innerText = data.mapData.mapName;
  document.getElementById("gameName").innerText = data.mapData.gameName;
  document.getElementById("gameHost").innerText = data.mapData.gameHost;
  document.getElementById(
    "eloAvailable"
  ).innerText = `${data.eloAvailable}. (${data.eloMapName})`;
}

// This is going to be a very messy function,placeholder to just get it started
function generateTables(lobby) {
  try {
    document.getElementById("tablesDiv").innerHTML = "";
    let tbl;
    Object.keys(lobby.lobbyData.teamList.playerTeams).forEach((playerTeam) => {
      tbl = document.createElement("table");
      tbl.classList.add("table", "table-hover", "table-striped", "table-sm");
      let trow = tbl.createTHead().insertRow();
      [`${playerTeam} Player`, "ELO"].forEach((label) => {
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
    });
  } catch (e) {
    console.error(e.message, e.stack);
  }
}
var test = {
  mapData: {
    mapName: "HLW 8.3",
    mapAuthor: "Author: BuuFuu",
    mapPlayerSize: "10",
    gameName: "This is a test #1",
    gameHost: "Trenchguns",
    mapPlayers: "3/10",
    isHost: true,
  },
  eloMapName: "HLW",
  eloAvailable: true,
  eloList: { Trenchguns: 738 },
  lookingUpELO: ["Trenchguns"],
  lobbyData: {
    openPlayerSlots: 7,
    allPlayers: ["Trenchguns"],
    teamList: {
      playerTeams: {
        FORCE01: {
          slots: [
            "Trenchguns",
            "Slot 2 OPEN SLOT",
            "Slot 3 OPEN SLOT",
            "Slot 4 OPEN SLOT",
          ],
          players: ["Trenchguns"],
          openSlots: 3,
          closedSlots: 0,
          computers: 0,
        },
        FORCE02: {
          slots: [
            "Slot 1 OPEN SLOT",
            "Slot 2 OPEN SLOT",
            "Slot 3 OPEN SLOT",
            "Slot 4 OPEN SLOT",
          ],
          players: [],
          openSlots: 4,
          closedSlots: 0,
          computers: 0,
        },
      },
      otherTeams: {
        "ATTACKER CREEPS FORCE01": {
          slots: ["Computer (Normal)"],
          players: [],
          openSlots: 0,
          closedSlots: 0,
          computers: 1,
        },
        "ATTACKER CREEPS FORCE02": {
          slots: ["Computer (Normal)"],
          players: [],
          openSlots: 0,
          closedSlots: 0,
          computers: 1,
        },
      },
      specTeams: {},
    },
  },
};

generateTables(test);
generateLobbyData(test);
