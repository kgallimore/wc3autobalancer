const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  webContents,
  ipcMain,
  ipcRenderer,
  globalShortcut,
  Notification,
} = require("electron");
require = require("esm")(module);
const { Combination } = require("js-combinatorics");
var robot = require("robotjs");
const https = require("https");
const WebSocket = require("ws");
const path = require("path");
const Store = require("electron-store");
const wss = new WebSocket.Server({ port: 8888 });

const testNonUserRegex = new RegExp("(Slot \\d+ Open)|(Computer \\(\\S+\\))");

var win;
var appIcon;
var socket = null;

wss.on("connection", function connection(ws) {
  socket = ws;
  win.webContents.send("fromMain", {
    messageType: "statusChange",
    data: "connected",
  });
  ws.on("message", handleWSMessage);
  ws.on("close", function close() {
    socket = null;
    sendProgress();
    win.webContents.send("fromMain", {
      messageType: "statusChange",
      data: "disconnected",
    });
  });
});

ipcMain.on("toMain", (event, args) => {
  switch (args) {
    case "getLobby":
    case "getPage":
    case "start":
    case "refresh":
    case "sendChat":
      if (socket) {
        socket.send(JSON.stringify({ messageType: args }));
      }
      break;
    case "getElementPos":
      if (socket) {
        socket.send(
          JSON.stringify({
            messageType: "getElementPos",
            data: "div.Primary-Button.Primary-Button-Green",
          })
        );
      }
      break;
    default:
      if (socket) {
        socket.send(JSON.stringify({ messageType: "lobby" }));
      }
  }
});

const createWindow = () => {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(__dirname, "scale.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });
  //win.setMenuBarVisibility(false);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show App",
      click: function () {
        appIcon.destroy();
        appIcon = null;
        win.show();
      },
    },
    {
      label: "Quit",
      click: function () {
        app.isQuiting = true;
        app.quit();
      },
    },
  ]);
  win.on("minimize", function (event) {
    event.preventDefault();
    appIcon = new Tray(path.join(__dirname, "scale.png"));

    appIcon.setContextMenu(contextMenu);

    new Notification({
      title: "Still Running",
      body: "WC3 Auto Balancer will keep running in your taskbar",
    }).show();
    win.hide();
  });
  win.loadFile(path.join(__dirname, "index.html"));
};

app.on("ready", function () {
  globalShortcut.register("Alt+CommandOrControl+I", () => {
    if (socket) {
      socket.send(JSON.stringify({ messageType: "lobby" }));
    }
  });
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

function sendProgress(step = "Nothing", progress = 0) {
  win.webContents.send("fromMain", {
    messageType: "processing",
    data: { step: step, progress: progress },
  });
}

function handleWSMessage(message) {
  message = JSON.parse(message);
  switch (message.messageType) {
    case "info":
      console.log(message);
      break;
    case "lobbydata":
      sendProgress("Grabbed Lobby", 10);
      socket.send(JSON.stringify({ messageType: "sendChat" }));
      processLobby(message.data);
      break;
    case "error":
      console.log(message);
      win.webContents.send("fromMain", message);
      break;
    case "body":
      console.log(message.data);
      break;
    case "echo":
      console.log(message);
      break;
    case "chatReady":
      robot.typeStringDelayed("Please wait while I lookup your ELOs", 10000);
      robot.keyTap("enter");
    default:
      console.log(message);
  }
}

function processLobby(list) {
  const excludeHostFromSwap = true;
  list.eloList = {};
  let mapName = list.mapName;
  if (mapName.includes("HLW")) {
    mapName = "HLW";
  } else {
    mapName = list.mapName.trim().replace(/\s/g, "%20");
  }
  let realUserCount = 0;
  Object.keys(list.teamList).forEach(function (key) {
    list.teamList[key].forEach(function (user) {
      if (!testNonUserRegex.test(user.trim())) {
        if (!("team1" in list)) {
          list.team1 = key;
        } else if (!("team2" in list) && key !== list.team1) {
          list.team2 = key;
        }
        realUserCount++;
        https
          .get(
            `https://api.wc3stats.com/leaderboard&map=${mapName}&search=${user
              .trim()
              .replace(/\s/g, "%20")}`,
            (resp) => {
              let datachunks = "";

              // A chunk of data has been received.
              resp.on("data", (chunk) => {
                datachunks += chunk;
              });

              // The whole response has been received. Print out the result.
              resp.on("end", () => {
                const jsonData = JSON.parse(datachunks);
                let elo = 500;
                if (jsonData.body.length > 0) {
                  elo = jsonData.body[0].rating;
                }
                list.eloList[user] = elo;
                sendProgress(
                  "Got ELO for " + user,
                  realUserCount / Object.keys(list.eloList).length - 10
                );
                robot.typeStringDelayed(
                  user + " ELO: " + elo.toString(),
                  10000
                );
                robot.keyTap("enter");
                if (Object.keys(list.eloList).length === realUserCount) {
                  list.totalElo = Object.values(list.eloList).reduce(
                    (a, b) => a + b,
                    0
                  );
                  let smallestEloDiff = Number.POSITIVE_INFINITY;
                  let bestCombo = [];
                  const combos = new Combination(
                    Object.keys(list.eloList),
                    Math.floor(Object.keys(list.eloList).length / 2)
                  );
                  for (const combo of combos) {
                    const comboElo = combo.reduce(
                      (a, b) => a + parseInt(list.eloList[b]),
                      0
                    );
                    const eloDiff = Math.abs(list.totalElo / 2 - comboElo);
                    if (eloDiff < smallestEloDiff) {
                      smallestEloDiff = eloDiff;
                      bestCombo = combo;
                    }
                  }
                  list.bestCombo = bestCombo;
                  list.eloDiff = smallestEloDiff;
                  swapHelper(list);

                  win.webContents.send("fromMain", {
                    messageType: "lobbyElo",
                    eloList: list,
                  });
                  console.log(list);
                  if (!list.isHost) {
                    robot.typeStringDelayed(
                      list.leastSwap + " should be: " + bestCombo.join(", "),
                      10000
                    );
                    robot.keyTap("enter");
                  } else {
                    for (let i = 0; i < list.swaps[0].length; i++) {
                      robot.typeStringDelayed(
                        "!swap " + list.swaps[0][i] + " " + list.swaps[1][i],
                        10000
                      );
                      robot.keyTap("enter");
                      robot.keyTap("enter");
                    }
                  }
                }
              });
            }
          )
          .on("error", (err) => {
            console.log("Error: " + err.message);
          });
      }
    });
  });
}

function swapHelper(list) {
  // TODO this was done very late at night and seems to be super inconsistent
  let swapsFromTeam1 = [];
  let swapsFromTeam2 = [];
  excludeHostFromSwap = true;
  const bestComboInTeam1 = intersect(list.bestCombo, list.teamList[list.team1]);
  const bestComboInTeam2 = intersect(list.bestCombo, list.teamList[list.team2]);
  if (
    bestComboInTeam1.length > bestComboInTeam2.length &&
    excludeHostFromSwap &&
    list.teamList[list.team1].includes(list.gameHost)
  ) {
    list.leastSwap = list.team1;
    list.teamList[list.team1].forEach((user) => {
      if (!list.bestCombo.includes(user)) {
        swapsFromTeam1.push(user);
      }
    });
    bestComboInTeam2.forEach(function (user) {
      swapsFromTeam2.push(user);
    });
  } else {
    list.leastSwap = list.team2;
    list.teamList[list.team2].forEach((user) => {
      if (!list.bestCombo.includes(user)) {
        swapsFromTeam2.push(user);
      }
    });
    bestComboInTeam1.forEach(function (user) {
      swapsFromTeam1.push(user);
    });
  }
  list.swaps = [swapsFromTeam1, swapsFromTeam2];
}

function intersect(a, b) {
  var setB = new Set(b);
  return [...new Set(a)].filter((x) => setB.has(x));
}
