// Bilingual UI strings (English / Vietnamese) for international chess.

import type { Lang, PieceType } from "./types";

export interface Strings {
  title: string;
  subtitle: string;
  copyright: string;
  level: string;
  youPlay: string;
  whiteFirst: string;
  blackSecond: string;
  undo: string;
  newGame: string;
  switchSides: string;
  whiteName: string;
  blackName: string;
  toMove: (colorName: string, check: boolean) => string;
  checkmate: (winnerName: string) => string;
  stalemateDraw: () => string;
  fiftyMoveDraw: () => string;
  materialDraw: () => string;
  thinking: string;
  thinkMeta: (levelLabel: string, depth: number) => string;
  computer: string;
  strength: string;
  lastSearch: string;
  searchStats: (depth: number, nodes: string, secs: string) => string;
  captured: string;
  youTook: string;
  computerTook: string;
  moves: string;
  noMoves: string;
  howToPlay: string;
  helpBullets: string[];
  boardLabel: string;
  levelLabel: (n: number) => string;
  levelDesc: string[];
  promoteTitle: string;
  pieceName: (t: PieceType) => string;
  checkBadge: string;
  checkmateBadge: string;
  hint: string;
  hintBusy: string;
  hintToast: (move: string) => string;
  timeControl: string;
  noTimeControl: string;
  minutes: (n: number) => string;
  flagged: (colorName: string) => string;
  restoreToast: string;
  authLogin: string;
  authSignup: string;
  authContinueWith: string;
  authOr: string;
  authDisplayName: string;
  authDisplayNamePh: string;
  authPassword: string;
  authInvalid: string;
  authCheckEmail: string;
  authClose: string;
  authNoAccount: string;
  authHaveAccount: string;
}

/** Piece letters for SAN notation. */
export const SAN_LETTERS: Record<Lang, Record<PieceType, string>> = {
  en: { K: "K", Q: "Q", R: "R", B: "B", N: "N", P: "" },
  vi: { K: "V", Q: "H", R: "X", B: "T", N: "M", P: "" },
};

const PIECE_NAMES: Record<Lang, Record<PieceType, string>> = {
  en: { K: "King", Q: "Queen", R: "Rook", B: "Bishop", N: "Knight", P: "Pawn" },
  vi: { K: "Vua", Q: "Hậu", R: "Xe", B: "Tượng", N: "Mã", P: "Tốt" },
};

export const STR: Record<Lang, Strings> = {
  en: {
    title: "♞ Chess",
    subtitle: "Play against the computer",
    copyright: "Copyright by SynerWork Inc. All rights reserved.",
    level: "Level",
    youPlay: "You play",
    whiteFirst: "White (first)",
    blackSecond: "Black (second)",
    undo: "Undo",
    newGame: "New game",
    switchSides: "Switch sides",
    whiteName: "White",
    blackName: "Black",
    toMove: (c, check) => `${c} to move${check ? " — check!" : ""}`,
    checkmate: (w) => `Checkmate — ${w} wins!`,
    stalemateDraw: () => "Stalemate — draw!",
    fiftyMoveDraw: () => "Draw by fifty-move rule!",
    materialDraw: () => "Draw — insufficient material!",
    thinking: "Computer is thinking",
    thinkMeta: (lvl, d) => `· ${lvl} · depth ${d}`,
    computer: "Computer",
    strength: "Strength",
    lastSearch: "Last search",
    searchStats: (d, n, s) => `depth ${d} · ${n} nodes · ${s}s`,
    captured: "Captured",
    youTook: "You took",
    computerTook: "Computer took",
    moves: "Moves",
    noMoves: "No moves yet.",
    howToPlay: "How to play",
    helpBullets: [
      "Click one of your pieces, then a highlighted square to move.",
      "Pawns promote when they reach the far rank — choose the piece.",
      "Castle by moving your king two squares toward a rook.",
    ],
    boardLabel: "Chess board",
    levelLabel: (n) => `Level ${n}`,
    levelDesc: [
      "Absolute beginner", "Beginner", "Casual", "Improving", "Club player",
      "Strong club player", "Expert", "Master", "Grandmaster", "Relentless",
      "Nightmare", "Unbeatable",
    ],
    promoteTitle: "Promote pawn to:",
    pieceName: (t) => PIECE_NAMES.en[t],
    checkBadge: "CHECK!",
    checkmateBadge: "CHECKMATE!",
    hint: "💡 Hint",
    hintBusy: "💡 …",
    hintToast: (m) => `💡 Hint: ${m}`,
    timeControl: "Time",
    noTimeControl: "None",
    minutes: (n) => `${n} min`,
    flagged: (c) => `${c} lost on time!`,
    restoreToast: "↩️ Restored your unfinished game.",
    authLogin: "Log in",
    authSignup: "Sign up",
    authContinueWith: "Continue with",
    authOr: "or",
    authDisplayName: "Display name (optional)",
    authDisplayNamePh: "Your name on the leaderboard",
    authPassword: "Password",
    authInvalid: "Enter a valid email and a password of 6+ characters.",
    authCheckEmail: "Account created! Check your email to confirm, then log in.",
    authClose: "Close",
    authNoAccount: "New here?",
    authHaveAccount: "Have an account?",
  },
  vi: {
    title: "♞ Cờ Vua",
    subtitle: "Chơi với máy tính",
    copyright: "Bản quyền thuộc về SynerWork Inc. Mọi quyền được bảo lưu.",
    level: "Cấp độ",
    youPlay: "Bạn cầm",
    whiteFirst: "Trắng (đi trước)",
    blackSecond: "Đen (đi sau)",
    undo: "Đi lại",
    newGame: "Ván mới",
    switchSides: "Đổi bên",
    whiteName: "Trắng",
    blackName: "Đen",
    toMove: (c, check) => `${c} đi${check ? " — chiếu!" : ""}`,
    checkmate: (w) => `Chiếu hết — ${w} thắng!`,
    stalemateDraw: () => "Hết nước đi — hòa!",
    fiftyMoveDraw: () => "Hòa theo luật 50 nước!",
    materialDraw: () => "Hòa — không đủ quân chiếu hết!",
    thinking: "Máy đang nghĩ",
    thinkMeta: (lvl, d) => `· ${lvl} · sâu ${d}`,
    computer: "Máy tính",
    strength: "Trình độ",
    lastSearch: "Lần tính cuối",
    searchStats: (d, n, s) => `sâu ${d} · ${n} nút · ${s} giây`,
    captured: "Quân bị ăn",
    youTook: "Bạn ăn",
    computerTook: "Máy ăn",
    moves: "Nước đi",
    noMoves: "Chưa có nước đi.",
    howToPlay: "Cách chơi",
    helpBullets: [
      "Nhấn vào một quân cờ của bạn, sau đó nhấn vào ô được đánh dấu để đi.",
      "Tốt phong cấp khi sang hàng cuối — hãy chọn quân.",
      "Nhập thành bằng cách đi Vua hai ô về phía Xe.",
    ],
    boardLabel: "Bàn cờ vua",
    levelLabel: (n) => `Cấp ${n}`,
    levelDesc: [
      "Mới bắt đầu", "Người mới chơi", "Chơi giải trí", "Đang tiến bộ",
      "Trình độ câu lạc bộ", "Câu lạc bộ khá", "Trình độ chuyên gia",
      "Trình độ kiện tướng", "Trình độ đại kiện tướng", "Cực kỳ khó",
      "Ác mộng", "Bất khả chiến bại",
    ],
    promoteTitle: "Phong Tốt thành:",
    pieceName: (t) => PIECE_NAMES.vi[t],
    checkBadge: "CHIẾU!",
    checkmateBadge: "CHIẾU HẾT!",
    hint: "💡 Gợi ý",
    hintBusy: "💡 …",
    hintToast: (m) => `💡 Gợi ý: ${m}`,
    timeControl: "Giờ",
    noTimeControl: "Không",
    minutes: (n) => `${n} phút`,
    flagged: (c) => `${c} thua vì hết giờ!`,
    restoreToast: "↩️ Đã khôi phục ván đang chơi dở.",
    authLogin: "Đăng nhập",
    authSignup: "Đăng ký",
    authContinueWith: "Tiếp tục với",
    authOr: "hoặc",
    authDisplayName: "Tên hiển thị (tùy chọn)",
    authDisplayNamePh: "Tên của bạn trên bảng xếp hạng",
    authPassword: "Mật khẩu",
    authInvalid: "Nhập email hợp lệ và mật khẩu từ 6 ký tự.",
    authCheckEmail: "Đã tạo tài khoản! Kiểm tra email để xác nhận rồi đăng nhập.",
    authClose: "Đóng",
    authNoAccount: "Chưa có tài khoản?",
    authHaveAccount: "Đã có tài khoản?",
  },
};

export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem("chess-lang");
    if (saved === "vi" || saved === "en") return saved;
  } catch {
    /* storage unavailable */
  }
  if (
    typeof navigator !== "undefined" &&
    navigator.language?.toLowerCase().startsWith("vi")
  ) {
    return "vi";
  }
  return "en";
}
