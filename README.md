# ♞ Chess vs Computer / Cờ Vua

Play international chess against the computer, right in the browser.
Built with Next.js and deployed on Vercel.

## Features

- **Full chess rules**: castling, en passant, pawn promotion (with a choice
  dialog), check, checkmate, stalemate, fifty-move rule and
  insufficient-material draws
- **Fight animations**: pieces glide across the board; captures trigger a
  clash burst with the victim sent flying and the board shaking; checks pop a
  ⚔ badge over the king; checkmate slams in a dramatic banner
- **10 difficulty levels** (Level 1 beginner → Level 10 relentless deep
  search), with an animated thinking indicator and live search stats
- **Bilingual UI** — English and Vietnamese, EN/VI toggle, browser-language
  auto-detect, choice remembered
- **3D board and pieces**: gradient-shaded Staunton-style glyphs with gloss
  highlights and drop shadows on a beveled wooden board
- **Full-screen layout**: the board scales to fill your screen, info panel
  docked on the right
- Play as White or Black (board flips), undo, SAN move list, captured pieces

## How the AI works

`lib/chess/ai.ts` implements negamax search with alpha-beta pruning,
MVV-LVA move ordering and piece-square-table evaluation. Difficulty scales
the search depth from 1 ply (Level 1) up to 4 plies with a time cap
(Level 10); lower levels add randomness so the computer makes human-like
mistakes.

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Project layout

```
app/                    # Next.js App Router (page, layout, styles)
components/chess/       # Board.tsx (3D SVG board + fight animations),
                        # ChessGame.tsx (game state, AI wiring, i18n)
lib/chess/              # engine.ts (rules), ai.ts (search), i18n.ts,
                        # notation.ts (SAN), types.ts
```
