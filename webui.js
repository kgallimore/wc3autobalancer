let webSocket, menusObserver, lobbyObserver;
let lobby = {};
let menuState = "Out of Menus";
let joiningLobby = false;
let autoHost = {
  type: "off",
  mapName: "",
  ghostHost: false,
  mapDirectory: "\\Download",
};
const testNonPlayersTeam = /((computer)|(creep))/i;
const testSpecTeam = /((host)|(spectator)|(observer))/i;
const testSlotAvailable = /Slot \d+ (Open Slot|Closed)/i;
const testSlotOpen = /Open/i;
const testComputer = /(Computer \(\S+\))/i;
const testGameName = / #\d+$/;

function emptyTeams() {
  this.slots = [];
  this.players = [];
  this.openSlots = 0;
  this.closedSlots = 0;
  this.computers = 0;
}

function wsSetup() {
  webSocket = new WebSocket("ws://127.0.0.1:8888");
  webSocket.onopen = function (event) {
    sendSocket("info", "Connected. Hello!");
    if (lobby && Object.keys(lobby).length > 0) {
      sendSocket("lobbyData", lobby);
    }
  };
  webSocket.onclose = function (event) {
    window.setTimeout(wsSetup, 5000);
  };
  webSocket.onmessage = function (event) {
    const data = JSON.parse(event.data);

    switch (data.messageType) {
      case "lobby":
        lobby = getLobbyData();
        if (lobby) {
          sendSocket("lobbydata", lobby);
        }
        break;
      case "page":
        sendSocket("body", document.getElementById("root").innerHTML);
        break;
      case "spectate":
        moveInLobby();
        break;
      case "autoHost":
        autoHost = data.data;
        sendSocket("info", autoHost);
        break;
      case "start":
        clickStart();
        break;
      case "getElementPos":
        try {
          var rect = document.querySelector(data.data).getBoundingClientRect();
          sendSocket("info", [rect.top, rect.right, rect.bottom, rect.left]);
        } catch (e) {
          sendSocket("error", ["getElementPos", e.message]);
        }
        break;
      case "sendChat":
        const chatInput = document.getElementById("chatPanelInput");
        chatInput.focus();
        sendSocket("chatReady");
        break;
      default:
        webSocket.send(
          JSON.stringify({ messageType: "echo", data: event.data })
        );
        break;
    }
  };
}

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
    } else {
      newMenuState = "Unknown";
    }
    if (newMenuState !== menuState) {
      joiningLobby = false;
      menuState = newMenuState;
      sendSocket("menusChange", menuState);
      if (autoHost.type !== "off") {
        switch (newMenuState) {
          case "Main Menu":
            clickCustomGames();
            break;
          case "Browse Games":
            clickCreate();
            break;
          case "Creating Game":
            createLobby();
            break;
          case "Score Screen":
            if (autoHost.type !== "off") {
              document.querySelector("div.EscapeIcon").click();
            }
            break;
        }
      }

      if (menuState === "In Lobby") {
        getLobbyHelper();
        if (autoHost.type !== "off") {
          if (autoHost.ghostHost) {
            moveInLobby();
          }
          try {
            document
              .querySelectorAll("div.GameLobby-PlayerRow-Container")
              .forEach(function (element) {
                lobbyObserver.observe(element, {
                  attributes: false,
                  childList: true,
                  subtree: true,
                });
              });
          } catch (e) {
            sendSocket("error", e.message + "\n" + e.stack);
          }
        }
      } else {
        if (lobbyObserver) {
          try {
            lobbyObserver.disconnect();
          } catch (e) {
            sendSocket("error", e.message + "\n" + e.stack);
          }
        }
      }
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
  lobby.lobbyData = getLobbyData();
  if (lobby.lobbyData) {
    sendSocket("lobbyUpdate", lobby.lobbyData);
  } else {
    sendSocket("error", e.message + "\n" + e.stack);
  }
}

function moveInLobby() {
  if (document.querySelector("div.GameLobby-PlayerTeam-ObserverTeam")) {
    document
      .querySelectorAll("div.TeamContainer-Name")
      .forEach((teamNameDiv) => {
        if (
          teamNameDiv.innerText.toLowerCase().replace(/(\r\n|\n|\r)/gm, "") ===
          "observer team"
        ) {
          teamNameDiv.click();

          return;
        }
      });
  } else {
    try {
      if (lobby && Object.keys(lobby.lobbyData.teamList.specTeams).length > 0) {
        Object.keys(lobby.teamList.specTeams).forEach(function (teamName) {
          if (lobby.teamList.specTeams[teamName].openSlots > 0) {
            document
              .querySelectorAll("div.TeamContainer-Name")
              .forEach((teamNameDiv) => {
                if (
                  teamNameDiv.innerText
                    .toLowerCase()
                    .replace(/(\r\n|\n|\r)/gm, "") === teamName.toLowerCase()
                ) {
                  teamNameDiv.click();

                  return;
                }
              });
          }
        });
      }
    } catch (err) {
      sendSocket("error", ["moveInLobby", err.message]);
    }
  }
}

function clickStart() {
  try {
    const element = document.querySelector(
      "div.Primary-Button.Primary-Button-Green"
    ).firstChild.firstChild;
    element.click();
  } catch (e) {
    sendSocket("error", ["clickStart", e.message + "\n" + e.stack]);
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
  if (menuState === "Creating Game") {
    try {
      /*const isInMapDownloads =
        document.getElementById("MapItem-0") &&
        document
          .getElementById("MapItem-0")
          .innerText.toLowerCase()
          .replace(/(\r\n|\n|\r)/gm, "") === "download";*/

      const isIncorrectMap =
        document.querySelector("div.CreateGameMenu-MapDetails-MapName") &&
        document
          .querySelector("div.CreateGameMenu-MapDetails-MapName")
          .innerText.replace(/(\r\n|\n|\r)/gm, "")
          .toLowerCase() !== autoHost.mapName.toLowerCase();

      const isGameNameUnfocused =
        document.querySelector("div.CreateGameMenu-CreateButton-Holder") &&
        document
          .querySelector("div.CreateGameMenu-CreateButton-Holder")
          .classList.contains("disabled");

      const isValidGameName = testGameName.test(
        document.querySelector("div.CreateGameMenu-GameName input").value
      );

      /*if (isInMapDownloads) {
        document.getElementById("MapItem-0").click();
        setTimeout(() => {
          const button = document.querySelector(
            "div.CreateGameMenu-DirectoryDetails div.Primary-Button-Frame-Alternate-B > div > div"
          );
          if (button) button.click();
        }, 100);
      }*/
      // If the current map selected is not equal to the autoHost.mapName, find it and click it
      if (isIncorrectMap) {
        document
          .querySelectorAll(
            ".CreateGameMenu-MapList div.CreateGameMenu-MapItem-Label"
          )
          .forEach(function (button) {
            const buttonText = button.innerText
              .replace(/(\r\n|\n|\r)/gm, "")
              .toLowerCase();
            if (buttonText === autoHost.mapName.toLowerCase()) {
              button.click();
            } else if (
              autoHost.mapDirectory.some((item) => {
                var re = new RegExp(`^${item}$`, "i");
                return buttonText.match(re);
              })
            ) {
              button.click();
              setTimeout(() => {
                const openFolderButton = document.querySelector(
                  "div.CreateGameMenu-DirectoryDetails div.Primary-Button-Frame-Alternate-B > div > div"
                );
                if (openFolderButton) openFolderButton.click();
              }, 100);
            }
          });
      }
      // If the create button is not enabled, focus the game name input and tell the main program to start typing the name
      else if (isGameNameUnfocused) {
        if (!joiningLobby) {
          document.querySelector("div.CreateGameMenu-GameName input").focus();
          sendSocket("robot");
        }
      }
      // If the input field is set to the correct game name, click create game
      if (!isIncorrectMap && isValidGameName) {
        document
          .querySelector(
            "div.CreateGameMenu-CreateButton-Holder div.Primary-Button-Content"
          )
          .click();
        joiningLobby = true;
      }

      setTimeout(createLobby, 1000);
    } catch (e) {
      setTimeout(createLobby, 1000);
      sendSocket("error", ["createLobby", e.message + "\n" + e.stack]);
    }
  }
}

function getLobbyHelper() {
  if (menuState === "In Lobby") {
    lobby.mapData = getMapData();
    if (!lobby.mapData) {
      sendSocket("error", e.message + "\n" + e.stack);
      setTimeout(getLobbyHelper, 1000);
      return;
    }
    lobby.lobbyData = getLobbyData();
    if (!lobby.lobbyData) {
      sendSocket("error", e.message + "\n" + e.stack);
      setTimeout(getLobbyHelper, 1000);
      return;
    }
    sendSocket("lobbyData", lobby);
  }
}

function getMapData() {
  try {
    return {
      mapName: document.querySelector("div.GameLobby-MapDetails-MapName")
        .innerText,
      mapAuthor: document.querySelector("div.GameLobby-MapAuthor").innerText,
      mapPlayerSize: document.querySelector("div.GameLobby-MaxPlayerSize")
        .innerText,
      gameName: document.querySelector(
        "div.GameSummary-GameName.GameLobby-DetailAttributeValue"
      ).innerText,
      gameHost: document.querySelector(
        "div.GameSummary-Host.GameLobby-DetailAttributeValue"
      ).innerText,
      mapPlayers: document.querySelector(
        "div.GameSummary-Players.GameLobby-DetailAttributeValue"
      ).innerText,
      isHost:
        document.querySelector("div.Primary-Button.Primary-Button-Green") !=
        null,
    };
  } catch (e) {
    sendSocket("error", e.message + "\n" + e.stack);
    return false;
  }
}

function getLobbyData() {
  try {
    let teamList = { playerTeams: {}, otherTeams: {}, specTeams: {} };
    let allPlayers = [];
    let openPlayerSlots = 0;
    let countPlayers = false;

    document
      .querySelectorAll("div.TeamContainer")
      .forEach(function (container) {
        const teamName =
          container.querySelector("div.TeamContainer-Name").innerText ||
          "Team " + (Object.keys(teamList).length + 1).toString();
        var teamPointer;
        if (testNonPlayersTeam.test(teamName)) {
          countPlayers = false;
          teamList.otherTeams[teamName] = new emptyTeams();
          teamPointer = teamList.otherTeams[teamName];
        } else if (testSpecTeam.test(teamName)) {
          countPlayers = false;
          teamList.specTeams[teamName] = new emptyTeams();
          teamPointer = teamList.specTeams[teamName];
        } else {
          countPlayers = true;
          teamList.playerTeams[teamName] = new emptyTeams();
          teamPointer = teamList.playerTeams[teamName];
        }
        container
          .querySelectorAll("div.GameLobby-PlayerRow-Container")
          .forEach(function (playerRow) {
            if (playerRow.querySelector("div.GameLobby-EmptyRow") == null) {
              const playerName =
                playerRow.querySelector("div.nameTag").innerText;
              teamPointer.slots.push(playerName);
              if (!testComputer.test(playerName)) {
                teamPointer.players.push(playerName);
                if (countPlayers) {
                  allPlayers.push(playerName);
                }
              } else {
                teamPointer.computers++;
              }
            } else {
              const slotTitle = playerRow.innerText.replace(
                /(\r\n|\n|\r)/gm,
                ""
              );
              if (testSlotOpen.test(slotTitle)) {
                teamPointer.openSlots++;
                if (countPlayers) {
                  openPlayerSlots++;
                }
              } else {
                teamPointer.closedSlots++;
              }
              teamPointer.slots.push(
                "Slot " +
                  (teamPointer.slots.length + 1).toString() +
                  " " +
                  slotTitle
              );
            }
          });
      });
    return {
      openPlayerSlots: openPlayerSlots,
      allPlayers: allPlayers,
      teamList: teamList,
    };
  } catch (e) {
    sendSocket("error", e.message + "\n" + e.stack);
    return false;
  }
}

function sendSocket(messageType = "info", data = messageType) {
  webSocket.send(JSON.stringify({ messageType: messageType, data: data }));
}

mutationsSetup();

wsSetup();
