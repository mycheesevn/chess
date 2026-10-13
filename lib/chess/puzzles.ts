// Daily chess puzzles: mate-in-1 positions, machine-verified.
// Each puzzle = a legal setup sequence from the initial position
// plus the mating solution move (UCI). Generated + verified by script.

import type { Color } from "./types";

export interface ChessPuzzle {
  id: string;
  /** UCI moves from the initial position leading to the puzzle. */
  setup: string[];
  /** UCI mating move (canonical solution). Any checkmating move counts. */
  solution: string;
  turn: Color;
  titleVi: string;
  titleEn: string;
}

export const PUZZLES: ChessPuzzle[] = [
  {
    id: "mate-001",
    setup: ["b2b3", "a7a5", "a2a4", "b7b6", "a1a2", "b6b5", "f2f4", "b5b4", "b1c3", "c7c6", "c3b5", "b8a6", "e2e4", "f7f5", "f1e2", "a6c7", "e2f1", "c7b5", "f1d3", "f5e4", "g2g3", "h7h6", "d3c4", "h6h5", "c2c3", "a8a6", "a2b2", "b5a7", "b2a2", "g7g6", "a2a1", "h5h4", "d1h5", "a7b5"],
    solution: "h5g6",
    turn: "white",
    titleVi: "Trắng đi, Hậu chiếu hết trong 1 nước",
    titleEn: "White to move, mate in 1 by Queen",
  },
  {
    id: "mate-002",
    setup: ["c2c3", "g8f6", "c3c4", "f6d5", "e2e3", "d5c3", "f2f4", "c3a2", "g2g3", "a2c1", "f4f5", "g7g5", "d1c1", "a7a5", "b1c3", "a8a7", "c4c5", "h7h6", "h2h3", "d7d6", "c5d6", "c7d6", "d2d4", "h8h7", "g1f3", "b8a6", "c3b1", "d6d5", "a1a5", "a6b8", "a5a2", "a7a2", "b1c3", "a2b2", "e3e4", "b2d2", "c3d5", "d8b6", "c1b2", "b6d4", "d5e3", "b7b5", "f1b5", "b8c6", "b2a2", "f8g7", "f3g5", "c8a6", "b5c6", "e8d8", "a2f7"],
    solution: "d4e3",
    turn: "black",
    titleVi: "Đen đi, Hậu chiếu hết trong 1 nước",
    titleEn: "Black to move, mate in 1 by Queen",
  },
  {
    id: "mate-003",
    setup: ["b2b4", "g7g6", "c1a3", "h7h5", "g2g3", "g6g5", "d2d4", "c7c6", "b1c3", "d7d6", "b4b5", "e8d7", "d1d3", "g5g4", "d3e4", "a7a5", "c3d5", "b8a6", "b5c6", "d7e8", "a1c1", "f8h6", "c6b7", "h6g5", "b7a8b", "e7e6", "c2c3", "g5c1", "a3c1", "e6e5", "e4g4", "f7f6", "g4g6", "e8f8", "d5f4", "g8e7", "f4d3", "h8h6"],
    solution: "c1h6",
    turn: "white",
    titleVi: "Trắng đi, Tượng chiếu hết trong 1 nước",
    titleEn: "White to move, mate in 1 by Bishop",
  },
  {
    id: "mate-004",
    setup: ["g1h3", "g7g5", "d2d3", "f7f6", "g2g4", "f6f5", "g4f5", "b7b6", "a2a4", "f8g7", "d3d4", "a7a5", "h3f4", "a8a6", "f4h3", "h7h6", "b2b3", "g5g4", "e1d2", "g4g3", "f5f6", "e8f8", "f2f4", "h6h5", "f6g7", "f8g7", "b3b4", "g7f7", "d2e3", "d7d6", "c1d2", "g8h6", "a1a3", "d8d7", "d4d5", "a5b4", "c2c3", "c7c6", "d1c2", "a6a4", "a3a2", "h8d8", "e3d4", "e7e5", "d5e6", "d7e6", "b1a3", "e6d5", "d4e3"],
    solution: "h6g4",
    turn: "black",
    titleVi: "Đen đi, Mã chiếu hết trong 1 nước",
    titleEn: "Black to move, mate in 1 by Knight",
  },
  {
    id: "mate-005",
    setup: ["b1c3", "g7g5", "g1f3", "b7b5", "a2a4", "c8a6", "f3d4", "a6b7", "a1a3", "f8h6", "d4f5", "b7f3", "h2h3", "h6f8", "f5d4", "c7c6", "g2f3", "g8h6", "a4b5", "h6f5", "d2d3", "h8g8", "b2b4", "g8g7", "h3h4", "f5h6", "c1g5", "d8a5", "c3a2", "g7g8", "b5b6", "a5a3", "d4b3", "a3b2", "g5h6", "b2c2", "d3d4", "c2e2", "f1e2", "g8g4", "b3c5", "g4g5", "h1h2", "g5c5", "h4h5", "b8a6", "d4d5", "c5b5", "e2b5", "f8g7", "h2g2", "g7d4"],
    solution: "g2g8",
    turn: "white",
    titleVi: "Trắng đi, Xe chiếu hết trong 1 nước",
    titleEn: "White to move, mate in 1 by Rook",
  },
  {
    id: "mate-006",
    setup: ["b1c3", "c7c5", "f2f4", "h7h5", "g1f3", "h8h6", "e2e3", "h6h7", "g2g3", "d8b6", "f1g2", "d7d5", "a2a3", "b6e6", "b2b3", "a7a6", "h2h3", "h7h8", "a1a2", "e6g6", "h3h4", "g8f6", "a2a1", "g6g4", "f3d4", "h8g8", "h1g1", "g4f4", "d4e6", "f4g3", "e1f1", "b8d7", "e6d4", "a8a7", "g2d5", "f6d5", "d4f3", "g3f3", "f1e1", "d7e5", "g1g3", "d5b4", "a1b1", "f3h1", "e1e2", "h1g1", "g3g7", "f7f6", "g7g4"],
    solution: "c8g4",
    turn: "black",
    titleVi: "Đen đi, Tượng chiếu hết trong 1 nước",
    titleEn: "Black to move, mate in 1 by Bishop",
  },
  {
    id: "mate-007",
    setup: ["a2a4", "c7c6", "f2f4", "c6c5", "b2b3", "h7h5", "f4f5", "e7e5", "b1a3", "g7g5", "f5f6", "g8e7", "e2e3", "e7g8", "d1h5", "d8f6", "g2g3", "h8h6", "f1e2", "e5e4", "h5g5", "f6e7", "e1f1", "e7e6", "f1g2", "e6e5", "e2b5", "h6h2", "g2f1", "h2h3", "b5c6", "a7a5", "c1b2", "b7b5", "g5g7", "f7f6", "g7f6", "b5a4", "c6a8", "e5g3", "f6f4", "g3g1", "f1g1", "h3h1", "g1g2", "g8e7", "a3c4", "h1f1", "f4e4", "c8a6", "g2f1", "e8f7", "d2d3", "a4b3", "e4g4", "b3c2"],
    solution: "c4d6",
    turn: "white",
    titleVi: "Trắng đi, Mã chiếu hết trong 1 nước",
    titleEn: "White to move, mate in 1 by Knight",
  },
  {
    id: "mate-008",
    setup: ["g1f3", "g8f6", "g2g4", "c7c6", "g4g5", "h7h6", "h2h4", "b7b6", "e2e3", "h6g5", "f1b5", "f6e4", "c2c4", "h8h4", "d1e2", "h4h3", "b1a3", "h3g3", "f3h4", "g3h3", "f2f4", "a7a5", "d2d3", "d7d6", "c1d2", "e4c3", "a3c2", "c8g4", "c2d4", "c3d1", "e1f1", "f7f5", "f4g5", "g4f3", "e2e1"],
    solution: "h3h1",
    turn: "black",
    titleVi: "Đen đi, Xe chiếu hết trong 1 nước",
    titleEn: "Black to move, mate in 1 by Rook",
  },
  {
    id: "mate-009",
    setup: ["a2a4", "c7c5", "d2d4", "h7h5", "a4a5", "d8a5", "a1a5", "g7g6", "c2c3", "f8g7", "d4c5", "g7e5", "b2b4", "e8f8", "c1f4", "g6g5", "f4g5", "b7b6", "f2f3", "b6a5", "g1h3", "e5g7", "d1d2", "g7e5", "d2d7", "h8h6", "h3f2", "e5c3", "d7d2", "f8g7", "b1c3", "c8g4", "c3d1", "g7f8", "d2d3", "h6a6", "f2g4", "a6b6", "d3d8", "f8g7", "d8c7", "h5g4", "e2e4", "a5a4", "d1b2", "g7h7", "f3f4", "b6b4", "b2a4", "h7g7", "g5h6", "g7h6", "c7e7", "b4c4", "a4c3", "c4c3", "f1d3", "h6g6", "h2h4", "g6h7", "e7f6", "c3c2"],
    solution: "e4e5",
    turn: "white",
    titleVi: "Trắng đi, Tốt chiếu hết trong 1 nước",
    titleEn: "White to move, mate in 1 by Pawn",
  },
  {
    id: "mate-010",
    setup: ["d2d3", "e7e5", "d3d4", "h7h5", "g1h3", "h8h6", "c1f4", "f8b4", "d1d2", "b4d2", "f4d2", "b8a6", "b2b3", "g8f6", "d4e5", "h5h4", "d2h6", "f6h7", "h3g5", "d7d5", "h6g7", "d8f6", "g7f6", "a6b8", "g5h7", "d5d4", "f6h8", "d4d3", "e5e6", "b8c6", "e1d1", "d3c2", "d1e1"],
    solution: "c2c1q",
    turn: "black",
    titleVi: "Đen đi, Tốt chiếu hết trong 1 nước",
    titleEn: "Black to move, mate in 1 by Pawn",
  },
  {
    id: "mate-011",
    setup: ["b2b4", "a7a5", "e2e4", "f7f5", "b1a3", "a8a7", "h2h4", "h7h6", "d2d3", "a5b4", "c2c3", "b4a3", "e4e5", "a7a5", "d1h5", "g7g6"],
    solution: "h5g6",
    turn: "white",
    titleVi: "Trắng đi, Hậu chiếu hết trong 1 nước",
    titleEn: "White to move, mate in 1 by Queen",
  },
  {
    id: "mate-012",
    setup: ["d2d4", "a7a5", "d1d2", "c7c6", "g2g4", "g8h6", "d2h6", "g7h6", "c1h6", "a8a6", "c2c4", "d8c7", "h6g7", "c6c5", "b2b3", "c7d8", "d4c5", "h8g8", "g7e5", "f8h6", "f2f3", "h6d2", "e1d2", "g8g5", "a2a3", "f7f6", "e5b2", "d7d5", "c4d5", "c8e6", "b3b4", "h7h5", "b2f6", "a5a4", "f6g5", "b8c6", "d2d3", "a6b6", "g5e7", "e6d5", "f3f4", "d5g2", "d3e3"],
    solution: "d8d4",
    turn: "black",
    titleVi: "Đen đi, Hậu chiếu hết trong 1 nước",
    titleEn: "Black to move, mate in 1 by Queen",
  },
  {
    id: "mate-013",
    setup: ["g1h3", "g7g5", "a2a3", "f7f5", "a1a2", "d7d5", "e2e4", "b7b6", "f1b5", "c8d7"],
    solution: "d1h5",
    turn: "white",
    titleVi: "Trắng đi, Hậu chiếu hết trong 1 nước",
    titleEn: "White to move, mate in 1 by Queen",
  },
  {
    id: "mate-014",
    setup: ["d2d4", "e7e6", "g1f3", "g8e7", "e1d2", "e7g6", "b1a3", "f8a3", "f3e5", "a7a6", "f2f4", "g6h4", "e5d7", "h4f3", "d2d3", "a6a5", "e2f3", "a5a4", "d3e2", "a3e7", "e2d3", "e6e5", "a1b1", "e5f4", "d3d2", "a8a5", "d7b8", "h7h6", "d2e1", "c7c6", "h2h4", "e7h4", "e1d2", "e8e7", "d2d3", "h4f6", "d1e2", "f6e5", "d3c3"],
    solution: "d8d4",
    turn: "black",
    titleVi: "Đen đi, Hậu chiếu hết trong 1 nước",
    titleEn: "Black to move, mate in 1 by Queen",
  },
  {
    id: "mate-015",
    setup: ["c2c3", "e7e6", "h2h3", "d7d6", "h3h4", "c8d7", "a2a4", "d8c8", "b2b3", "e8e7", "f2f3", "d7b5", "b3b4", "b5e2", "a1a3", "e7f6", "d2d4", "f6f5", "b1d2", "h7h6", "d1c2", "f5f4", "g1h3", "f4g3", "c2d3", "b7b5", "a3b3", "c8a6", "b3b1", "a6b6", "e1e2", "b8c6", "e2d1", "g3h4", "d3e4", "h4h5"],
    solution: "e4g4",
    turn: "white",
    titleVi: "Trắng đi, Hậu chiếu hết trong 1 nước",
    titleEn: "White to move, mate in 1 by Queen",
  },
  {
    id: "mate-016",
    setup: ["c2c4", "e7e6", "h2h3", "e8e7", "c4c5", "e7f6", "d2d4", "a7a6", "g2g3", "f6e7", "e2e4", "f7f5", "g1e2", "h7h6", "f2f4", "c7c6", "h1h2", "d8e8", "e4f5", "e7d8", "c1e3", "g7g6", "e3f2", "e8e7", "f5g6", "d8e8", "d1d3", "h8h7", "d3d2", "e6e5", "d4e5", "e7g5", "d2d7", "h7d7", "a2a3", "g5e5", "f1g2", "e8e7", "g2f1", "e5d5", "e2c3", "b7b6", "f1g2", "c8b7", "c3e2"],
    solution: "d5d1",
    turn: "black",
    titleVi: "Đen đi, Hậu chiếu hết trong 1 nước",
    titleEn: "Black to move, mate in 1 by Queen",
  },
  {
    id: "mate-017",
    setup: ["a2a4", "g8f6", "g1h3", "d7d6", "b2b3", "e7e5", "c1b2", "c8d7", "h1g1", "d7h3", "d2d4", "h3g4", "b2c3", "a7a6", "d1c1", "e5d4", "c3a5", "g4f5", "h2h3", "b8d7", "b1d2", "f8e7", "c2c3", "h7h6", "c1a3", "f5c2", "a3d6", "h6h5", "d6d5", "d7e5", "d5b5", "e5d7", "b5h5", "f6e4", "h5b5", "e4f2", "b5c5", "c2g6", "c3d4", "d7b8", "a1c1", "g6h5", "a5c7", "b8d7", "c5c3", "d8c7", "e1f2", "c7c5", "c3e3", "d7f8", "e3d3", "c5c4", "g2g3", "c4b3", "d3b3", "f8g6", "b3b7", "e7d8", "b7a8", "h8h6", "a8b8", "h5g4", "e2e3", "h6h8", "c1c2", "e8f8"],
    solution: "b8d8",
    turn: "white",
    titleVi: "Trắng đi, Hậu chiếu hết trong 1 nước",
    titleEn: "White to move, mate in 1 by Queen",
  },
  {
    id: "mate-018",
    setup: ["b2b3", "g8f6", "c1a3", "g7g6", "f2f3", "b7b5", "g2g3", "c8a6", "b1c3", "f6h5", "a3c5", "h7h6", "a2a3", "g6g5", "c3d5", "b8c6", "d5c7", "d8c7", "h2h4", "c7b8", "c5e7"],
    solution: "b8g3",
    turn: "black",
    titleVi: "Đen đi, Hậu chiếu hết trong 1 nước",
    titleEn: "Black to move, mate in 1 by Queen",
  },
  {
    id: "mate-019",
    setup: ["e2e3", "a7a6", "e3e4", "a6a5", "b2b3", "c7c6", "b1a3", "g8h6", "f1b5", "h8g8", "d2d4", "e7e6", "c1d2", "f8a3", "b3b4", "a5b4", "d2f4", "d8b6", "f4e5", "b6d4", "d1d4", "a8a5", "b5d3", "d7d5", "g2g3", "h6g4", "e5d6", "e8d7", "d4c5", "g7g5", "c5a5", "a3b2", "f2f4", "f7f5", "d3b5", "b8a6", "a5b4", "b2a1", "b4c5", "g4h2", "c5d5", "h2f3", "e1d1", "h7h5", "h1h5", "f5e4", "d5g5", "f3g1"],
    solution: "g5e7",
    turn: "white",
    titleVi: "Trắng đi, Hậu chiếu hết trong 1 nước",
    titleEn: "White to move, mate in 1 by Queen",
  },
  {
    id: "mate-020",
    setup: ["g1f3", "e7e5", "d2d4", "a7a6", "h2h4", "g7g6", "c1h6", "d7d5", "f3h2", "c8h3", "d1d3", "e5e4", "d3f3", "f8h6", "c2c3", "d8g5", "g2h3"],
    solution: "g5c1",
    turn: "black",
    titleVi: "Đen đi, Hậu chiếu hết trong 1 nước",
    titleEn: "Black to move, mate in 1 by Queen",
  },
];

/** Deterministic daily pick: days since Unix epoch mod puzzle count. */
export function dailyPuzzleIndex(date: Date = new Date()): number {
  const days = Math.floor(date.getTime() / 86400000);
  return ((days % PUZZLES.length) + PUZZLES.length) % PUZZLES.length;
}

export function dailyPuzzle(date: Date = new Date()): ChessPuzzle {
  return PUZZLES[dailyPuzzleIndex(date)];
}

/** UTC date string YYYY-MM-DD for streak/solve tracking. */
export function puzzleDateStr(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
