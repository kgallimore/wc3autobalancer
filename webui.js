let webSocket;

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
          let teamList = {};

          document
            .querySelectorAll("div.TeamContainer")
            .forEach(function (container) {
              const teamName =
                container.querySelector("div.TeamContainer-Name").innerText ||
                "Team " + (Object.keys(teamList).length + 1).toString();
              teamList[teamName] = [];
              container
                .querySelectorAll("div.GameLobby-PlayerRow-Container")
                .forEach(function (playerRow) {
                  if (
                    playerRow.querySelector("div.GameLobby-EmptyRow") == null
                  ) {
                    const playerName =
                      playerRow.querySelector("div.nameTag").innerText;
                    teamList[teamName].push(playerName);
                  } else {
                    teamList[teamName].push(
                      "Slot " +
                        (teamList[teamName].length + 1).toString() +
                        " Open"
                    );
                  }
                });
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
          webSocket.send(JSON.stringify({ messageType: "error", data: e }));
        }

        break;
      case "page":
        webSocket.send(
          JSON.stringify({
            messageType: "body",
            data: document.getElementsByTagName("body")[0].innerHTML,
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

wsSetup();
