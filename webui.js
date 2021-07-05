let webSocket, menusObserver, lobbyObserver;
let menuState = "Out of Menus";
let autoHost = false;
let creatingLobby = false;
const testNonPlayersTeam = new RegExp(
  /.*((computer)|(host)|(spectator)|(creep)).*/i
);
const testSlotAvailable = new RegExp(/Slot \d+ \(Open Slot|Closed\)/);
webSocket = new WebSocket("ws://127.0.0.1:8888");
webSocket.onopen = function (event) {
  webSocket.send(
    JSON.stringify({ messageType: "info", data: "Connected. Hello!" })
  );
};
webSocket.onclose = function (event) {
  menusObserver.disconnect();
  window.setTimeout(wsSetup, 3000);
};
webSocket.onmessage = function (event) {
  const data = JSON.parse(event.data);
  switch (data.messageType) {
    case "lobby":
      const lobby = getLobbyData();
      if (lobby) {
        sendSocket("lobbydata", lobby);
      }
      break;
    case "page":
      sendSocket("body", document.getElementById("root").innerHTML);
      break;
    case "start":
      clickStart();
      break;
    case "getElementPos":
      try {
        var rect = document.querySelector(data.data).getBoundingClientRect();
        sendSocket("info", [rect.top, rect.right, rect.bottom, rect.left]);
      } catch (e) {
        sendSocket("error", e.message);
      }
      break;
    case "sendChat":
      const chatInput = document.getElementById("chatPanelInput");
      chatInput.focus();
      sendSocket("chatReady");
      break;
    default:
      webSocket.send(JSON.stringify({ messageType: "echo", data: event.data }));
      break;
  }
};

function mutationsSetup() {
  const menusObserverCallback = function (mutationsList, menusObserver) {
    if (document.querySelector("div.MainMenuScreen-Copyright")) {
      newMenuState = "Main Menu";
    } else if (document.querySelector("div.GamesListing-List")) {
      newMenuState = "Browse Games";
    } else if (document.querySelector("div.CreateGameMenu")) {
      newMenuState = "Creating Game";
    } else if (document.getElementById("root").innerText === "") {
      newMenuState = "Out of Menus";
    } else if (document.querySelector("div.TeamContainer")) {
      newMenuState = "In Lobby";
    } else if (document.querySelector("div.ScoreScreen-Table")) {
      newMenuState = "Score Screen";
    }
    if (newMenuState !== menuState) {
      menuState = newMenuState;
      if (autoHost) {
        switch (newMenuState) {
          case "Main Menu":
            setTimeout(clickCustomGames, 1000);
            break;
          case "Browse Games":
            setTimeout(clickCreate, 1000);
            break;
          case "Creating Game":
            if (!creatingLobby) {
              setTimeout(createLobby, 1000);
            }
            break;
          case "Score Screen":
            document.querySelector("div.EscapeIcon").click();
            break;
        }
      }
      if (newMenuState === "In Lobby") {
        creatingLobby = false;
        document.querySelectorAll("div.nameTag").forEach(function (element) {
          lobbyObserver.observe(element, {
            attributes: false,
            childList: false,
            subtree: false,
          });
        });
      }
      sendSocket("menusChange", menuState);
    }
  };
  menusObserver = new MutationObserver(menusObserverCallback);
  lobbyObserver = new MutationObserver(handleLobby);
  menusObserver.observe(document.getElementById("root"), {
    attributes: false,
    childList: true,
    subtree: true,
  });
}

function clickCustomGames() {
  document
    .querySelector("div.MainMenuScreen-NavigationHolder")
    .querySelectorAll("div.Primary-Button-Content")
    .forEach(function (button) {
      if (button.innerText.toLowerCase() === "custom games") {
        button.click();
        return;
      }
    });
  setTimeout(clickCustomGames, 2000);
}

function handleLobby() {
  const lobby = getLobbyData();
  if (lobby) {
    Onject.values(lobby.teamList.playerTeams).forEach(function (teamPlayers) {
      teamPlayers.forEach(function (user) {
        if (testSlotAvailable.test(user)) {
          return;
        }
      });
    });
    sendSocket("lobbydata", lobby);
  }
}

function clickStart() {
  try {
    const element = document.querySelector(
      "div.Primary-Button.Primary-Button-Green"
    ).firstChild.firstChild;
    element.click();
  } catch (e) {
    sendSocket("error", e.message);
  }
}

function clickCreate() {
  document
    .querySelector("div.GameListing-Btns")
    .querySelectorAll("div.Primary-Button-Content")
    .forEach(function (button) {
      if (button.innerText.toLowerCase() === "create") {
        button.click();
        return;
      }
    });
  setTimeout(clickCreate, 2000);
}

function createLobby() {
  creatingLobby = true;
  try {
    if (
      document
        .getElementById("MapItem-0")
        .innerText.toLowerCase()
        .replace(/(\r\n|\n|\r)/gm, "") === "download"
    ) {
      document.getElementById("MapItem-0").click();
      try {
        document
          .querySelector("div.CreateGameMenu-DirectoryDetails")
          .querySelector("div.Primary-Button-Frame-Alternate-B")
          .firstChild.firstChild.click();
      } catch (e) {
        sendSocket("error", e.message);
        setTimeout(createLobby, 500);
        return;
      }

      setTimeout(createLobby, 2000);
      return;
    }
    if (
      document
        .querySelector("div.CreateGameMenu-CreateButton-Holder")
        .classList.contains("disabled")
    ) {
      document
        .querySelector("div.CreateGameMenu-MapList")
        .querySelectorAll("div.CreateGameMenu-MapItem-Label")
        .forEach(function (button) {
          if (
            button.innerText.toLowerCase().replace(/(\r\n|\n|\r)/gm, "") ===
            "hlw 8.3"
          ) {
            button.click();
            document
              .querySelector("div.CreateGameMenu-GameName")
              .querySelector("input")
              .focus();
            sendSocket("robot");
            setTimeout(createLobby, 2000);
            return;
          }
        });
    } else {
      document
        .querySelector("div.CreateGameMenu-CreateButton-Holder")
        .querySelector("div.Primary-Button-Content")
        .click();
    }
  } catch (e) {
    sendSocket("error", e.message);
  }
}

function getLobbyData() {
  try {
    const mapName = document.querySelector(
      "div.GameLobby-MapDetails-MapName"
    ).innerText;
    const mapAuthor = document.querySelector(
      "div.GameLobby-MapAuthor"
    ).innerText;
    const mapPlayerSize = document.querySelector(
      "div.GameLobby-MaxPlayerSize"
    ).innerText;
    const gameName = document.querySelector(
      "div.GameSummary-GameName.GameLobby-DetailAttributeValue"
    ).innerText;
    const gameHost = document.querySelector(
      "div.GameSummary-Host.GameLobby-DetailAttributeValue"
    ).innerText;
    const playerCount = document.querySelector(
      "div.GameSummary-Players.GameLobby-DetailAttributeValue"
    ).innerText;
    const isHost =
      document.querySelector("div.Primary-Button.Primary-Button-Green") != null;
    let teamList = { playerTeams: {}, otherTeams: {} };

    document
      .querySelectorAll("div.TeamContainer")
      .forEach(function (container) {
        const teamName =
          container.querySelector("div.TeamContainer-Name").innerText ||
          "Team " + (Object.keys(teamList).length + 1).toString();
        if (!testNonPlayersTeam.test(teamName)) {
          teamList.playerTeams[teamName] = [];

          container
            .querySelectorAll("div.GameLobby-PlayerRow-Container")
            .forEach(function (playerRow) {
              if (playerRow.querySelector("div.GameLobby-EmptyRow") == null) {
                const playerName =
                  playerRow.querySelector("div.nameTag").innerText;
                teamList.playerTeams[teamName].push(playerName);
              } else {
                teamList.playerTeams[teamName].push(
                  "Slot " +
                    (teamList.playerTeams[teamName].length + 1).toString() +
                    " " +
                    playerRow.innerText.replace(/(\r\n|\n|\r)/gm, "")
                );
              }
            });
        } else {
          teamList.otherTeams[teamName] = [];

          container
            .querySelectorAll("div.GameLobby-PlayerRow-Container")
            .forEach(function (playerRow) {
              if (playerRow.querySelector("div.GameLobby-EmptyRow") == null) {
                const playerName =
                  playerRow.querySelector("div.nameTag").innerText;
                teamList.otherTeams[teamName].push(playerName);
              } else {
                teamList.otherTeams[teamName].push(
                  "Slot " +
                    (teamList.otherTeams[teamName].length + 1).toString() +
                    " " +
                    playerRow.innerText.replace(/(\r\n|\n|\r)/gm, "")
                );
              }
            });
        }
      });
    return {
      mapName: mapName,
      mapAuthor: mapAuthor,
      mapPlayerSize: mapPlayerSize,
      gameName: gameName,
      gameHost: gameHost,
      isHost: isHost,
      playerCount: playerCount,
      teamList: teamList,
    };
  } catch (e) {
    sendSocket("error", e.message);
    return false;
  }
}

function sendSocket(messageType = "info", data = "none") {
  webSocket.send(JSON.stringify({ messageType: messageType, data: data }));
}

mutationsSetup();
