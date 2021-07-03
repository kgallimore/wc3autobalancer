// Test algos and whatever here
const list = {
  mapName: "HLW 8.3",
  mapAuthor: "Author: BuuFuu",
  mapPlayerSize: "10",
  gameName: "HLW -SH",
  gameHost: "Hairbear",
  isHost: false,
  playerCount: "10/10",
  teamList: {
    FORCE01: ["Hairbear", "Rat", "MrRogueU", "Macpoulet"],
    "ATTACKER CREEPS FORCE01": ["Computer (Normal)"],
    FORCE02: ["SilentSlippz", "zompy", "Trenchguns", "BKTease"],
    "ATTACKER CREEPS FORCE02": ["Computer (Normal)"],
  },
  team1: "FORCE01",
  team2: "FORCE02",
  eloList: {
    SilentSlippz: 500,
    Macpoulet: 500,
    BKTease: 500,
    MrRogueU: 485,
    Trenchguns: 656,
    zompy: 465,
    Rat: 532,
    Hairbear: 485,
  },
  totalElo: 4123,
  bestCombo: ["Hairbear", "SilentSlippz", "zompy", "Trenchguns"],
  //bestCombo: ["SilentSlippz", "Macpoulet", "BKTease", "Rat"],
  eloDiff: 29.5,
};

function intersect(a, b) {
  var setB = new Set(b);
  return [...new Set(a)].filter((x) => setB.has(x));
}
const bestComboInTeam1 = intersect(list.bestCombo, list.teamList[list.team1]);
const bestComboInTeam2 = intersect(list.bestCombo, list.teamList[list.team2]);
let swapsFromTeam1 = [];
let swapsFromTeam2 = [];
excludeRedFromSwap = true;
if (
  bestComboInTeam1.length > bestComboInTeam2.length ||
  (excludeRedFromSwap && list.teamList[list.team1].includes(list.gameHost))
) {
  list.leastSwap = list.team1;
  // Swap the needed players from team 2 to team 1

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
console.log(swapsFromTeam1, swapsFromTeam2);

console.log(bestComboInTeam1);
console.log(bestComboInTeam2);
console.log(list.leastSwap);
