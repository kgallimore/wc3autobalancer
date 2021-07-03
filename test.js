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
  bestCombo: ["Macpoulet", "Rat", "MrRogueU", "Trenchguns"],
  //bestCombo: ["Hairbear", "SilentSlippz", "zompy", "Trenchguns"],
  //bestCombo: ["SilentSlippz", "Macpoulet", "BKTease", "Rat"],
  eloDiff: 29.5,
};

function intersect(a, b) {
  var setB = new Set(b);
  return [...new Set(a)].filter((x) => setB.has(x));
}
function swapHelper(list) {
  // TODO this was done very late at night and seems to be super inconsistent
  let swapsFromTeam1 = [];
  let swapsFromTeam2 = [];
  excludeHostFromSwap = false;
  const bestComboInTeam1 = intersect(list.bestCombo, list.teamList[list.team1]);
  const bestComboInTeam2 = intersect(list.bestCombo, list.teamList[list.team2]);
  // If not excludeHostFromSwap and team1 has more best combo people, or excludeHostFromSwap and the best combo includes the host keep all best combo players in team 1.
  if (
    (!excludeHostFromSwap &&
      bestComboInTeam1.length > bestComboInTeam2.length) ||
    (excludeHostFromSwap && list.bestCombo.includes(list.gameHost))
  ) {
    list.leastSwap = list.team1;
    // Go through team 1 and grab everyone who is not in the best combo

    list.teamList[list.team1].forEach((user) => {
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
swapHelper(list);
console.log(list.swaps[0], list.swaps[1]);

console.log(list.leastSwap);
