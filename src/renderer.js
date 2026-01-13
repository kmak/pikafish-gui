// Xiangqi Board Renderer and Game Logic

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

// Board dimensions
const CELL_SIZE = 50;
const BOARD_PADDING = 30;
const LABEL_MARGIN = 20;
const COLS = 9;
const ROWS = 10;

// Piece types
const PIECES = {
  K: { name: 'King', char: '帅', charBlack: '将' },
  A: { name: 'Advisor', char: '仕', charBlack: '士' },
  B: { name: 'Bishop', char: '相', charBlack: '象' },
  N: { name: 'Knight', char: '马', charBlack: '馬' },
  R: { name: 'Rook', char: '车', charBlack: '車' },
  C: { name: 'Cannon', char: '炮', charBlack: '砲' },
  P: { name: 'Pawn', char: '兵', charBlack: '卒' }
};

// Starting position FEN
const START_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';

// Game state
let board = [];
let selectedPiece = null;
let legalMoves = [];
let moveHistory = [];
let positionHistory = [];
let currentTurn = 'w'; // 'w' for red, 'b' for black
let flipped = false;
let engineReady = false;
let isThinking = false;
let highlightedMove = null; // {from: {row, col}, to: {row, col}}

// Initialize the board from FEN
function parseFEN(fen) {
  const parts = fen.split(' ');
  const position = parts[0];
  const turn = parts[1] || 'w';

  const newBoard = [];
  for (let i = 0; i < ROWS; i++) {
    newBoard.push(new Array(COLS).fill(null));
  }

  const rows = position.split('/');
  for (let row = 0; row < rows.length; row++) {
    let col = 0;
    for (const char of rows[row]) {
      if (/\d/.test(char)) {
        col += parseInt(char);
      } else {
        const color = char === char.toUpperCase() ? 'w' : 'b';
        newBoard[row][col] = {
          type: char.toUpperCase(),
          color: color
        };
        col++;
      }
    }
  }

  return { board: newBoard, turn };
}

// Convert board to FEN
function boardToFEN() {
  let fen = '';
  for (let row = 0; row < ROWS; row++) {
    let empty = 0;
    for (let col = 0; col < COLS; col++) {
      const piece = board[row][col];
      if (piece) {
        if (empty > 0) {
          fen += empty;
          empty = 0;
        }
        fen += piece.color === 'w' ? piece.type : piece.type.toLowerCase();
      } else {
        empty++;
      }
    }
    if (empty > 0) fen += empty;
    if (row < ROWS - 1) fen += '/';
  }
  fen += ` ${currentTurn} - - 0 1`;
  return fen;
}

// Convert board position to UCI notation
function posToUCI(row, col) {
  const file = String.fromCharCode('a'.charCodeAt(0) + col);
  const rank = 9 - row;
  return `${file}${rank}`;
}

// Convert UCI notation to board position
function uciToPos(uci) {
  const file = uci.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = 9 - parseInt(uci[1]);
  return { row: rank, col: file };
}

// Draw the board
function drawBoard() {
  // Clear canvas
  ctx.fillStyle = '#d4a559';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#5a3a1a';
  ctx.lineWidth = 1;

  const offsetX = BOARD_PADDING;
  const offsetY = BOARD_PADDING;

  // Draw grid lines
  for (let i = 0; i < COLS; i++) {
    const x = offsetX + i * CELL_SIZE;
    // Top half
    ctx.beginPath();
    ctx.moveTo(x, offsetY);
    ctx.lineTo(x, offsetY + 4 * CELL_SIZE);
    ctx.stroke();
    // Bottom half
    ctx.beginPath();
    ctx.moveTo(x, offsetY + 5 * CELL_SIZE);
    ctx.lineTo(x, offsetY + 9 * CELL_SIZE);
    ctx.stroke();
  }

  for (let i = 0; i < ROWS; i++) {
    const y = offsetY + i * CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(offsetX, y);
    ctx.lineTo(offsetX + 8 * CELL_SIZE, y);
    ctx.stroke();
  }

  // Draw border
  ctx.lineWidth = 2;
  ctx.strokeRect(offsetX, offsetY, 8 * CELL_SIZE, 9 * CELL_SIZE);

  // Draw palace diagonals
  ctx.lineWidth = 1;
  // Top palace
  ctx.beginPath();
  ctx.moveTo(offsetX + 3 * CELL_SIZE, offsetY);
  ctx.lineTo(offsetX + 5 * CELL_SIZE, offsetY + 2 * CELL_SIZE);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(offsetX + 5 * CELL_SIZE, offsetY);
  ctx.lineTo(offsetX + 3 * CELL_SIZE, offsetY + 2 * CELL_SIZE);
  ctx.stroke();

  // Bottom palace
  ctx.beginPath();
  ctx.moveTo(offsetX + 3 * CELL_SIZE, offsetY + 7 * CELL_SIZE);
  ctx.lineTo(offsetX + 5 * CELL_SIZE, offsetY + 9 * CELL_SIZE);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(offsetX + 5 * CELL_SIZE, offsetY + 7 * CELL_SIZE);
  ctx.lineTo(offsetX + 3 * CELL_SIZE, offsetY + 9 * CELL_SIZE);
  ctx.stroke();

  // Draw river text
  ctx.fillStyle = '#5a3a1a';
  ctx.font = '20px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const riverY = offsetY + 4.5 * CELL_SIZE;
  ctx.fillText('楚 河', offsetX + 2 * CELL_SIZE, riverY);
  ctx.fillText('漢 界', offsetX + 6 * CELL_SIZE, riverY);

  // Draw axis labels
  ctx.fillStyle = '#5a3a1a';
  ctx.font = '14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // File labels (a-i) at bottom
  for (let i = 0; i < COLS; i++) {
    const file = String.fromCharCode('a'.charCodeAt(0) + (flipped ? (COLS - 1 - i) : i));
    const x = offsetX + i * CELL_SIZE;
    ctx.fillText(file, x, offsetY + 9 * CELL_SIZE + LABEL_MARGIN + 10);
  }

  // Rank labels (0-9) on right side
  ctx.textAlign = 'left';
  for (let i = 0; i < ROWS; i++) {
    const rank = flipped ? i : (9 - i);
    const y = offsetY + i * CELL_SIZE;
    ctx.fillText(rank.toString(), offsetX + 8 * CELL_SIZE + LABEL_MARGIN + 5, y);
  }

  // Draw pieces
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const piece = board[row][col];
      if (piece) {
        const displayRow = flipped ? (ROWS - 1 - row) : row;
        const displayCol = flipped ? (COLS - 1 - col) : col;
        drawPiece(displayCol, displayRow, piece, row === selectedPiece?.row && col === selectedPiece?.col);
      }
    }
  }

  // Draw legal move indicators
  for (const move of legalMoves) {
    const displayRow = flipped ? (ROWS - 1 - move.row) : move.row;
    const displayCol = flipped ? (COLS - 1 - move.col) : move.col;
    const x = offsetX + displayCol * CELL_SIZE;
    const y = offsetY + displayRow * CELL_SIZE;

    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 128, 0, 0.5)';
    ctx.fill();
  }

  // Draw highlighted move from PV hover
  if (highlightedMove) {
    const fromRow = flipped ? (ROWS - 1 - highlightedMove.from.row) : highlightedMove.from.row;
    const fromCol = flipped ? (COLS - 1 - highlightedMove.from.col) : highlightedMove.from.col;
    const toRow = flipped ? (ROWS - 1 - highlightedMove.to.row) : highlightedMove.to.row;
    const toCol = flipped ? (COLS - 1 - highlightedMove.to.col) : highlightedMove.to.col;

    // Draw "from" square highlight
    const fromX = offsetX + fromCol * CELL_SIZE;
    const fromY = offsetY + fromRow * CELL_SIZE;
    ctx.beginPath();
    ctx.arc(fromX, fromY, CELL_SIZE * 0.45, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw "to" square highlight
    const toX = offsetX + toCol * CELL_SIZE;
    const toY = offsetY + toRow * CELL_SIZE;
    ctx.beginPath();
    ctx.arc(toX, toY, CELL_SIZE * 0.45, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.8)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw arrow from source to destination
    drawArrow(fromX, fromY, toX, toY);
  }
}

// Draw an arrow between two points
function drawArrow(fromX, fromY, toX, toY) {
  const headLength = 15;
  const angle = Math.atan2(toY - fromY, toX - fromX);

  // Shorten the arrow so it doesn't overlap with circles
  const shortenBy = CELL_SIZE * 0.35;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const ratio = (length - shortenBy) / length;

  const endX = fromX + dx * ratio;
  const endY = fromY + dy * ratio;
  const startX = fromX + dx * (1 - ratio) * 0.5;
  const startY = fromY + dy * (1 - ratio) * 0.5;

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.strokeStyle = 'rgba(0, 200, 255, 0.7)';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Draw arrowhead
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(endX - headLength * Math.cos(angle - Math.PI / 6), endY - headLength * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(endX - headLength * Math.cos(angle + Math.PI / 6), endY - headLength * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fillStyle = 'rgba(0, 200, 255, 0.7)';
  ctx.fill();
}

// Draw a single piece
function drawPiece(col, row, piece, selected) {
  const x = BOARD_PADDING + col * CELL_SIZE;
  const y = BOARD_PADDING + row * CELL_SIZE;
  const radius = CELL_SIZE * 0.42;

  // Draw piece circle
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);

  // Piece background
  const gradient = ctx.createRadialGradient(x - 5, y - 5, 0, x, y, radius);
  gradient.addColorStop(0, '#f5e6c8');
  gradient.addColorStop(1, '#d4b896');
  ctx.fillStyle = gradient;
  ctx.fill();

  // Selected highlight
  if (selected) {
    ctx.strokeStyle = '#00aa00';
    ctx.lineWidth = 3;
  } else {
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 2;
  }
  ctx.stroke();

  // Draw piece character
  const pieceInfo = PIECES[piece.type];
  const char = piece.color === 'w' ? pieceInfo.char : pieceInfo.charBlack;

  ctx.fillStyle = piece.color === 'w' ? '#c41e3a' : '#1a1a1a';
  ctx.font = 'bold 24px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(char, x, y + 1);
}

// Handle canvas click
function handleClick(event) {
  if (isThinking) return;

  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left - BOARD_PADDING;
  const y = event.clientY - rect.top - BOARD_PADDING;

  let col = Math.round(x / CELL_SIZE);
  let row = Math.round(y / CELL_SIZE);

  // Adjust for flipped board
  if (flipped) {
    col = COLS - 1 - col;
    row = ROWS - 1 - row;
  }

  // Check bounds
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;

  const piece = board[row][col];

  // Check if clicking on a legal move
  const isLegalMove = legalMoves.some(m => m.row === row && m.col === col);

  if (selectedPiece && isLegalMove) {
    // Make the move
    makeMove(selectedPiece.row, selectedPiece.col, row, col);
    selectedPiece = null;
    legalMoves = [];
  } else if (piece && piece.color === currentTurn) {
    // Select the piece
    selectedPiece = { row, col };
    legalMoves = getLegalMoves(row, col);
  } else {
    // Deselect
    selectedPiece = null;
    legalMoves = [];
  }

  drawBoard();
}

// Get pseudo-legal moves for a piece (simplified - doesn't check all rules)
function getLegalMoves(row, col) {
  const piece = board[row][col];
  if (!piece) return [];

  const moves = [];
  const color = piece.color;

  switch (piece.type) {
    case 'K': // King
      const kingMoves = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      for (const [dr, dc] of kingMoves) {
        const nr = row + dr;
        const nc = col + dc;
        // Must stay in palace
        const palaceRowMin = color === 'w' ? 7 : 0;
        const palaceRowMax = color === 'w' ? 9 : 2;
        if (nc >= 3 && nc <= 5 && nr >= palaceRowMin && nr <= palaceRowMax) {
          if (!board[nr][nc] || board[nr][nc].color !== color) {
            moves.push({ row: nr, col: nc });
          }
        }
      }
      break;

    case 'A': // Advisor
      const advisorMoves = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
      for (const [dr, dc] of advisorMoves) {
        const nr = row + dr;
        const nc = col + dc;
        const palaceRowMin = color === 'w' ? 7 : 0;
        const palaceRowMax = color === 'w' ? 9 : 2;
        if (nc >= 3 && nc <= 5 && nr >= palaceRowMin && nr <= palaceRowMax) {
          if (!board[nr][nc] || board[nr][nc].color !== color) {
            moves.push({ row: nr, col: nc });
          }
        }
      }
      break;

    case 'B': // Bishop/Elephant
      const bishopMoves = [[2, 2], [2, -2], [-2, 2], [-2, -2]];
      const bishopBlocks = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
      for (let i = 0; i < bishopMoves.length; i++) {
        const [dr, dc] = bishopMoves[i];
        const [br, bc] = bishopBlocks[i];
        const nr = row + dr;
        const nc = col + dc;
        // Can't cross river
        const riverLimit = color === 'w' ? 4 : 5;
        const validRow = color === 'w' ? nr >= riverLimit : nr <= riverLimit;
        if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS && validRow) {
          if (!board[row + br][col + bc]) { // Not blocked
            if (!board[nr][nc] || board[nr][nc].color !== color) {
              moves.push({ row: nr, col: nc });
            }
          }
        }
      }
      break;

    case 'N': // Knight
      const knightMoves = [
        [-2, -1, -1, 0], [-2, 1, -1, 0],
        [2, -1, 1, 0], [2, 1, 1, 0],
        [-1, -2, 0, -1], [-1, 2, 0, 1],
        [1, -2, 0, -1], [1, 2, 0, 1]
      ];
      for (const [dr, dc, br, bc] of knightMoves) {
        const nr = row + dr;
        const nc = col + dc;
        if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS) {
          if (!board[row + br][col + bc]) { // Not blocked
            if (!board[nr][nc] || board[nr][nc].color !== color) {
              moves.push({ row: nr, col: nc });
            }
          }
        }
      }
      break;

    case 'R': // Rook
      for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        let nr = row + dr;
        let nc = col + dc;
        while (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS) {
          if (board[nr][nc]) {
            if (board[nr][nc].color !== color) {
              moves.push({ row: nr, col: nc });
            }
            break;
          }
          moves.push({ row: nr, col: nc });
          nr += dr;
          nc += dc;
        }
      }
      break;

    case 'C': // Cannon
      for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        let nr = row + dr;
        let nc = col + dc;
        let jumped = false;
        while (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS) {
          if (board[nr][nc]) {
            if (jumped) {
              if (board[nr][nc].color !== color) {
                moves.push({ row: nr, col: nc });
              }
              break;
            } else {
              jumped = true;
            }
          } else if (!jumped) {
            moves.push({ row: nr, col: nc });
          }
          nr += dr;
          nc += dc;
        }
      }
      break;

    case 'P': // Pawn
      const forward = color === 'w' ? -1 : 1;
      const crossedRiver = color === 'w' ? row <= 4 : row >= 5;

      // Forward move
      const nrForward = row + forward;
      if (nrForward >= 0 && nrForward < ROWS) {
        if (!board[nrForward][col] || board[nrForward][col].color !== color) {
          moves.push({ row: nrForward, col: col });
        }
      }

      // Sideways after crossing river
      if (crossedRiver) {
        for (const dc of [-1, 1]) {
          const nc = col + dc;
          if (nc >= 0 && nc < COLS) {
            if (!board[row][nc] || board[row][nc].color !== color) {
              moves.push({ row: row, col: nc });
            }
          }
        }
      }
      break;
  }

  return moves;
}

// Make a move
function makeMove(fromRow, fromCol, toRow, toCol) {
  const piece = board[fromRow][fromCol];
  const captured = board[toRow][toCol];

  // Save position for undo
  positionHistory.push(boardToFEN());

  // Update board
  board[toRow][toCol] = piece;
  board[fromRow][fromCol] = null;

  // Record move
  const moveUCI = posToUCI(fromRow, fromCol) + posToUCI(toRow, toCol);
  moveHistory.push({
    uci: moveUCI,
    piece: piece,
    captured: captured,
    color: currentTurn
  });

  // Switch turn
  currentTurn = currentTurn === 'w' ? 'b' : 'w';

  // Update UI
  updateMoveList();
  updateTurnIndicator();

  // Auto-analyze or play engine move
  const playVsEngine = document.getElementById('play-vs-engine').checked;
  const autoAnalyze = document.getElementById('auto-analyze').checked;

  if (playVsEngine && currentTurn === 'b') {
    requestEngineMove();
  } else if (autoAnalyze) {
    analyzePosition();
  }
}

// Make a move from UCI notation
function makeMoveUCI(uci) {
  const from = uciToPos(uci.substring(0, 2));
  const to = uciToPos(uci.substring(2, 4));

  if (board[from.row][from.col]) {
    makeMove(from.row, from.col, to.row, to.col);
    selectedPiece = null;
    legalMoves = [];
    drawBoard();
  }
}

// Undo last move
function undoMove() {
  if (positionHistory.length === 0) return;

  const previousFEN = positionHistory.pop();
  const result = parseFEN(previousFEN);
  board = result.board;
  currentTurn = result.turn;
  moveHistory.pop();

  selectedPiece = null;
  legalMoves = [];

  updateMoveList();
  updateTurnIndicator();
  drawBoard();

  if (document.getElementById('auto-analyze').checked) {
    analyzePosition();
  }
}

// Update move list display
function updateMoveList() {
  const moveList = document.getElementById('move-list');
  moveList.innerHTML = '';

  moveHistory.forEach((move, index) => {
    const span = document.createElement('span');
    span.className = `move ${move.color === 'w' ? 'red' : 'black'}`;
    span.textContent = move.uci;
    span.onclick = () => goToMove(index);
    moveList.appendChild(span);
  });

  moveList.scrollTop = moveList.scrollHeight;
}

// Update turn indicator
function updateTurnIndicator() {
  const indicator = document.getElementById('turn-indicator');
  indicator.textContent = currentTurn === 'w' ? 'Red to move' : 'Black to move';
  indicator.className = currentTurn === 'w' ? 'red' : 'black';
}

// Go to a specific move
function goToMove(index) {
  // Reset to start
  const result = parseFEN(START_FEN);
  board = result.board;
  currentTurn = result.turn;

  // Replay moves up to index
  const movesToReplay = moveHistory.slice(0, index + 1);
  moveHistory = [];
  positionHistory = [];

  for (const move of movesToReplay) {
    const from = uciToPos(move.uci.substring(0, 2));
    const to = uciToPos(move.uci.substring(2, 4));
    makeMove(from.row, from.col, to.row, to.col);
  }

  selectedPiece = null;
  legalMoves = [];
  drawBoard();
}

// Start a new game
function newGame() {
  const result = parseFEN(START_FEN);
  board = result.board;
  currentTurn = result.turn;
  selectedPiece = null;
  legalMoves = [];
  moveHistory = [];
  positionHistory = [];

  updateMoveList();
  updateTurnIndicator();
  drawBoard();

  // Clear analysis
  document.getElementById('depth').textContent = '-';
  clearPVLines();

  if (document.getElementById('auto-analyze').checked) {
    analyzePosition();
  }
}

// Flip the board
function flipBoard() {
  flipped = !flipped;
  drawBoard();
}

// Engine communication
function analyzePosition() {
  if (!engineReady) return;

  const fen = boardToFEN();
  const moves = moveHistory.map(m => m.uci).join(' ');
  const thinkTime = document.getElementById('think-time').value;

  // Stop any current search
  window.engine.send('stop');

  // Set position and search
  if (moveHistory.length > 0) {
    window.engine.send(`position startpos moves ${moves}`);
  } else {
    window.engine.send('position startpos');
  }
  window.engine.send(`go movetime ${thinkTime}`);
}

function requestEngineMove() {
  if (!engineReady) return;

  isThinking = true;
  document.getElementById('status').textContent = 'Engine thinking...';

  const moves = moveHistory.map(m => m.uci).join(' ');
  const thinkTime = document.getElementById('think-time').value;

  window.engine.send('stop');

  if (moveHistory.length > 0) {
    window.engine.send(`position startpos moves ${moves}`);
  } else {
    window.engine.send('position startpos');
  }
  window.engine.send(`go movetime ${thinkTime}`);
}

function getHint() {
  if (!engineReady) return;

  isThinking = true;
  document.getElementById('status').textContent = 'Calculating hint...';

  analyzePosition();
}

// Clear all PV lines
function clearPVLines() {
  for (let i = 1; i <= 3; i++) {
    const pvLine = document.getElementById(`pv-${i}`);
    if (pvLine) {
      pvLine.querySelector('.pv-move').textContent = '-';
      pvLine.querySelector('.pv-eval').textContent = '-';
      pvLine.querySelector('.pv-eval').className = 'pv-eval';
      pvLine.querySelector('.pv-continuation').textContent = '-';
    }
  }
}

// Handle engine output
function handleEngineOutput(line) {
  const output = document.getElementById('engine-output');
  output.textContent += line + '\n';
  output.scrollTop = output.scrollHeight;

  // Parse UCI responses
  if (line === 'uciok') {
    engineReady = true;
    updateEngineStatus('connected', 'Engine ready');
    // Enable MultiPV mode for learning
    window.engine.send('setoption name MultiPV value 3');
    window.engine.send('isready');
  } else if (line === 'readyok') {
    if (document.getElementById('auto-analyze').checked) {
      analyzePosition();
    }
  } else if (line.startsWith('info') && line.includes('pv')) {
    parseInfoLine(line);
  } else if (line.startsWith('bestmove')) {
    const parts = line.split(' ');
    const bestMove = parts[1];

    isThinking = false;
    document.getElementById('status').textContent = '';

    // If playing vs engine and it's engine's turn, make the move
    const playVsEngine = document.getElementById('play-vs-engine').checked;
    if (playVsEngine && currentTurn === 'b') {
      setTimeout(() => makeMoveUCI(bestMove), 300);
    }
  }
}

function parseInfoLine(line) {
  const parts = line.split(' ');

  let multipv = 1;
  let depth = null;
  let score = null;
  let isMate = false;
  let pv = [];

  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === 'multipv') {
      multipv = parseInt(parts[i + 1]);
    } else if (parts[i] === 'depth') {
      depth = parts[i + 1];
    } else if (parts[i] === 'score') {
      if (parts[i + 1] === 'cp') {
        score = parseInt(parts[i + 2]);
      } else if (parts[i + 1] === 'mate') {
        score = parseInt(parts[i + 2]);
        isMate = true;
      }
    } else if (parts[i] === 'pv') {
      pv = parts.slice(i + 1);
      break;
    }
  }

  // Update depth (only from first PV line)
  if (multipv === 1 && depth) {
    document.getElementById('depth').textContent = depth;
  }

  // Update the correct PV line
  if (multipv >= 1 && multipv <= 3 && pv.length > 0) {
    const pvLine = document.getElementById(`pv-${multipv}`);
    if (pvLine) {
      const moveEl = pvLine.querySelector('.pv-move');
      const evalEl = pvLine.querySelector('.pv-eval');
      const contEl = pvLine.querySelector('.pv-continuation');

      // First move
      moveEl.textContent = pv[0];

      // Evaluation
      let evalText;
      let evalValue;
      if (isMate) {
        evalText = `M${Math.abs(score)}`;
        evalValue = score > 0 ? 1000 : -1000;
      } else {
        // Adjust eval to always be from Red's perspective
        evalValue = currentTurn === 'w' ? score : -score;
        evalText = (evalValue >= 0 ? '+' : '') + (evalValue / 100).toFixed(2);
      }
      evalEl.textContent = evalText;
      evalEl.className = 'pv-eval' + (evalValue < 0 ? ' negative' : '');

      // Continuation (remaining moves)
      contEl.textContent = pv.slice(1, 6).join(' ');
    }
  }
}

function handleEngineError(error) {
  updateEngineStatus('error', `Error: ${error}`);
}

function updateEngineStatus(status, message) {
  const statusEl = document.getElementById('engine-status');
  statusEl.textContent = message;
  statusEl.className = `engine-status ${status}`;
}

// Initialize
function init() {
  // Parse starting position
  const result = parseFEN(START_FEN);
  board = result.board;
  currentTurn = result.turn;

  // Set up event listeners
  canvas.addEventListener('click', handleClick);
  document.getElementById('new-game').addEventListener('click', newGame);
  document.getElementById('flip-board').addEventListener('click', flipBoard);
  document.getElementById('undo-move').addEventListener('click', undoMove);
  document.getElementById('get-hint').addEventListener('click', getHint);

  // PV line hover event listeners
  for (let i = 1; i <= 3; i++) {
    const pvLine = document.getElementById(`pv-${i}`);
    if (pvLine) {
      pvLine.addEventListener('mouseenter', () => {
        const moveText = pvLine.querySelector('.pv-move').textContent;
        if (moveText && moveText !== '-' && moveText.length >= 4) {
          const from = uciToPos(moveText.substring(0, 2));
          const to = uciToPos(moveText.substring(2, 4));
          highlightedMove = { from, to };
          drawBoard();
        }
      });
      pvLine.addEventListener('mouseleave', () => {
        highlightedMove = null;
        drawBoard();
      });
    }
  }

  // Engine event listeners
  window.engine.onOutput(handleEngineOutput);
  window.engine.onError(handleEngineError);

  // Initial draw
  updateTurnIndicator();
  drawBoard();

  updateEngineStatus('connecting', 'Connecting to engine...');

  // Request engine start (will reinitialize UCI if already running)
  window.engine.start();
}

// Start the app
init();
