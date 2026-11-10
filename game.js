const GAME_TIME = 10;

const timeElement = document.querySelector("#time");
const scoreElement = document.querySelector("#score");
const recordElement = document.querySelector("#record");
const messageElement = document.querySelector("#message");
const clickButton = document.querySelector("#clickButton");
const startButton = document.querySelector("#startButton");

let score = 0;
let timer;
let endTime;
let record = Number(localStorage.getItem("clickRecord")) || 0;

recordElement.textContent = record;

function startGame() {
  score = 0;
  endTime = Date.now() + GAME_TIME * 1000;

  scoreElement.textContent = score;
  timeElement.textContent = GAME_TIME.toFixed(1);
  messageElement.textContent = "¡Vamos!";
  clickButton.disabled = false;
  startButton.disabled = true;

  timer = setInterval(updateTimer, 50);
}

function updateTimer() {
  const remaining = Math.max(0, (endTime - Date.now()) / 1000);
  timeElement.textContent = remaining.toFixed(1);

  if (remaining === 0) {
    finishGame();
  }
}

function finishGame() {
  clearInterval(timer);
  clickButton.disabled = true;
  startButton.disabled = false;
  startButton.textContent = "Jugar otra vez";

  if (score > record) {
    record = score;
    recordElement.textContent = record;
    localStorage.setItem("clickRecord", record);
    messageElement.textContent = `¡Nuevo récord: ${score}!`;
  } else {
    messageElement.textContent = `¡Tiempo! Lograste ${score} puntos.`;
  }
}

clickButton.addEventListener("click", () => {
  if (!clickButton.disabled) {
    score++;
    scoreElement.textContent = score;
  }
});

startButton.addEventListener("click", startGame);
