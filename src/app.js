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
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");
var robot = require("robotjs");
const https = require("https");
const WebSocket = require("ws");
const path = require("path");
const Store = require("electron-store");
const wss = new WebSocket.Server({ port: 8888 });

const testNonUserRegex = new RegExp(
  /(Slot \d+ (Open Slot|Closed))|(Computer \(\S+\))/i
);
const store = new Store();

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";
log.info("App starting...");

var win;
var appIcon;
var socket = null;
var currentStatus = "Waiting For Connection";
var gameNumber = 0;
var autoHost = store.get("autoHost");
var menuState = "Out of Menus";

wss.on("connection", function connection(ws) {
  log.info("Connection");
  socket = ws;
  sendSocket("autoHost", autoHost);
  sendStatus("connected");
  ws.on("message", handleWSMessage);
  ws.on("close", function close() {
    log.warn("Socket closed");
    socket = null;
    sendProgress();
    sendStatus("disconnected");
  });
});

ipcMain.on("toMain", (event, args) => {
  switch (args.messageType) {
    case "getLobby":
    case "getPage":
    case "start":
    case "refresh":
    case "sendChat":
      if (socket) {
        socket.send(JSON.stringify({ messageType: args }));
      }
      break;
    case "autoHost":
      log.info("Autohost", args.data);
      autoHost = args.data;
      store.set("autoHost", args.data);
      if (socket) {
        socket.send(JSON.stringify(args));
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
      log.info(args);
  }
});

autoUpdater.on("checking-for-update", () => {
  win.webContents.send("fromMain", {
    messageType: "updater",
    data: "Checking for update...",
  });
});
autoUpdater.on("update-available", (info) => {
  new Notification({
    title: "Update Available",
    body: "An update is available!",
  }).show();
  win.webContents.send("fromMain", {
    messageType: "updater",
    data: "Update available.",
  });
});
autoUpdater.on("update-not-available", (info) => {
  win.webContents.send("fromMain", {
    messageType: "updater",
    data: "Update not available.",
  });
});
autoUpdater.on("error", (err) => {
  win.webContents.send("fromMain", {
    messageType: "updater",
    data: "Error in auto-updater. " + err,
  });
});
autoUpdater.on("download-progress", (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + " - Downloaded " + progressObj.percent + "%";
  log_message =
    log_message +
    " (" +
    progressObj.transferred +
    "/" +
    progressObj.total +
    ")";
  win.webContents.send("fromMain", {
    messageType: "updater",
    data: log_message,
  });
});
autoUpdater.on("update-downloaded", (info) => {
  new Notification({
    title: "Update Downloaded",
    body: "The latest version has been downloaded",
  }).show();
  win.webContents.send("fromMain", {
    messageType: "updater",
    data: "Update downloaded",
  });
});

const createWindow = () => {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
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
  win.once("ready-to-show", () => {
    sendStatus(currentStatus);
    win.show();
  });
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
  log.info("App ready");
  globalShortcut.register("Alt+CommandOrControl+I", () => {
    if (socket) {
      socket.send(JSON.stringify({ messageType: "lobby" }));
    }
  });
  globalShortcut.register("Alt+CommandOrControl+S", () => {
    if (socket) {
      socket.send(JSON.stringify({ messageType: "spectate" }));
    }
  });
  globalShortcut.register("Alt+CommandOrControl+P", () => {
    if (socket) {
      socket.send(JSON.stringify({ messageType: "page" }));
    }
  });
  globalShortcut.register("Alt+CommandOrControl+O", () => {
    if (socket) {
      socket.send(JSON.stringify({ messageType: "sendChat" }));
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

function sendStatus(status = "Waiting For Connection") {
  currentStatus = status;
  win.webContents.send("fromMain", {
    messageType: "statusChange",
    data: status,
  });
}

function handleWSMessage(message) {
  message = JSON.parse(message);
  switch (message.messageType) {
    case "robot":
      gameNumber += 1;
      robot.typeStringDelayed(
        autoHost.gameName + " #" + gameNumber.toString(),
        10000
      );
      robot.keyTap("enter");
    case "info":
      log.info(message.data);
      break;
    case "menusChange":
      menuState = message.data;
      sendWindow(message);
      log.info(message);
      break;
    case "lobbydata":
      log.info(message.data);
      sendProgress("Grabbed Lobby", 10);
      socket.send(JSON.stringify({ messageType: "sendChat" }));
      processLobby(message.data);
      break;
    case "error":
      log.error(message);
      win.webContents.send("fromMain", message);
      break;
    case "body":
      log.info(message.data);
      break;
    case "echo":
      log.info(message);
      break;
    case "chatReady":
      robot.typeStringDelayed("Please wait while I lookup your ELOs", 10000);
      robot.keyTap("enter");
    default:
      log.info(message);
  }
}

function processLobby(list) {
  const excludeHostFromSwap = true;
  list.eloList = {};
  let mapName = list.mapName;
  // TODO get api to find variant modes
  if (mapName.includes("HLW")) {
    mapName = "HLW";
  } else {
    mapName = list.mapName.trim().replace(/\s/g, "%20");
  }
  let realUserCount = 0;
  Object.keys(list.teamList.playerTeams).forEach(function (key) {
    list.teamList.playerTeams[key].forEach(function (user) {
      if (!("team1" in list)) {
        list.team1 = key;
      } else if (!("team2" in list) && key !== list.team1) {
        list.team2 = key;
      }
      if (!testNonUserRegex.test(user.trim())) {
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
                  Object.keys(list.eloList).length / realUserCount - 10
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
                  log.info(list);
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
                    if (autoHost.enabled && autoHost.ghostHost) {
                      socket.send(JSON.stringify({ messageType: "start" }));
                      setTimeout(quitEndGame, 60000);
                    }
                  }
                }
              });
            }
          )
          .on("error", (err) => {
            log.error("Error: " + err.message);
          });
      }
    });
  });
}

function quitEndGame() {
  if (menuState === "Out of Menus") {
    robot.keyTap("q");
    setTimeout(quitEndGame, 15000);
  }
}

function swapHelper(list) {
  let swapsFromTeam1 = [];
  let swapsFromTeam2 = [];
  excludeHostFromSwap = true;
  const bestComboInTeam1 = intersect(
    list.bestCombo,
    list.teamList.playerTeams[list.team1]
  );
  const bestComboInTeam2 = intersect(
    list.bestCombo,
    list.teamList.playerTeams[list.team2]
  );
  log.info(bestComboInTeam1, bestComboInTeam2);
  // If not excludeHostFromSwap and team1 has more best combo people, or excludeHostFromSwap and the best combo includes the host keep all best combo players in team 1.
  if (
    (!excludeHostFromSwap &&
      bestComboInTeam1.length >= bestComboInTeam2.length) ||
    (excludeHostFromSwap && list.bestCombo.includes(list.gameHost))
  ) {
    list.leastSwap = list.team1;
    // Go through team 1 and grab everyone who is not in the best combo

    list.teamList.playerTeams[list.team1].forEach((user) => {
      if (!list.bestCombo.includes(user)) {
        swapsFromTeam1.push(user);
      }
    });
    // Go through team 2 and grab everyone who is in the best combo

    bestComboInTeam2.forEach(function (user) {
      swapsFromTeam2.push(user);
    });
  } else {
    list.leastSwap = list.team2;
    // TODO fix crash
    log.info(list.teamList.playerTeams);
    log.info(list.teamList.playerTeams);
    list.teamList.playerTeams[list.team2].forEach((user) => {
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

function sendWindow(message) {
  win.webContents.send("fromMain", message);
}

function sendSocket(messageType = "info", data = "none") {
  if (socket) {
    socket.send(JSON.stringify({ messageType: messageType, data: data }));
  }
}
