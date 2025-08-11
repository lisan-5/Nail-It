/* Simple Tetris - Vanilla JS + Canvas */

// Canvas and UI
const boardCanvas = document.getElementById("board");
const boardContext = boardCanvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextContext = nextCanvas.getContext("2d");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const linesEl = document.getElementById("lines");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");

// Board settings
const NUM_COLUMNS = 10;
const NUM_ROWS = 20;
const CELL_SIZE = 30; // pixels

// Timing
const INITIAL_DROP_MS = 800; // starting fall speed
const LEVEL_STEP_LINES = 10;
const MIN_DROP_MS = 80; // cap the speed

// Scoring (classic-ish)
const LINE_CLEAR_SCORE = {
  1: 100,
  2: 300,
  3: 500,
  4: 800,
};

// Colors per tetromino type
const TETROMINO_COLORS = {
  I: "#00FFFF", // Cyan
  J: "#1E90FF", // DodgerBlue
  L: "#FFA500", // Orange
  O: "#FFD700", // Gold
  S: "#32CD32", // LimeGreen
  T: "#BA55D3", // MediumOrchid
  Z: "#DC143C", // Crimson
  X: "#2a2e45", // board fill fallback
};

// 4x4 matrices per tetromino type
const TETROMINO_SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
};

// Game state
let boardGrid = createEmptyBoard(); // [row][col]
let currentPiece = null;
let nextQueue = [];
let isRunning = false;
let isPaused = false;
let lastTimeMs = 0;
let fallAccumulatorMs = 0;
let dropIntervalMs = INITIAL_DROP_MS;

let score = 0;
let linesCleared = 0;
let level = 1;

function createEmptyBoard() {
  const rows = [];
  for (let r = 0; r < NUM_ROWS; r++) {
    const row = new Array(NUM_COLUMNS).fill(null);
    rows.push(row);
  }
  return rows;
}

function resetGame() {
  boardGrid = createEmptyBoard();
  score = 0;
  linesCleared = 0;
  level = 1;
  dropIntervalMs = INITIAL_DROP_MS;
  fallAccumulatorMs = 0;
  lastTimeMs = 0;
  nextQueue = [];
  refillQueueIfNeeded();
  currentPiece = createPiece(nextQueue.shift());
  updateSidebar();
  drawAll();
}

function updateSidebar() {
  scoreEl.textContent = String(score);
  levelEl.textContent = String(level);
  linesEl.textContent = String(linesCleared);
  drawNextPreview();
}

function refillQueueIfNeeded() {
  // 7-bag randomizer
  if (nextQueue.length <= 7) {
    const bag = ["I", "J", "L", "O", "S", "T", "Z"];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    nextQueue.push(...bag);
  }
}

function createPiece(type) {
  const matrix = TETROMINO_SHAPES[type].map((row) => row.slice());
  const color = TETROMINO_COLORS[type];
  // Spawn near top center
  const spawnX = Math.floor(NUM_COLUMNS / 2) - Math.ceil(matrix[0].length / 2);
  return {
    type,
    matrix,
    x: spawnX,
    y: -getTopPadding(matrix), // allows piece to enter from above
    color,
  };
}

function getTopPadding(matrix) {
  for (let r = 0; r < matrix.length; r++) {
    if (matrix[r].some((v) => v !== 0)) return r;
  }
  return 0;
}

function startGame() {
  if (!isRunning) {
    resetGame();
    isRunning = true;
    isPaused = false;
    window.requestAnimationFrame(gameLoop);
  } else if (isPaused) {
    isPaused = false;
    window.requestAnimationFrame(gameLoop);
  }
}

function pauseGame() {
  if (!isRunning) return;
  isPaused = !isPaused;
}

function gameLoop(timestampMs) {
  if (!isRunning || isPaused) return;

  if (!lastTimeMs) lastTimeMs = timestampMs;
  const deltaMs = timestampMs - lastTimeMs;
  lastTimeMs = timestampMs;

  fallAccumulatorMs += deltaMs;
  if (fallAccumulatorMs >= dropIntervalMs) {
    fallAccumulatorMs = 0;
    softDropStep();
  }

  drawAll();
  window.requestAnimationFrame(gameLoop);
}

function softDropStep() {
  if (!currentPiece) return;
  if (isValidPosition(currentPiece.matrix, currentPiece.x, currentPiece.y + 1)) {
    currentPiece.y += 1;
  } else {
    lockCurrentPiece();
    const lines = clearFullLines();
    if (lines > 0) {
      addScoreForLines(lines);
      updateLevelIfNeeded();
    }
    spawnNextPiece();
    if (!isValidPosition(currentPiece.matrix, currentPiece.x, currentPiece.y)) {
      // Game over
      isRunning = false;
      isPaused = false;
      drawAll(true);
    }
  }
}

function spawnNextPiece() {
  refillQueueIfNeeded();
  currentPiece = createPiece(nextQueue.shift());
  updateSidebar();
}

function addScoreForLines(lines) {
  score += LINE_CLEAR_SCORE[lines] || 0;
  linesCleared += lines;
  updateSidebar();
}

function updateLevelIfNeeded() {
  const newLevel = Math.floor(linesCleared / LEVEL_STEP_LINES) + 1;
  if (newLevel !== level) {
    level = newLevel;
    dropIntervalMs = Math.max(MIN_DROP_MS, INITIAL_DROP_MS - (level - 1) * 70);
    updateSidebar();
  }
}

function lockCurrentPiece() {
  const { matrix, x, y, color, type } = currentPiece;
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (matrix[r][c]) {
        const boardRow = y + r;
        const boardCol = x + c;
        if (boardRow >= 0 && boardRow < NUM_ROWS && boardCol >= 0 && boardCol < NUM_COLUMNS) {
          boardGrid[boardRow][boardCol] = { color, type };
        }
      }
    }
  }
}

function clearFullLines() {
  let lines = 0;
  for (let r = NUM_ROWS - 1; r >= 0; ) {
    if (boardGrid[r].every((cell) => cell !== null)) {
      lines += 1;
      // Shift everything above down
      for (let y = r; y > 0; y--) {
        boardGrid[y] = boardGrid[y - 1];
      }
      boardGrid[0] = new Array(NUM_COLUMNS).fill(null);
    } else {
      r -= 1;
    }
  }
  return lines;
}

function isValidPosition(matrix, offsetX, offsetY) {
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (!matrix[r][c]) continue;
      const x = offsetX + c;
      const y = offsetY + r;
      if (x < 0 || x >= NUM_COLUMNS || y >= NUM_ROWS) return false;
      if (y >= 0 && boardGrid[y][x] !== null) return false;
    }
  }
  return true;
}

function rotateClockwise(matrix) {
  const size = matrix.length;
  const rotated = Array.from({ length: size }, () => new Array(size).fill(0));
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      rotated[c][size - 1 - r] = matrix[r][c];
    }
  }
  return trimMatrix(rotated);
}

function rotateCounterClockwise(matrix) {
  const size = matrix.length;
  const rotated = Array.from({ length: size }, () => new Array(size).fill(0));
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      rotated[size - 1 - c][r] = matrix[r][c];
    }
  }
  return trimMatrix(rotated);
}

function trimMatrix(matrix) {
  // Remove empty rows/cols around the shape for tighter collisions
  let top = 0;
  while (top < matrix.length && matrix[top].every((v) => v === 0)) top++;
  let bottom = matrix.length - 1;
  while (bottom >= 0 && matrix[bottom].every((v) => v === 0)) bottom--;

  let left = 0;
  while (left < matrix[0].length && matrix.every((row) => row[left] === 0)) left++;
  let right = matrix[0].length - 1;
  while (right >= 0 && matrix.every((row) => row[right] === 0)) right--;

  const trimmed = [];
  for (let r = top; r <= bottom; r++) {
    trimmed.push(matrix[r].slice(left, right + 1));
  }
  return trimmed.length > 0 ? trimmed : [[0]];
}

// Rendering
function drawAll(isGameOver = false) {
  boardContext.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
  drawBoard();
  if (currentPiece && isRunning) drawPiece(currentPiece);
  if (isGameOver) drawGameOverOverlay();
}

function drawBoard() {
  // Grid background
  boardContext.fillStyle = "#0f1220";
  boardContext.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

  // Existing stacked blocks
  for (let r = 0; r < NUM_ROWS; r++) {
    for (let c = 0; c < NUM_COLUMNS; c++) {
      const cell = boardGrid[r][c];
      if (cell) drawCell(c, r, cell.color);
      // draw subtle grid lines
      boardContext.strokeStyle = "rgba(255,255,255,0.05)";
      boardContext.strokeRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
  }
}

function drawPiece(piece) {
  const { matrix, x, y, color } = piece;
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (matrix[r][c]) {
        const drawX = x + c;
        const drawY = y + r;
        if (drawY >= 0) drawCell(drawX, drawY, color);
      }
    }
  }
}

function drawCell(col, row, color) {
  const x = col * CELL_SIZE;
  const y = row * CELL_SIZE;
  // base block
  boardContext.fillStyle = color;
  boardContext.fillRect(x, y, CELL_SIZE, CELL_SIZE);
  // inner shading
  boardContext.fillStyle = "rgba(255,255,255,0.12)";
  boardContext.fillRect(x + 2, y + 2, CELL_SIZE - 4, 6);
  boardContext.fillStyle = "rgba(0,0,0,0.2)";
  boardContext.fillRect(x + 2, y + CELL_SIZE - 8, CELL_SIZE - 4, 6);
}

function drawNextPreview() {
  nextContext.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (nextQueue.length === 0) return;
  const type = nextQueue[0];
  const matrixRaw = TETROMINO_SHAPES[type];

  // normalize to square for rotation rendering
  const size = Math.max(matrixRaw.length, matrixRaw[0].length);
  const matrix = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => (matrixRaw[r] && matrixRaw[r][c]) ? 1 : 0)
  );
  const trimmed = trimMatrix(matrix);

  const color = TETROMINO_COLORS[type];
  const previewCell = 24;
  const totalWidth = trimmed[0].length * previewCell;
  const totalHeight = trimmed.length * previewCell;
  const offsetX = Math.floor((nextCanvas.width - totalWidth) / 2);
  const offsetY = Math.floor((nextCanvas.height - totalHeight) / 2);

  for (let r = 0; r < trimmed.length; r++) {
    for (let c = 0; c < trimmed[r].length; c++) {
      if (!trimmed[r][c]) continue;
      const x = offsetX + c * previewCell;
      const y = offsetY + r * previewCell;
      nextContext.fillStyle = color;
      nextContext.fillRect(x, y, previewCell, previewCell);
      nextContext.fillStyle = "rgba(255,255,255,0.12)";
      nextContext.fillRect(x + 2, y + 2, previewCell - 4, 4);
      nextContext.fillStyle = "rgba(0,0,0,0.2)";
      nextContext.fillRect(x + 2, y + previewCell - 6, previewCell - 4, 4);
    }
  }
}

function drawGameOverOverlay() {
  boardContext.fillStyle = "rgba(0, 0, 0, 0.55)";
  boardContext.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
  boardContext.fillStyle = "#ffffff";
  boardContext.font = "bold 24px system-ui, sans-serif";
  boardContext.textAlign = "center";
  boardContext.fillText("Game Over", boardCanvas.width / 2, boardCanvas.height / 2 - 10);
  boardContext.font = "14px system-ui, sans-serif";
  boardContext.fillText("Press Start or R to restart", boardCanvas.width / 2, boardCanvas.height / 2 + 18);
}

// Input
function handleKeyDown(event) {
  if (!isRunning || isPaused) {
    if (event.key === "p" || event.key === "P") {
      pauseGame();
      return;
    }
    if (event.key === "r" || event.key === "R") {
      isRunning = false;
      startGame();
      return;
    }
    if (event.code === "Space") {
      startGame();
      return;
    }
    return;
  }

  switch (event.key) {
    case "ArrowLeft":
      tryMove(currentPiece.x - 1, currentPiece.y);
      break;
    case "ArrowRight":
      tryMove(currentPiece.x + 1, currentPiece.y);
      break;
    case "ArrowDown":
      // soft drop gives tiny points per step (optional)
      if (isValidPosition(currentPiece.matrix, currentPiece.x, currentPiece.y + 1)) {
        currentPiece.y += 1;
        score += 1;
        updateSidebar();
      } else {
        softDropStep();
      }
      break;
    case "ArrowUp":
      attemptRotate(true);
      break;
    case "z":
    case "Z":
      attemptRotate(false);
      break;
    case "p":
    case "P":
      pauseGame();
      break;
    case "r":
    case "R":
      isRunning = false;
      startGame();
      break;
  }

  if (event.code === "Space") {
    // Hard drop
    const dropDistance = getHardDropDistance();
    currentPiece.y += dropDistance;
    score += Math.max(0, 2 * dropDistance);
    updateSidebar();
    softDropStep(); // lock and spawn
  }
}

function tryMove(targetX, targetY) {
  if (isValidPosition(currentPiece.matrix, targetX, targetY)) {
    currentPiece.x = targetX;
    currentPiece.y = targetY;
    drawAll();
  }
}

function attemptRotate(clockwise = true) {
  const rotated = clockwise
    ? rotateClockwise(padToSquare(currentPiece.matrix))
    : rotateCounterClockwise(padToSquare(currentPiece.matrix));

  // Simple wall kicks: try shifting left/right up to 2 cells
  const kicks = [0, -1, 1, -2, 2];
  for (const dx of kicks) {
    if (isValidPosition(rotated, currentPiece.x + dx, currentPiece.y)) {
      currentPiece.matrix = rotated;
      currentPiece.x += dx;
      drawAll();
      return;
    }
  }
}

function padToSquare(matrix) {
  const size = Math.max(matrix.length, matrix[0].length);
  const square = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => (matrix[r] && matrix[r][c]) ? 1 : 0)
  );
  return square;
}

function getHardDropDistance() {
  let distance = 0;
  while (isValidPosition(currentPiece.matrix, currentPiece.x, currentPiece.y + distance + 1)) {
    distance += 1;
  }
  return distance;
}

// Buttons
startBtn.addEventListener("click", () => startGame());
pauseBtn.addEventListener("click", () => pauseGame());
resetBtn.addEventListener("click", () => {
  isRunning = false;
  startGame();
});

window.addEventListener("keydown", handleKeyDown);

// Initial draw
function init() {
  // Ensure canvas sizes match CELL_SIZE grid
  boardCanvas.width = NUM_COLUMNS * CELL_SIZE;
  boardCanvas.height = NUM_ROWS * CELL_SIZE;
  drawAll();
  drawNextPreview();
}

init();