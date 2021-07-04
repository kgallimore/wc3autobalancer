let webSocket, menusObserver;
let menuState = "None";
const testNonPLayersTeam = new RegExp(
  /.*((computer)|(host)|(spectator)|(creep)).*/i
);
function wsSetup() {
  webSocket = new WebSocket("ws://127.0.0.1:8888");
  webSocket.onopen = function (event) {
    /*document.body.addEventListener(
      "click",
      function (event) {
        webSocket.send(
          JSON.stringify({
            messageType: "info",
            data: { click: event.target || event.srcElement },
          })
        );
      },
      true
    );*/
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
            document.querySelector("div.Primary-Button.Primary-Button-Green") !=
            null;
          let teamList = { playerTeams: {}, otherTeams: {} };

          document
            .querySelectorAll("div.TeamContainer")
            .forEach(function (container) {
              const teamName =
                container.querySelector("div.TeamContainer-Name").innerText ||
                "Team " + (Object.keys(teamList).length + 1).toString();
              if (!testNonPLayersTeam.test(teamName)) {
                teamList.playerTeams[teamName] = [];

                container
                  .querySelectorAll("div.GameLobby-PlayerRow-Container")
                  .forEach(function (playerRow) {
                    if (
                      playerRow.querySelector("div.GameLobby-EmptyRow") == null
                    ) {
                      const playerName =
                        playerRow.querySelector("div.nameTag").innerText;
                      teamList.playerTeams[teamName].push(playerName);
                    } else {
                      teamList.playerTeams[teamName].push(
                        "Slot " +
                          (
                            teamList.playerTeams[teamName].length + 1
                          ).toString() +
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
                    if (
                      playerRow.querySelector("div.GameLobby-EmptyRow") == null
                    ) {
                      const playerName =
                        playerRow.querySelector("div.nameTag").innerText;
                      teamList.otherTeams[teamName].push(playerName);
                    } else {
                      teamList.otherTeams[teamName].push(
                        "Slot " +
                          (
                            teamList.otherTeams[teamName].length + 1
                          ).toString() +
                          " " +
                          playerRow.innerText.replace(/(\r\n|\n|\r)/gm, "")
                      );
                    }
                  });
              }
            });
          let lobbydata = {
            mapName: mapName,
            mapAuthor: mapAuthor,
            mapPlayerSize: mapPlayerSize,
            gameName: gameName,
            gameHost: gameHost,
            isHost: isHost,
            playerCount: playerCount,
            teamList: teamList,
          };
          webSocket.send(
            JSON.stringify({ messageType: "lobbydata", data: lobbydata })
          );
        } catch (e) {
          webSocket.send(
            JSON.stringify({ messageType: "error", data: e.message })
          );
        }

        break;
      case "page":
        webSocket.send(
          JSON.stringify({
            messageType: "body",
            //data: document.getElementsByTagName("body")[0].innerHTML,
            data: document.getElementById("root").innerHTML,
          })
        );
        break;
      case "start":
        webSocket.send(
          JSON.stringify({
            messageType: "info",
            data: "start",
          })
        );
        try {
          const element = document.querySelector(
            "div.Primary-Button.Primary-Button-Green"
          ).firstChild.firstChild;
          webSocket.send(
            JSON.stringify({
              messageType: "info",
              data: element,
            })
          );
          element.click();
        } catch (e) {
          webSocket.send(
            JSON.stringify({
              messageType: "error",
              data: e.message,
            })
          );
        }
        break;
      case "getElementPos":
        try {
          var rect = document.querySelector(data.data).getBoundingClientRect();
          webSocket.send(
            JSON.stringify({
              messageType: "info",
              data: {
                rectangle: [rect.top, rect.right, rect.bottom, rect.left],
              },
            })
          );
        } catch (e) {
          webSocket.send(
            JSON.stringify({
              messageType: "error",
              data: e.message,
            })
          );
        }
        break;
      case "sendChat":
        document.getElementById("chatPanelInput").focus();
        webSocket.send(
          JSON.stringify({
            messageType: "chatReady",
          })
        );
        /*try {
          const chat = document.getElementById("chatPanelInput");
          chat.value = "hey!";
          const ke = new KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            keyCode: 13,
          });
          document.body.dispatchEvent(ke);
        } catch (e) {
          webSocket.send(
            JSON.stringify({
              messageType: "error",
              data: e.message,
            })
          );
        }*/

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
    } else if (document.getElementById("root").innerText === "") {
      newMenuState = "None";
    } else if (document.querySelector("div.TeamContainer")) {
      newMenuState = "In Lobby";
    }
    if (newMenuState !== menuState) {
      menuState = newMenuState;
      if (webSocket) {
        webSocket.send(
          JSON.stringify({
            messageType: "info",
            data: menuState,
          })
        );
      }
    }
  };
  menusObserver = new MutationmenusObserver(menusObserverCallback);
  menusObserver.observe(document.getElementById("root"), {
    attributes: false,
    childList: true,
    subtree: true,
  });
}

mutationsSetup();

wsSetup();
