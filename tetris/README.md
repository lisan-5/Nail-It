# Simple Tetris (Vanilla JS)

A minimal, dependency-free Tetris you can run in any modern browser.

## Run

Option 1: Open directly
- Open `index.html` in your browser.

Option 2: Serve locally (recommended)
- Python: `python3 -m http.server 8000` (then open http://localhost:8000/tetris/)
- Node (if installed): `npx serve .` (then open the printed URL)

## Controls
- Left/Right: Move
- Down: Soft drop
- Up: Rotate clockwise
- Z: Rotate counter-clockwise
- Space: Hard drop
- P: Pause
- R: Reset

## Notes
- 7-bag randomizer for fair piece distribution
- Scoring and level speed-up included