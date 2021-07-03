window.api.receive("fromMain", (data) => {
  switch (data.messageType) {
    case "statusChange":
      const statusElement = document.getElementById("mainStatus");
      const statusText = document.getElementById("statusText");
      switch (data.data) {
        case "connected":
          statusText.innerText = "Connected to Warcraft";
          statusElement.classList.remove("bg-secondary", "bg-warning");
          statusElement.classList.add("bg-success", "badge");
          break;
        case "disconnected":
          statusText.innerText = "Disconnected from Warcraft";
          statusElement.classList.remove("bg-secondary", "bg-success");
          statusElement.classList.add("bg-warning", "badge");
          break;
      }
      break;
    case "lobbyElo":
      list = data.data;
      list.teamName;
      break;
    case "processing":
      document.getElementById("progressbar").style.width =
        data.data.progress.toString() + "%";
      document.getElementById("progressbarLabel").innerText = data.data.step;
      break;
    case "error":
      break;
    default:
      console.log(data);
  }
});
