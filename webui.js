let webSocket, menusObserver, lobbyObserver;
let lobby = {};
let menuState = "Out of Menus";
let typingGameName = false;
let autoHost = {
  type: "off",
  private: false,
  increment: true,
  mapName: "",
  gameName: "",
  eloLookup: "off",
  mapDirectory: ["Download"],
};
let addedHtml;
const testNonPlayersTeam = /((computer)|(creeps)|(summoned))/i;
const testSpecTeam = /((host)|(spectator)|(observer))/i;
const testSlotAvailable = /Slot \d+ (Open Slot|Closed)/i;
const testSlotOpen = /Open/i;
const testComputer = /(Computer \(\S+\))/i;
const testGameName = / #\d+$/;
const version = "1.5.0";

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
    if (
      !addedHtml &&
      menuState !== "Out of Menus" &&
      menuState !== "Unknown" &&
      menuState !== "In Game" &&
      menuState !== "Loading Game" &&
      webSocket &&
      webSocket.readyState === 1
    ) {
      addedHtml = document.createElement("DIV");
      addedHtml.style.zoom = "1.75";
      addedHtml.innerHTML = `<div class="Primary-Back-Button" style="position:absolute; left:30%"><div class="Primary-Button-Frame-Alternate-B" id="toggleAutoHostButton"><div class="Primary-Button Primary-Button-${
        autoHost.type === "off" ? "Red" : "Green"
      }" id="toggleAutoHostColor"><div class="Primary-Button-Content"><div>Toggle Auto Host ${
        autoHost.type === "off" ? "On" : "Off"
      }</div></div></div></div></div>`;
      document.getElementById("root").appendChild(addedHtml);
      document
        .getElementById("toggleAutoHostButton")
        .addEventListener("click", function (event) {
          sendSocket("toggleAutoHost");
        });
    }
    sendSocket("info", websocketLocation);
    sendSocket("info", "Connected. Hello! I am version: " + version);
    sendSocket("menusChange", menuState);
    if (lobby && Object.keys(lobby).length > 0) {
      sendSocket("lobbyData", lobby);
    }
  };
  webSocket.onclose = function (event) {
    if (addedHtml) {
      addedHtml.remove();
      addedHtml = null;
    }
    window.setTimeout(wsSetup, 5000);
  };
  webSocket.onmessage = function (event) {
    const data = JSON.parse(event.data);

    switch (data.messageType) {
      case "doneTyping":
        typingGameName = false;
        setTimeout(createLobby, 250);
        break;
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
        if (autoHost.type !== "off") {
          navigateMenus();
        }
        let buttonColor = document.getElementById("toggleAutoHostColor");
        buttonColor.classList.toggle("Primary-Button-Red");
        buttonColor.classList.toggle("Primary-Button-Green");
        buttonColor.querySelector(
          "div:not([class]), div[class='']"
        ).innerHTML = `Toggle Auto Host ${
          autoHost.type === "off" ? "On" : "Off"
        }`;
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
    } else if (document.querySelector("div.LoadingScreen")) {
      newMenuState = "Loading Game";
    } else {
      sendSocket(
        "info",
        "Unknown state" // + document.querySelector("div").innerHTML
      );
      newMenuState = "Unknown";
    }
    if (newMenuState !== menuState) {
      if (menuState === "Loading Game" && newMenuState === "Out of Menus") {
        menuState = "In Game";
      } else {
        menuState = newMenuState;
      }
      if (
        !addedHtml &&
        menuState !== "Out of Menus" &&
        menuState !== "Unknown" &&
        menuState !== "In Game" &&
        menuState !== "Loading Game" &&
        webSocket &&
        webSocket.readyState === 1
      ) {
        addedHtml = document.createElement("DIV");
        addedHtml.style.zoom = "1.75";
        addedHtml.innerHTML = `<div class="Primary-Back-Button" style="position:absolute; left:30%"><div class="Primary-Button-Frame-Alternate-B" id="toggleAutoHostButton"><div class="Primary-Button Primary-Button-${
          autoHost.type === "off" ? "Red" : "Green"
        }" id="toggleAutoHostColor"><div class="Primary-Button-Content"><div>Toggle Auto Host ${
          autoHost.type === "off" ? "On" : "Off"
        }</div></div></div></div></div>`;
        document.getElementById("root").appendChild(addedHtml);
        document
          .getElementById("toggleAutoHostButton")
          .addEventListener("click", function (event) {
            sendSocket("toggleAutoHost");
          });
      } else if (addedHtml && menuState === "Loading Game") {
        addedHtml.remove();
        addedHtml = null;
      }
      sendSocket("menusChange", menuState);
      if (autoHost.type !== "off") {
        navigateMenus(menuState);
      }

      if (menuState === "In Lobby") {
        getLobbyHelper();
        try {
          document
            .querySelectorAll("div.GameLobby-PlayerRow-Container")
            .forEach(function (element) {
              lobbyObserver.observe(element, {
                attributes: true,
                childList: true,
                subtree: true,
              });
            });
        } catch (e) {
          sendSocket("error", e.message + "\n" + e.stack);
        }
        if (autoHost.type == "ghostHost") {
          moveInLobby();
        }
      } else {
        typingGameName = false;
        lobby = {};
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

function handleLobby(mutationsList, menusObserver) {
  if (menuState === "In Lobby") {
    let newLobbyData = getLobbyData();
    if (newLobbyData) {
      if (JSON.stringify(newLobbyData) !== JSON.stringify(lobby.lobbyData)) {
        lobby.lobbyData = newLobbyData;
        sendSocket("lobbyUpdate", lobby.lobbyData);
      } else {
        // Run it one more time just to double check
        setTimeout(function () {
          if (menuState === "In Lobby") {
            newLobbyData = getLobbyData();
            if (
              JSON.stringify(newLobbyData) !== JSON.stringify(lobby.lobbyData)
            ) {
              lobby.lobbyData = newLobbyData;
              sendSocket("lobbyUpdate", lobby.lobbyData);
            }
          }
        }, 250);
      }
    } else {
      setTimeout(handleLobby, 250);
      sendSocket("error", e.message + "\n" + e.stack);
    }
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
      if (
        lobby.lobbyData &&
        Object.keys(lobby.lobbyData.teamList.specTeams).length > 0
      ) {
        Object.keys(lobby.lobbyData.teamList.specTeams).some(function (
          teamName
        ) {
          if (lobby.lobbyData.teamList.specTeams[teamName].openSlots > 0) {
            const teamContainers = document.querySelectorAll(
              "div.TeamContainer-Name"
            );
            return Array.from(teamContainers).some((teamNameDiv) => {
              if (
                teamNameDiv.innerText
                  .toLowerCase()
                  .replace(/(\r\n|\n|\r)/gm, "") === teamName.toLowerCase()
              ) {
                sendSocket(
                  "info",
                  "Joining spec/host: " + teamNameDiv.innerText
                );
                setTimeout(function () {
                  teamNameDiv.click();
                }, 250);
                return true;
              }
            });
          }
        });
      }
    } catch (err) {
      sendSocket("error", ["moveInLobby", err.message, err.stack]);
    }
  }
}

function clickStart() {
  try {
    const element = document.querySelector(
      "div.Primary-Button.Primary-Button-Green"
    );
    if (element) {
      element.firstChild.firstChild.click();
    }
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
  if (menuState === "Creating Game" && autoHost.type !== "off") {
    try {
      const isIncorrectMap =
        document.querySelector("div.CreateGameMenu-MapDetails-MapName") &&
        document
          .querySelector("div.CreateGameMenu-MapDetails-MapName")
          .innerText.replace(/(\r\n|\n|\r)/gm, "")
          .toLowerCase() !== autoHost.mapName.toLowerCase();

      const isGameNameEmpty =
        document.querySelector("div.CreateGameMenu-GameName input") &&
        document.querySelector("div.CreateGameMenu-GameName input").value ===
          "";
      const createButtonDisabled =
        document.querySelector("div.CreateGameMenu-CreateButton-Holder") &&
        document
          .querySelector("div.CreateGameMenu-CreateButton-Holder")
          .classList.contains("disabled");

      if (autoHost.increment) {
        var re = new RegExp("^" + autoHost.gameName + "( #\\d*)$", "g");
      } else {
        var re = new RegExp("^" + autoHost.gameName + "$", "g");
      }
      const isValidGameName = document
        .querySelector("div.CreateGameMenu-GameName input")
        .value.match(re);
      if (
        autoHost.private &&
        document.querySelector("div.CreateGameMenu-PrivateIcon")
      ) {
        document.querySelector("div.CreateGameMenu-PrivateIcon").click();
      } else if (
        !autoHost.private &&
        document.querySelector("div.CreateGameMenu-PublicIcon")
      ) {
        document.querySelector("div.CreateGameMenu-PublicIcon").click();
      }
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
      if (isGameNameEmpty && !typingGameName) {
        document.querySelector("div.CreateGameMenu-GameName input").focus();
        typingGameName = true;
        sendSocket("typeGameName");
        return;
      } else if (!isValidGameName && !typingGameName) {
        sendSocket("info", "Invalid game name. Typing:" + typingGameName);
      }
      // If the map name is correct, input field is set to the correct game name, and create lobby is enabled, click create game
      if (
        document.querySelector(
          "div.CreateGameMenu-CreateButton-Holder div.Primary-Button-Content"
        ) &&
        !isIncorrectMap &&
        !isGameNameEmpty &&
        isValidGameName &&
        !createButtonDisabled
      ) {
        sendSocket("info", "Clicking Create Lobby");
        document
          .querySelector(
            "div.CreateGameMenu-CreateButton-Holder div.Primary-Button-Content"
          )
          .click();
      } else {
        setTimeout(createLobby, 500);
      }
    } catch (e) {
      setTimeout(createLobby, 500);
      sendSocket("error", ["createLobby", e.message + "\n" + e.stack]);
    }
  }
}

function getLobbyHelper() {
  if (menuState === "In Lobby") {
    lobby.mapData = getMapData();
    if (!lobby.mapData) {
      sendSocket("info", "No map data");
      setTimeout(getLobbyHelper, 500);
      return;
    }
    lobby.lobbyData = getLobbyData();
    if (!lobby.lobbyData) {
      sendSocket("info", "No lobby data");
      setTimeout(getLobbyHelper, 500);
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
  if (document.querySelectorAll("div.TeamContainer")) {
    try {
      let teamList = { playerTeams: {}, otherTeams: {}, specTeams: {} };
      let allPlayers = [];
      let openPlayerSlots = 0;
      let countPlayers = false;
      try {
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
            if (
              container.querySelectorAll("div.GameLobby-PlayerRow-Container")
                .length === 0
            ) {
              throw new Error("No players found");
            }
            container
              .querySelectorAll("div.GameLobby-PlayerRow-Container")
              .forEach(function (playerRow) {
                if (playerRow.querySelector("div.GameLobby-EmptyRow") == null) {
                  const playerName =
                    playerRow.querySelector("div.nameTag").innerText;
                  teamPointer.slots.push(playerName);
                  if (playerName === "") {
                    throw new Error("Player name is empty");
                  }
                  if (!testComputer.test(playerName)) {
                    teamPointer.players.push(playerName);
                    if (countPlayers) {
                      allPlayers.push(playerName);
                    }
                  } else {
                    teamPointer.computers++;
                  }
                } else if (
                  (lobby.mapData.isHost &&
                    playerRow.querySelector(
                      "div:not([class]), div[class='']"
                    )) ||
                  (!lobby.mapData.isHost &&
                    playerRow.querySelector(
                      "div[class='GameLobby-EmptyRow-Button']"
                    ))
                ) {
                  let slotElement = lobby.mapData.isHost
                    ? playerRow.querySelector("div:not([class]), div[class='']")
                    : playerRow.querySelector(
                        "div[class='GameLobby-EmptyRow-Button']"
                      );
                  const slotTitle = slotElement.innerText.replace(
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
                } else {
                  throw new Error(teamName + " player row is empty");
                }
              });
          });
      } catch (e) {
        sendSocket("info", e.message);
        return false;
      }

      return {
        openPlayerSlots: openPlayerSlots,
        allPlayers: allPlayers,
        teamList: teamList,
      };
    } catch (e) {
      sendSocket("error", e.message + "\n" + e.stack);
      return false;
    }
  } else {
    return false;
  }
}

function sendSocket(messageType = "info", data = "") {
  webSocket.send(JSON.stringify({ messageType: messageType, data: data }));
}

mutationsSetup();

wsSetup();

function navigateMenus() {
  switch (menuState) {
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
