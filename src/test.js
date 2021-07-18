const {
  keyboard,
  screen,
  getActiveWindow,
  clipboard,
  Key,
} = require("@nut-tree/nut-js");
//const Tesseract = require("tesseract.js");
screen.config.confidence = 0.99;
screen.config.autoHighlight = true;
async function findQuit() {
  if (true) {
    if (true) {
      screen
        .find("quit.png", (searchMultipleScales = true))
        .then(async (rest) => {
          console.log("Found quit. Press q");
          console.log(rest);
          //await keyboard.type("q");
          //robot.keyTap("q");
          /*if (playSounds) {
            sound
              .play(path.join(__dirname, "sounds/quit.wav"))
              .then((response) => console.log(response));
          }*/
        })
        .catch((rest) => {
          console.log(rest);
          //setTimeout(findQuit, 5000);
        });
      setTimeout(findQuit, 2000);
    } else {
      setTimeout(findQuit, 5000);
    }
  }
}
//findQuit();
/*
function ocr() {
  screen.capture("temp");
  Tesseract.recognize("temp.png", "eng").then(({ data: { text } }) => {
    console.log(text);
    console.log(text.match(/quit/i));
  });
}*/
//setTimeout(ocr, 2000);
//console.log(screen.height());
screen.captureRegion("temp", [0, 0, 1440, 1440]);
