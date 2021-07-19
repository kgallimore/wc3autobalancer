const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  webContents,
  ipcMain,
  ipcRenderer,
  globalShortcut,
  clipboard,
  dialog,
  shell,
  Notification,
} = require("electron");
require = require("esm")(module);
const { Combination } = require("js-combinatorics");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");
const https = require("https");
const WebSocket = require("ws");
const path = require("path");
const Store = require("electron-store");
const wss = new WebSocket.Server({ port: 8888 });
const { keyboard, screen, getActiveWindow, Key } = require("@nut-tree/nut-js");
const cv = require("opencv4nodejs-prebuilt");
const robot = require("robotjs");
const Jimp = require("jimp");
const sound = require("sound-play");

const store = new Store();

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";

log.info("App starting...");

const excludeHostFromSwap = true;

var win;
var appIcon;
var socket = null;
var currentStatus = "Waiting For Connection";
var gameNumber = 0;
var lobby = {};
var warcraftInFocus = true;
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
  mapDirectory: store.get("autoHost.mapDirectory") || ["Download"],
};
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
    case "openLogs":
      shell.openPath(log.transports.file.getFile().path);
      break;
    case "getMapDirectory":
      dialog
        .showOpenDialog(win, {
          title: "Choose Map Directory",
          defaultPath: `${app.getPath("home")}\\Documents\\Warcraft III\\Maps`,
          properties: ["openDirectory"],
        })
        .then((result) => {
          if (!result.canceled) {
            let mapDir = result.filePaths[0].split(/maps/i);
            mapDir = mapDir[mapDir.length - 1].split("\\").filter(Boolean);
            log.info(`Change map directory to ${mapDir.join("\\")}`);
            autoHost.mapDirectory = mapDir;
            store.set("autoHost.mapDirectory", mapDir);
            sendWindow("gotMapDirectory", autoHost.mapDirectory);
          }
        })
        .catch((err) => {
          log.error(err.message, err.stack);
        });
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
      log.info("autoHost", args.data);
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
  new Notification({
    title: "Update Error",
    body: "There was an error with the auto updater!",
  }).show();
  log.error(err);
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
    width: 600,
    height: 800,
    show: false,
    icon: path.join(__dirname, "images/scale.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });
  win.setMenuBarVisibility(false);

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
        app.isQuitting = true;
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
    appIcon = new Tray(path.join(__dirname, "images/scale.png"));

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
  setupMats();
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
  //autoUpdater.checkForUpdatesAndNotify();
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
    case "typeGameName":
      gameNumber += 1;
      if (autoHost.increment) {
        typeText(autoHost.gameName + " #" + gameNumber.toString(), true);
      } else {
        typeText(autoHost.gameName, true);
      }
      /*robot.typeStringDelayed(
        autoHost.gameName + " #" + gameNumber.toString(),
        10000
      );
      robot.keyTap("enter");*/
      break;
    case "info":
      log.info(JSON.stringify(message.data));
      break;
    case "menusChange":
      menuState = message.data;
      sendWindow(message.messageType, message.data);
      log.verbose(message);
      break;
    case "lobbyData":
      // Flush any previous lobbies
      lobby = {};
      sendProgress("Grabbed Lobby", 10);
      processMapData(message.data);
      break;
    case "lobbyUpdate":
      log.verbose("Lobby update:\n" + JSON.stringify(message.data));
      processLobby(message.data);
      break;
    case "error":
      log.error(message);
      win.webContents.send("fromMain", message);
      break;
    case "body":
      log.verbose(message.data);
      break;
    case "echo":
      log.verbose(message);
      break;
    default:
      log.info(message);
  }
}

function processMapData(lobbyData) {
  if (menuState === "In Lobby") {
    lobby.mapData = lobbyData.mapData;
    const mapName = lobby.mapData.mapName;
    if (!lobby.eloMapName) {
      if (lobby.mapData.mapName.match(/(HLW)/i)) {
        lobby.eloMapName = "HLW";
      } else {
        lobby.eloMapName = mapName
          .trim()
          .replace(/\s*v?\.?(\d+\.)?(\*|\d+)\w*\s*$/gi, "")
          .replace(/\s/g, "%20");
      }
    }
    if (autoHost.eloLookup === "wc3stats") {
      https
        .get(`https://api.wc3stats.com/maps/${lobby.eloMapName}`, (resp) => {
          let dataChunks = "";
          // A chunk of data has been received.
          resp.on("data", (chunk) => {
            dataChunks += chunk;
          });
          // The whole response has been received. Print out the result.
          resp.on("end", () => {
            const jsonData = JSON.parse(dataChunks);
            lobby.eloAvailable = jsonData.status === "OK";
            lobby.eloList = {};
            lobby.lookingUpELO = new Set();
            sendWindow("lobbyData", lobby);
            processLobby(lobbyData.lobbyData);
            // TODO check variants, seasons, modes, and ladders
            /*if (lobbyData.eloAvailable) {
            jsonData.body.variants.forEach((variant) => {
              variant.stats.forEach((stats) => {});
            });
          }*/
          });
        })
        .on("error", (err) => {
          log.error("Error: " + err.message);
        });
    }
  }
}
function processLobby(lobbyData) {
  lobby.lobbyData = lobbyData;
  if (lobby.eloAvailable) {
    const mapName = lobby.eloMapName;
    Object.keys(lobby.eloList).forEach((user) => {
      if (!lobby.lobbyData.allPlayers.includes(user)) {
        delete lobby.eloList[user];
      }
      lobby.lookingUpELO.delete(user);
    });
    lobby.lobbyData.allPlayers.forEach(function (user) {
      if (
        !Object.keys(lobby.eloList).includes(user) &&
        !lobby.lookingUpELO.has(user)
      ) {
        lobby.lookingUpELO.add(user);
        if (autoHost.eloLookup === "wc3stats") {
          https
            .get(
              `https://api.wc3stats.com/leaderboard&map=${mapName}&search=${user
                .trim()
                .replace(/\s/g, "%20")}`,
              (resp) => {
                let dataChunks = "";
                resp.on("data", (chunk) => {
                  dataChunks += chunk;
                });
                // The whole response has been received. Print out the result.
                resp.on("end", () => {
                  const jsonData = JSON.parse(dataChunks);
                  lobby.lookingUpELO.delete(user);
                  let elo = 500;
                  if (jsonData.body.length > 0) {
                    elo = jsonData.body[0].rating;
                  }
                  // If they haven't left, set real ELO
                  if (lobby.lobbyData.allPlayers.includes(user)) {
                    lobby.eloList[user] = elo;
                    sendProgress(
                      "Got ELO for " + user,
                      (Object.keys(lobby.eloList).length /
                        (lobby.lobbyData.openPlayerSlots +
                          lobby.lobbyData.allPlayers.length)) *
                        90 +
                        10
                    );
                    log.silly(JSON.stringify(lobby));
                    // Send new step to GUI
                    win.webContents.send("fromMain", {
                      messageType: "lobbyUpdate",
                      data: lobby,
                    });
                    sendSocket("sendChat");
                    log.verbose(user + " ELO: " + elo.toString());
                    typeText(user + " ELO: " + elo.toString(), true);
                    log.silly(lobby.lookingUpELO);
                    log.silly(lobby.eloList);
                    // If the lobby is full, and we have the ELO for everyone,
                    if (
                      lobby.lobbyData.openPlayerSlots === 0 &&
                      Object.keys(lobby.eloList).length ===
                        lobby.lobbyData.allPlayers.length
                    ) {
                      finalizeLobby();
                    }
                  } else {
                    log.verbose(user + " left before ELO was found");
                  }
                });
              }
            )
            .on("error", (err) => {
              log.error("Error: " + err.message);
            });
        }
      }
    });
  }
  if (
    (lobby.eloAvailable &&
      lobby.lobbyData.openPlayerSlots === 0 &&
      Object.keys(lobby.eloList).length ===
        lobby.lobbyData.allPlayers.length) ||
    (!lobby.eloAvailable && lobby.lobbyData.openPlayerSlots === 0)
  ) {
    finalizeLobby();
  }
  sendWindow("lobbyUpdate", lobby);
}
function finalizeLobby() {
  if (lobby.eloAvailable) {
    lobby.totalElo = Object.values(lobby.eloList).reduce((a, b) => a + b, 0);
    let smallestEloDiff = Number.POSITIVE_INFINITY;
    let bestCombo = [];
    const combos = new Combination(
      Object.keys(lobby.eloList),
      Math.floor(Object.keys(lobby.eloList).length / 2)
    );
    for (const combo of combos) {
      const comboElo = combo.reduce(
        (a, b) => a + parseInt(lobby.eloList[b]),
        0
      );
      const eloDiff = Math.abs(lobby.totalElo / 2 - comboElo);
      if (eloDiff < smallestEloDiff) {
        smallestEloDiff = eloDiff;
        bestCombo = combo;
      }
    }
    lobby.bestCombo = bestCombo;
    lobby.eloDiff = smallestEloDiff;
    swapHelper(lobby);
    if (!lobby.mapData.isHost) {
      sendSocket("sendChat");
      typeText(lobby.leastSwap + " should be: " + bestCombo.join(", "), true);
    } else {
      for (let i = 0; i < lobby.swaps[0].length; i++) {
        sendSocket("sendChat");
        typeText("!swap " + lobby.swaps[0][i] + " " + lobby.swaps[1][i], true);
      }
    }
  }
  if (lobby.mapData.isHost && autoHost.type === "ghostHost") {
    if (autoHost.sounds) {
      playSound("ready.wav");
    }
    log.info("Starting game");
    socket.send(JSON.stringify({ messageType: "start" }));
    setTimeout(tempFindQuit, 60000);
  }
}

async function findQuit() {
  if (menuState === "In Game") {
    await activeWindowWar();
    if (warcraftInFocus) {
      if (await screen.find("images/quitHLW.png")) {
        log.verbose("Found quit. Press q");
        await keyboard.type("q");
        if (autoHost.sounds) {
          playSound("quit.wav");
        }
      } else if (await screen.find("quitNormal.png")) {
        log.verbose("Found quit. Press q");
        await keyboard.type("q");
        if (autoHost.sounds) {
          playSound("quit.wav");
        }
      } else {
        log.verbose("Did not find quit, try again in 5 seconds");
      }
    }
    setTimeout(findQuit, 5000);
  }
}

function swapHelper(lobbyData) {
  let swapsFromTeam1 = [];
  let swapsFromTeam2 = [];
  const team1 = Object.keys(lobbyData.lobbyData.teamList.playerTeams)[0];
  const team2 = Object.keys(lobbyData.lobbyData.teamList.playerTeams)[1];
  const bestComboInTeam1 = intersect(
    lobbyData.bestCombo,

    lobbyData.lobbyData.teamList.playerTeams[team1].players
  );
  const bestComboInTeam2 = intersect(
    lobbyData.bestCombo,
    lobbyData.lobbyData.teamList.playerTeams[team2].players
  );
  log.verbose(bestComboInTeam1, bestComboInTeam2);
  // If not excludeHostFromSwap and team1 has more best combo people, or excludeHostFromSwap and the best combo includes the host keep all best combo players in team 1.
  if (
    (!excludeHostFromSwap &&
      bestComboInTeam1.length >= bestComboInTeam2.length) ||
    (excludeHostFromSwap &&
      lobbyData.bestCombo.includes(lobbyData.mapData.gameHost))
  ) {
    lobbyData.leastSwap = team1;
    // Go through team 1 and grab everyone who is not in the best combo

    lobbyData.lobbyData.teamList.playerTeams[team1].players.forEach((user) => {
      if (!lobbyData.bestCombo.includes(user)) {
        swapsFromTeam1.push(user);
      }
    });
    // Go through team 2 and grab everyone who is in the best combo

    bestComboInTeam2.forEach(function (user) {
      swapsFromTeam2.push(user);
    });
  } else {
    lobbyData.leastSwap = team2;
    lobbyData.lobbyData.teamList.playerTeams[team2].players.forEach((user) => {
      if (!lobbyData.bestCombo.includes(user)) {
        swapsFromTeam2.push(user);
      }
    });
    bestComboInTeam1.forEach(function (user) {
      swapsFromTeam1.push(user);
    });
  }
  lobbyData.swaps = [swapsFromTeam1, swapsFromTeam2];
}

function intersect(a, b) {
  var setB = new Set(b);
  return [...new Set(a)].filter((x) => setB.has(x));
}

function sendWindow(messageType, message) {
  win.webContents.send("fromMain", {
    messageType: messageType,
    data: message,
  });
}
function sendSocket(messageType = "info", data = "none") {
  if (socket) {
    socket.send(JSON.stringify({ messageType: messageType, data: data }));
  }
}

async function activeWindowWar() {
  let activeWindow = await getActiveWindow();
  let title = await activeWindow.title;
  const focused = title === "Warcraft III";
  // Ensure that a notification is only sent the first time, if warcraft was focused before, but is no longer
  if (!focused && warcraftInFocus) {
    new Notification({
      title: "Warcraft is not in focus",
      body: "An action was attempted but Warcraft was not in focus",
    }).show();
  }
  warcraftInFocus = focused;
}
async function typeText(text, hitEnter = false) {
  if (socket) {
    await activeWindowWar();
    if (warcraftInFocus) {
      let oldClipboard = clipboard.readText();
      if (hitEnter) {
        await keyboard.type(Key.Enter);
      }
      clipboard.writeText(text);
      keyboard
        .pressKey(Key.LeftControl, Key.V)
        .then(keyboard.releaseKey(Key.LeftControl, Key.V))
        .then(async () => {
          clipboard.writeText(oldClipboard);
        })
        .then(async () => {
          if (hitEnter) {
            await keyboard.type(Key.Enter);
          }
        })
        .catch((err) => {
          log.error(err);
        });
    } else {
      setTimeout(typeText.bind(null, text), 3000);
    }
  }
}

// Everything below is temporary until nut-js fixes the issue with windows scaling
// https://github.com/nut-tree/nut.js/issues/249

let quitHLWMat, quitNormalMat;
async function tempFindQuitHelper(templateMat, targetCoefficient = 0.9) {
  try {
    let pic = robot.screen.capture();
    const image = new Jimp(pic.width, pic.height);
    let pos = 0;
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
      image.bitmap.data[idx + 2] = pic.image.readUInt8(pos++);
      image.bitmap.data[idx + 1] = pic.image.readUInt8(pos++);
      image.bitmap.data[idx + 0] = pic.image.readUInt8(pos++);
      image.bitmap.data[idx + 3] = pic.image.readUInt8(pos++);
    });
    let target;
    if (!app.isPackaged) {
      await image.writeAsync(`${__dirname}\\tempresolve.png`);
      target = await cv.imreadAsync(`${__dirname}\\tempresolve.png`);
    } else {
      await image.writeAsync(`${__dirname}\\..\\..\\tempresolve.png`);
      target = await cv.imreadAsync(`${__dirname}\\..\\..\\tempresolve.png`);
    }
    // Match template (the brightest locations indicate the highest match)
    if (target) {
      const matched = target.matchTemplate(templateMat, 5);
      return matched.minMaxLoc().maxVal >= targetCoefficient;
    } else {
      log.error("No target image?");
      return false;
    }
  } catch (err) {
    log.error(err);
    return false;
  }
}

async function tempFindQuit() {
  if (menuState === "In Game") {
    await activeWindowWar();
    if (warcraftInFocus) {
      log.verbose("Looking for quit");
      const foundQuitHLW = await tempFindQuitHelper(quitHLWMat);
      const foundQuitNormal = await tempFindQuitHelper(quitNormalMat);
      if (foundQuitHLW || foundQuitNormal) {
        log.verbose("Found quit. Press q");
        await keyboard.type("q");
        if (autoHost.sounds) {
          playSound("quit.wav");
        }
      } else {
        log.verbose("Did not find quit, try again in 5 seconds");
      }
    }
    setTimeout(tempFindQuit, 5000);
  }
}

async function setupMats() {
  try {
    if (!app.isPackaged) {
      quitHLWMat = await cv.imreadAsync(`${__dirname}\\images\\quitHLW.png`);
      quitNormalMat = await cv.imreadAsync(
        `${__dirname}\\images\\quitNormal.png`
      );
    } else {
      quitHLWMat = await cv.imreadAsync(
        `${app.getAppPath()}\\..\\..\\images\\quitHLW.png`
      );
      quitNormalMat = await cv.imreadAsync(
        `${app.getAppPath()}\\..\\..\\images\\quitNormal.png`
      );
    }
  } catch (err) {
    log.error("setupMats: " + err);
  }
}

function playSound(file) {
  if (!app.isPackaged) {
    sound.play(path.join(__dirname, "sounds\\" + file));
  } else {
    sound.play(path.join(app.getAppPath(), "\\..\\..\\sounds\\" + file));
  }
}
