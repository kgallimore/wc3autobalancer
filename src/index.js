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
