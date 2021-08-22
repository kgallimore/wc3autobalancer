const {
  keyboard,
  screen,
  getActiveWindow,
  clipboard,
  Key,
} = require("@nut-tree/nut-js");
const robot = require("robotjs");
const Jimp = require("jimp");

screen.config.confidence = 0.99;
screen.config.autoHighlight = true;
async function findQuit() {
  if (true) {
    screen
      .find("quit.png", (searchMultipleScales = true))
      .then(async (rest) => {
        console.log("Found quit. Press q");
        console.log(rest);
      })
      .catch((rest) => {
        console.log(rest);
      });
    setTimeout(findQuit, 2000);
  }
}
setTimeout(() => {
  (async () => {
    let pic = robot.screen.capture();
    const image = new Jimp(pic.width, pic.height);
    let pos = 0;
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
      image.bitmap.data[idx + 2] = pic.image.readUInt8(pos++);
      image.bitmap.data[idx + 1] = pic.image.readUInt8(pos++);
      image.bitmap.data[idx + 0] = pic.image.readUInt8(pos++);
      image.bitmap.data[idx + 3] = pic.image.readUInt8(pos++);
    });
    await image.writeAsync(`${__dirname}\\robotScreenshot.png`);
  })();
  screen.capture("nutCapture");
}, 2000);
//findQuit();
/*setTimeout(() => {
  findQuit();
}, 2000);*/
//console.log(screen.height());
screen.captureRegion("temp", [0, 0, 1440, 1440]);
