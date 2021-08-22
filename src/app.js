const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
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
const { keyboard, screen, getActiveWindow, Key } = require("@nut-tree/nut-js");
const cv = require("opencv4nodejs-prebuilt");
const robot = require("robotjs");
const Jimp = require("jimp");
const sound = require("sound-play");
const { ReplayParser } = require("w3gjs");
const { readFileSync, readdirSync } = require("fs");
/*const Eris = require("eris");

const token = "";

const bot = new Eris(token);
bot.on("ready", () => {
  console.log("Ready!");
  bot.guilds.forEach((guild) => {
    guild.channels.forEach((channel) => {
      console.log(channel.name, channel.type, channel.id);
      if (channel.type === 0) {
        bot.createMessage(channel.id, "I'm ready!");
      }
    });
  });
});
bot.on("messageCreate", (msg) => {
  if (msg.content === "!ping") {
    bot.createMessage(msg.channel.id, "Pong!");
  }
});
bot.connect();*/

const store = new Store();
const parser = new ReplayParser();

// Maybe in the future will switch to tesseract instead of finding an image
/*
const { createWorker } = require("tesseract.js");
const worker = createWorker({
  logger: (m) => console.log(m), // Add logger here
});
(async () => {
  await worker.load();
  await worker.loadLanguage("eng");
  await worker.initialize("eng");
  const {
    data: { text },
  } = await worker.recognize("src\\tempResolve.png");
  console.log(text);
  await worker.terminate();
})();*/
const testFlag = new RegExp(/FlagP \d+ (Loser|Winner)/i);

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";

log.info("App starting...");

var win;
var appIcon;
var socket = null;
var currentStatus = "Waiting For Connection";
var gameNumber = 0;
var lobby = {};
var warcraftInFocus = true;
var menuState = "Out of Menus";
var wss;

// After I stop changing these values around I can just get the whole dict
//var autoHost = store.get("autoHost")
var autoHost = {
  type: store.get("autoHost.type") || "off",
  private: store.get("autoHost.private") || false,
  sounds: store.get("autoHost.sounds") || false,
  increment: store.get("autoHost.increment") || true,
  mapName: store.get("autoHost.mapName") || "",
  gameName: store.get("autoHost.gameName") || "",
  mapDirectory: store.get("autoHost.mapDirectory") || ["Download"],
  announceIsBot: store.get("autoHost.announceIsBot") || false,
};
var obsSettings = {
  type: store.get("obsSettings.type") || "off",
  inGameHotkey: store.get("obsSettings.inGameHotkey") || false,
  outOfGameHotkey: store.get("obsSettings.outOfGameHotkey") || false,
};
var eloSettings = {
  type:
    store.get("eloSettings.type") ?? store.get("autoHost.eloLookup") ?? "off",
  balanceTeams: store.get("eloSettings.balanceTeams") ?? true,
  announceELO: store.get("eloSettings.announceELO") ?? true,
  excludeHostFromSwap:
    store.get("eloSettings.excludeHostFromSwap") ??
    store.get("autoHost.excludeHostFromSwap") ??
    true,
  eloMapName:
    store.get("eloSettings.eloMapName") ??
    store.get("autoHost.eloMapName") ??
    "",
  eloAvailable:
    store.get("eloSettings.eloAvailable") ??
    store.get("autoHost.eloAvailable") ??
    false,
};

keyboard.config.autoDelayMs = 3;

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
    case "updateSettingSingle":
      if (args.data.setting === "autoHost") {
        if (args.data.key === "mapName") {
          autoHost.mapName = args.data.value;
          eloMapNameCheck();
        } else {
          autoHost[args.data.key] = args.data.value;
        }
        sendSocket("autoHost", autoHost);
        store.set("autoHost", autoHost);
      } else if (args.data.setting === "obs") {
        obsSettings[args.data.key] = args.data.value;
        sendSocket("obsSettings", obsSettings);
        sendWindow("obsSettings", obsSettings);
        log.info(obsSettings);
        store.set("obsSettings", obsSettings);
      } else if (args.data.setting === "elo") {
        if (args.data.key === "type" && args.data.value !== "off") {
          eloMapNameCheck();
        }
        eloSettings[args.data.key] = args.data.value;
        sendWindow("eloSettings", eloSettings);
        log.info(eloSettings);
        store.set("eloSettings", eloSettings);
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

function eloMapNameCheck() {
  // Clean the name from the map name
  if (eloSettings.type === "wc3stats") {
    if (autoHost.mapName.match(/(HLW)/i)) {
      eloSettings.eloMapName = "HLW";
      eloSettings.eloAvailable = true;
    } else if (autoHost.mapName.match(/(pyro\s*td\s*league)/i)) {
      eloSettings.eloMapName = "Pyro%20TD";
      eloSettings.eloAvailable = true;
    } else {
      const newName = autoHost.mapName
        .trim()
        .replace(/\s*v?\.?(\d+\.)?(\*|\d+)\w*\s*$/gi, "")
        .replace(/\s/g, "%20");
      if (newName !== eloSettings.eloMapName) {
        eloSettings.eloMapName = newName;
        log.info(
          `Querying wc3stats to see if ELO data is available for: ${eloSettings.eloMapName}`
        );
        log.info(`https://api.wc3stats.com/maps/${eloSettings.eloMapName}`);
        https
          .get(
            `https://api.wc3stats.com/maps/${eloSettings.eloMapName}`,
            (resp) => {
              let dataChunks = "";
              resp.on("data", (chunk) => {
                dataChunks += chunk;
              });
              resp.on("end", () => {
                const jsonData = JSON.parse(dataChunks);
                eloSettings.eloAvailable = jsonData.status === "OK";
                log.info("Elo data available: " + eloSettings.eloAvailable);
                if (!eloSettings.eloAvailable) {
                  sendWindow(
                    "error",
                    "We couldn't find any ELO data for your map. Please raise an issue on <a href='https://github.com/kgallimore/wc3autobalancer/issues/new?title=Map%20Request&body=Map%20Name%3A%0A&labels=Map%20Request' class='alert-link'> Github</a> if you think there should be."
                  );
                }
                // TODO check variants, seasons, modes, and ladders
                /*if (lobbyData.eloAvailable) {
              jsonData.body.variants.forEach((variant) => {
                variant.stats.forEach((stats) => {});
              });
            }*/
              });
            }
          )
          .on("error", (err) => {
            eloSettings.eloAvailable = false;
            log.error("Error: " + err.message);
          });
      }
    }
  }
}

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
    width: 1080,
    height: 800,
    title: "WC3 Auto Balancer v" + app.getVersion(),
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
  wss = new WebSocket.Server({ port: 8888 });
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
  autoUpdater.checkForUpdatesAndNotify();
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

async function triggerOBS() {
  if (obsSettings.type === "hotkeys") {
    if (menuState === "In Game" && obsSettings.inGameHotkey) {
      let modifiers = [];
      if (obsSettings.inGameHotkey.altKey) {
        modifiers.push("alt");
      }
      if (obsSettings.inGameHotkey.ctrlKey) {
        modifiers.push("control");
      }
      if (obsSettings.inGameHotkey.shiftKey) {
        modifiers.push("shift");
      }
      robot.keyTap(obsSettings.inGameHotkey.key, modifiers);
      /*await keyboard.type(
        obsSettings.inGameHotkey.altKey ? Key.LeftAlt : "",
        obsSettings.inGameHotkey.ctrlKey ? Key.LeftControl : "",
        obsSettings.inGameHotkey.shiftKey ? Key.LeftShift : "",
        obsSettings.inGameHotkey.key
      );*/
    } else if (menuState === "Score Screen" && obsSettings.outOfGameHotkey) {
      let modifiers = [];
      if (obsSettings.outOfGameHotkey.altKey) {
        modifiers.push("alt");
      }
      if (obsSettings.outOfGameHotkey.ctrlKey) {
        modifiers.push("control");
      }
      if (obsSettings.outOfGameHotkey.shiftKey) {
        modifiers.push("shift");
      }
      robot.keyTap(obsSettings.outOfGameHotkey.key, modifiers);
      /*await keyboard.type(
        obsSettings.outOfGameHotkey.altKey ? Key.LeftAlt : "",
        obsSettings.outOfGameHotkey.ctrlKey ? Key.LeftControl : "",
        obsSettings.outOfGameHotkey.shiftKey ? Key.LeftShift : "",
        obsSettings.outOfGameHotkey.key
      );*/
    }
  }
}

function sendProgress(step = "Nothing", progress = 0) {
  sendWindow("progress", { step, progress });
}

function sendStatus(status = "Waiting For Connection") {
  currentStatus = status;
  win.webContents.send("fromMain", {
    messageType: "statusChange",
    data: status,
  });
}

async function handleWSMessage(message) {
  message = JSON.parse(message);
  switch (message.messageType) {
    case "toggleAutoHost":
      log.info("Toggling autoHost");
      autoHost.type = autoHost.type === "off" ? "autoHost" : "off";
      store.set("autoHost", autoHost);
      sendSocket("autoHost", autoHost);
      sendWindow("autoHost", autoHost);
    case "typeGameName":
      gameNumber += 1;
      if (autoHost.increment) {
        await typeText(
          autoHost.gameName + " #" + gameNumber.toString(),
          false,
          true
        );
      } else {
        await typeText(autoHost.gameName, false, true);
      }
      break;
    case "info":
      log.info(JSON.stringify(message.data));
      break;
    case "menusChange":
      menuState = message.data;
      sendWindow(message.messageType, message.data);
      triggerOBS();
      log.info(message);
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
    if (eloSettings.type !== "off") {
      lobby.eloList = {};
      lobby.lookingUpELO = new Set();
      const mapName = lobby.mapData.mapName;
      if (autoHost.type === "off") {
        if (!lobby.eloMapName) {
          if (lobby.mapData.mapName.match(/(HLW)/i)) {
            lobby.eloMapName = "HLW";
            lobby.eloAvailable = true;
            log.info("Autohost disabled. HLW Recognized");
          } else if (autoHost.mapName.match(/(pyro\s*td\s*league)/i)) {
            lobby.eloMapName = "Pyro%20TD";
            lobby.eloAvailable = true;
            log.info("Autohost disabled. Pyro TD Recognized");
          } else {
            lobby.eloMapName = mapName
              .trim()
              .replace(/\s*v?\.?(\d+\.)?(\*|\d+)\w*\s*$/gi, "")
              .replace(/\s/g, "%20");
            log.info(
              "Autohost disabled. Unkown Map. Querying: https://api.wc3stats.com/maps/" +
                lobby.eloMapName
            );
            if (eloSettings.type === "wc3stats") {
              https
                .get(
                  `https://api.wc3stats.com/maps/${lobby.eloMapName}`,
                  (resp) => {
                    let dataChunks = "";
                    resp.on("data", (chunk) => {
                      dataChunks += chunk;
                    });
                    resp.on("end", () => {
                      const jsonData = JSON.parse(dataChunks);
                      lobby.eloAvailable = jsonData.status === "OK";
                      log.info(
                        "Autohost disabled. Map queried. Returned: " +
                          lobby.eloAvailable
                      );
                      sendWindow("lobbyData", lobby);
                      processLobby(lobbyData.lobbyData);
                      // TODO check variants, seasons, modes, and ladders
                      /*if (lobbyData.eloAvailable) {
                      jsonData.body.variants.forEach((variant) => {
                        variant.stats.forEach((stats) => {});
                      });
                    }*/
                    });
                  }
                )
                .on("error", (err) => {
                  log.error("Error: " + err.message);
                });
            }
          }
        }
      } else {
        lobby.eloAvailable = eloSettings.eloAvailable;
        lobby.eloMapName = eloSettings.eloMapName;
        sendWindow("lobbyData", lobby);
        log.info(
          "Autohost enabled. Lobby data received",
          lobby.eloMapName,
          lobby.eloAvailable
        );
        processLobby(lobbyData.lobbyData);
      }
    } else {
      lobby.eloAvailable = false;
      lobby.eloMapName = "";
      log.info("Lobby data received", lobby.eloMapName, lobby.eloAvailable);
    }
  }
}

async function processLobby(lobbyData) {
  lobby.lobbyData = lobbyData;
  lobby.lobbyData.allPlayers = new Set(lobby.lobbyData.allPlayers);
  if (lobby.eloAvailable) {
    const mapName = lobby.eloMapName;
    Object.keys(lobby.eloList).forEach((user) => {
      if (!lobby.lobbyData.allPlayers.has(user)) {
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
        if (eloSettings.type === "wc3stats") {
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
                resp.on("end", async () => {
                  const jsonData = JSON.parse(dataChunks);
                  lobby.lookingUpELO.delete(user);
                  let elo = 500;
                  if (jsonData.body.length > 0) {
                    elo = jsonData.body[0].rating;
                  }
                  // If they haven't left, set real ELO
                  if (lobby.lobbyData.allPlayers.has(user)) {
                    lobby.eloList[user] = elo;
                    sendProgress(
                      "Got ELO for " + user,
                      (Object.keys(lobby.eloList).length /
                        (lobby.lobbyData.openPlayerSlots +
                          lobby.lobbyData.allPlayers.size)) *
                        90 +
                        10
                    );
                    log.silly(JSON.stringify(lobby));
                    // Send new step to GUI
                    win.webContents.send("fromMain", {
                      messageType: "lobbyUpdate",
                      data: lobby,
                    });
                    log.verbose(user + " ELO: " + elo.toString());
                    if (eloSettings.announceELO) {
                      await typeText(user + " ELO: " + elo.toString(), true);
                    }
                    // If the lobby is full, and we have the ELO for everyone,
                    if (
                      lobby.lobbyData.openPlayerSlots === 0 &&
                      Object.keys(lobby.eloList).length ===
                        lobby.lobbyData.allPlayers.size
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
    lobby.mapData.isHost &&
    autoHost.type === "ghostHost" &&
    autoHost.announceIsBot
  ) {
    lobby.lobbyData.allPlayers.forEach(function (user) {
      if (!lobby.playerSet || !lobby.playerSet.has(user)) {
        announceBot();
        return;
      }
    });
    lobby.playerSet = lobby.lobbyData.allPlayers;
  }
  if (lobbyIsReady()) {
    finalizeLobby();
  }
  sendWindow("lobbyUpdate", lobby);
}

function lobbyIsReady() {
  return (
    (lobby.eloAvailable &&
      lobby.lobbyData.openPlayerSlots === 0 &&
      Object.keys(lobby.eloList).length === lobby.lobbyData.allPlayers.size) ||
    (!lobby.eloAvailable && lobby.lobbyData.openPlayerSlots === 0)
  );
}

async function finalizeLobby() {
  if (lobby.eloAvailable && eloSettings.balanceTeams) {
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
    await typeText("ELO data provided by: " + eloSettings.type, true);
    if (!lobby.mapData.isHost) {
      await typeText(
        lobby.leastSwap + " should be: " + bestCombo.join(", "),
        true
      );
    } else {
      for (let i = 0; i < lobby.swaps[0].length; i++) {
        if (!lobbyIsReady()) {
          break;
        }
        sendProgress(
          "Swapping " + lobby.swaps[0][i] + " and " + lobby.swaps[1][i],
          100
        );
        await typeText(
          "!swap " + lobby.swaps[0][i] + " " + lobby.swaps[1][i],
          true
        );
      }
    }
  }
  sendProgress("Starting Game", 100);
  // Wait a quarter second to make sure no one left
  if (lobby.mapData.isHost) {
    if (autoHost.type === "ghostHost") {
      setTimeout(async () => {
        if (lobbyIsReady()) {
          await typeText(
            "AutoHost functionality provided by WC3 Auto Balancer.",
            true
          );
          if (autoHost.sounds) {
            playSound("ready.wav");
          }
          log.info("Starting game");
          socket.send(JSON.stringify({ messageType: "start" }));
          setTimeout(tempFindQuit, 60000);
        }
      }, 250);
    } else if (autoHost.type === "autoHost" && autoHost.sounds) {
      playSound("ready.wav");
    }
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
    (!eloSettings.excludeHostFromSwap &&
      bestComboInTeam1.length >= bestComboInTeam2.length) ||
    (eloSettings.excludeHostFromSwap &&
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

async function announceBot() {
  if (menuState === "In Lobby") {
    let text = "Welcome. I am a bot.";
    if (lobby.eloAvailable) {
      text += " I will fetch ELO from " + eloSettings.type + ".";
      if (eloSettings.balanceTeams) {
        text += " I will try to balance teams before we start.";
      }
    }
    await typeText(text, true, false, true);
  }
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

async function typeText(
  text,
  sendToChat = false,
  isGameName = false,
  enqueueMessage = true
) {
  if (socket) {
    await activeWindowWar();
    if (warcraftInFocus) {
      if (
        (menuState === "In Lobby" && sendToChat) ||
        (isGameName && menuState === "Creating Game")
      ) {
        let oldClipboard = clipboard.readText();
        if (sendToChat) {
          sendSocket("sendChat");
          await keyboard.type(Key.Enter);
        }
        clipboard.writeText(text);
        keyboard
          .type(Key.LeftControl, Key.V)
          .then(async () => {
            if (isGameName) {
              sendSocket("doneTyping");
            } else if (sendToChat) {
              await keyboard.type(Key.Enter);
            }
          })
          .then(async () => {
            clipboard.writeText(oldClipboard);
          })
          .catch((err) => {
            log.error(err);
          });
      }
    } else if (enqueueMessage) {
      setTimeout(typeText.bind(null, text, sendToChat, isGameName), 3000);
    }
  }
  return;
}

function playSound(file) {
  if (!app.isPackaged) {
    sound.play(path.join(__dirname, "sounds\\" + file));
  } else {
    sound.play(path.join(app.getAppPath(), "\\..\\..\\sounds\\" + file));
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

// Everything below is temporary until nut-js fixes the issue with windows scaling
// https://github.com/nut-tree/nut.js/issues/249

let quitHLWMat, quitNormalMat, quitHLWHighlightMat, quitNormalHighlightMat;
async function tempFindQuitHelper(templateMat, targetCoefficient = 0.8) {
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
    if (target) {
      const matched = target.matchTemplate(templateMat, 5);
      const maxVal = matched.minMaxLoc().maxVal;
      log.verbose("Closest Target Value: " + maxVal.toString());
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
  if (socket && menuState === "In Game") {
    await activeWindowWar();
    if (warcraftInFocus) {
      sendProgress("Searching for quit...", 100);
      log.verbose("Looking for quit. quitHLWMat");
      const foundQuitHLW = await tempFindQuitHelper(quitHLWMat);
      log.verbose("Looking for quit. quitNormalMat");
      const foundQuitNormal = await tempFindQuitHelper(quitNormalMat);
      log.verbose("Looking for quit. quitHLWHighlightMat");
      const foundQuitHLWHighlight = await tempFindQuitHelper(
        quitHLWHighlightMat
      );
      if (foundQuitHLW || foundQuitNormal || foundQuitHLWHighlight) {
        sendProgress("Found quit. Quitting", 100);
        log.info("Found quit. Press q");
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
    const screenWidth = await robot.getScreenSize().width;
    if (!app.isPackaged) {
      quitHLWMat = await cv.imreadAsync(`${__dirname}\\images\\quitHLW.png`);
      quitNormalMat = await cv.imreadAsync(
        `${__dirname}\\images\\quitNormal.png`
      );
      quitHLWHighlightMat = await cv.imreadAsync(
        `${__dirname}\\images\\quitHLWHighlight.png`
      );
    } else {
      quitHLWMat = await cv.imreadAsync(
        `${app.getAppPath()}\\..\\..\\images\\quitHLW.png`
      );
      quitHLWHighlightMat = await cv.imreadAsync(
        `${app.getAppPath()}\\..\\..\\images\\quitHLWHighlight.png`
      );
      quitNormalMat = await cv.imreadAsync(
        `${app.getAppPath()}\\..\\..\\images\\${
          screenWidth > 1440 ? "" : "1080\\"
        }quitNormal.png`
      );
    }
  } catch (err) {
    log.error("setupMats: " + err);
  }
}

async function analyzeGame() {
  let data = new Set();
  let dataTypes = new Set();
  parser.on("gamedatablock", (block) => {
    if (block.id === 0x1f) {
      block.commandBlocks.forEach((commandBlock) => {
        if (
          commandBlock.actions.length > 0 &&
          commandBlock.actions[0].filename === "MMD.Dat"
        ) {
          commandBlock.actions.forEach((block) => {
            if (block.key && !/^\d+$/.test(block.key)) {
              if (!/^DefVarP/i.test(block.key)) {
                data.add(block.key);
              } else {
                dataTypes.add(block.key);
              }
            }
          });
        }
      });
    }
  });
  await parser.parse(readFileSync("./replay.w3g"));
}
