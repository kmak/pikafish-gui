# Pikafish GUI

A desktop GUI for the [Pikafish](https://github.com/official-pikafish/Pikafish) Xiangqi (Chinese Chess) engine, built with Electron.

## Features

- Interactive board with traditional Chinese piece characters
- MultiPV analysis showing top 3 candidate moves with evaluations
- Hover highlighting - hover over PV moves to see them on the board
- Click-to-play - click any candidate move to execute it
- Play vs Engine mode (you play Red)
- Auto-analyze positions after each move
- Move history with click-to-navigate
- Flip board support
- Evaluation bar showing position assessment

## Prerequisites

- Node.js (v18 or later recommended)
- npm

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/pikafish-gui.git
   cd pikafish-gui
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the app**
   ```bash
   npm start
   ```

## Building for Distribution

To package the app as a standalone application:

```bash
npm run build
```

This creates a distributable package for your platform (macOS DMG by default).

## Project Structure

```
pikafish-gui/
├── main.js           # Electron main process
├── preload.js        # Secure IPC bridge
├── src/
│   ├── index.html    # UI layout
│   ├── renderer.js   # Board logic, UCI parsing
│   └── style.css     # Dark theme styling
└── engine/
    ├── pikafish      # Engine binary (macOS Apple Silicon)
    └── pikafish.nnue # Neural network weights
```

## How It Works

The app spawns Pikafish as a child process and communicates with it using the UCI (Universal Chess Interface) protocol. The renderer process handles the board display and user interaction, while the main process manages engine communication.

## License

GPL-3.0
