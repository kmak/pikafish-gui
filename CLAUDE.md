# Pikafish GUI

A desktop GUI for the Pikafish Xiangqi (Chinese Chess) engine, built with Electron.

## Project Overview

This is a learning-focused Xiangqi application that wraps the Pikafish engine (a Stockfish derivative for Xiangqi) in an Electron desktop app with an HTML/CSS/JS frontend.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 Electron App                     │
├─────────────────────────────────────────────────┤
│  Renderer Process (src/)                        │
│  - index.html: UI layout                        │
│  - renderer.js: Board logic, UCI parsing        │
│  - style.css: Styling                           │
│                      ▲                          │
│                      │ IPC (preload.js)         │
│                      ▼                          │
│  Main Process (main.js)                         │
│  - Spawns Pikafish as child process             │
│  - Routes UCI commands/responses                │
│                      ▲                          │
│                      │ stdin/stdout             │
│                      ▼                          │
│  engine/pikafish + pikafish.nnue                │
└─────────────────────────────────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `main.js` | Electron main process - spawns engine, handles IPC |
| `preload.js` | Secure bridge between main and renderer processes |
| `src/index.html` | UI structure |
| `src/renderer.js` | Board rendering, game logic, UCI communication |
| `src/style.css` | Dark theme styling |
| `engine/pikafish` | Pikafish binary (macOS Apple Silicon) |
| `engine/pikafish.nnue` | Neural network weights (~53MB) |

## UCI Protocol

The engine communicates via UCI (Universal Chess Interface):

```
→ uci                              # Initialize
← uciok

→ setoption name MultiPV value 3   # Enable 3 best lines
→ isready
← readyok

→ position startpos moves h2e2     # Set position
→ go movetime 2000                 # Search for 2 seconds
← info depth 15 multipv 1 score cp 45 pv h2e2 h9g7 ...
← info depth 15 multipv 2 score cp 30 pv b2e2 ...
← info depth 15 multipv 3 score cp 25 pv h0g2 ...
← bestmove h2e2
```

### Move Notation

Moves are in coordinate format: `[file][rank][file][rank]`
- Files: a-i (left to right)
- Ranks: 0-9 (bottom to top from Red's view)
- Example: `h2e2` = piece at h2 moves to e2

## Board Layout

```
  a b c d e f g h i
9 車馬象士将士象馬車   ← Black back rank
8 . . . . . . . . .
7 . 砲 . . . . . 砲 .   ← Black cannons
6 卒 . 卒 . 卒 . 卒 . 卒
5 ─ ─ ─ RIVER ─ ─ ─ ─
4 ─ ─ ─ ─ ─ ─ ─ ─ ─
3 兵 . 兵 . 兵 . 兵 . 兵
2 . 炮 . . . . . 炮 .   ← Red cannons (b2, h2)
1 . . . . . . . . .
0 车马相仕帅仕相马车   ← Red back rank
  a b c d e f g h i
```

## Features

- **Interactive board** with traditional Chinese piece characters
- **MultiPV analysis** showing top 3 candidate moves with evaluations
- **Hover highlighting** - hover over PV moves to see them on the board
- **Click-to-play** - click any candidate move to execute it
- **Play vs Engine** mode (you play Red)
- **Auto-analyze** positions after each move
- **Move history** with click-to-navigate
- **Flip board** support
- **Axis labels** (a-i files, 0-9 ranks)

## Development

```bash
# Install dependencies
npm install

# Run the app
npm start

# Package for distribution
npm run build
```

## Piece Types

| Abbrev | Red | Black | Name |
|--------|-----|-------|------|
| K | 帅 | 将 | King/General |
| A | 仕 | 士 | Advisor |
| B | 相 | 象 | Bishop/Elephant |
| N | 马 | 馬 | Knight/Horse |
| R | 车 | 車 | Rook/Chariot |
| C | 炮 | 砲 | Cannon |
| P | 兵 | 卒 | Pawn/Soldier |

## Engine Settings

- **MultiPV**: 3 (shows top 3 moves)
- **Think Time**: Configurable (default 2000ms)
- **NNUE**: Uses pikafish.nnue for neural network evaluation

## Future Enhancements

- Sound effects for moves/captures
- Save/load games
- Opening book support
- Move translation (show piece names instead of raw UCI)
- Blunder detection
- Game database integration
