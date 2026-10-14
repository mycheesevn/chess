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
  stats: string;
  statsTotalPlays: string;
  statsGuests: string;
  statsFinished: string;
  statsAbandoned: string;
  statsMembers: string;
  statsNewMembers: string;
  statsToday: string;
  statsThisWeek: string;
  statsThisMonth: string;
  statsPlays: string;
  statsByDay: string;
  statsByWeek: string;
  statsByMonth: string;
  statsByYear: string;
  statsLoading: string;
  statsNotConfigured: string;
  videoExport: string;
  videoTitle: string;
  videoDesc: string;
  videoMoves: (n: number) => string;
  videoStart: string;
  videoRecording: string;
  videoCancel: string;
  videoShare: string;
  videoDownload: string;
  videoClose: string;
  videoDone: string;
  videoError: string;
  videoSpeed: string;
  videoSpeedSlow: string;
  videoSpeedNormal: string;
  videoSpeedFast: string;
  videoMic: string;
  videoMicDenied: string;
  setupTitle: string;
  setupPieces: string;
  setupMove: string;
  setupErase: string;
  setupHint: string;
  setupTurn: string;
  setupStart: string;
  setupReset: string;
  setupClear: string;
  setupErrKings: string;
  setupErrPawns: string;
  setupErrKingsAdjacent: string;
  setupErrOpponentInCheck: string;
  setupErrMaterial: string;
  setupErrFinished: string;
  libTagline: string;
  libProgress: (done: number, total: number) => string;
  libLessons: (done: number, total: number) => string;
  libUnlockHint: (prevChapter: string) => string;
  libBack: string;
  libStep: (i: number, n: number) => string;
  libDone: string;
  libShowMove: string;
  libFindMove: string;
  libTryAgain: string;
  libExploreDone: string;
  libCompleteLesson: string;
  libCelebration: string;
  libNextLesson: string;
  libBackToLibrary: string;
  /* Profile modal */
  profile: string;
  profileFullName: string;
  profileBirthDate: string;
  profileCity: string;
  profileCountry: string;
  profileAvatar: string;
  profileChangeAvatar: string;
  profileUploading: string;
  profileUsername: string;
  profileEmail: string;
  profileSave: string;
  profileSaved: string;
  achProfileTitle: string;
  achShare: string;
  shareDone: string;
  shareDownloaded: string;
  leaderboard: string;
  leaderboardLogin: string;
  leaderboardEmpty: string;
  topPlayers: string;
  noName: string;
  you: string;
  wins: string;
  winRate: string;
  gamesPlayed: string;
  loading: string;
  achRankTitle: (rank: number) => string;
  xpToNext: (xp: number, lvl: number) => string;
  ambStats: (invites: number, xp: number) => string;
  referralTitle: string;
  referralDesc: string;
  referralCopy: string;
  referralCopied: string;
  referralShare: string;
  changePassword: string;
  newPassword: string;
  confirmPassword: string;
  passwordChanged: string;
  passwordMismatch: string;
  passwordTooShort: string;
  /* Friends view */
  friendsTitle: string;
  friendsChallengeIncoming: string;
  friendsChallengeFrom: (name: string) => string;
  friendsAccept: string;
  friendsDecline: string;
  friendsEmpty: string;
  friendsOnline: string;
  friendsInMatch: string;
  friendsWatch: string;
  friendsChallengeBtn: string;
  friendsUnfriend: string;
  friendsLoading: string;
  friendsSignIn: string;
  friendsActionError: string;
  roomPromote: string;
  roomPromoMembers: (n: number) => string;
  roomPromoFooter: string;
  roomPromoCodeLabel: string;
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
    stats: "Statistics",
    statsTotalPlays: "Total plays",
    statsGuests: "Guests",
    statsFinished: "Finished",
    statsAbandoned: "abandoned",
    statsMembers: "Members",
    statsNewMembers: "New members",
    statsToday: "Today",
    statsThisWeek: "This week",
    statsThisMonth: "This month",
    statsPlays: "Plays",
    statsByDay: "Day",
    statsByWeek: "Week",
    statsByMonth: "Month",
    statsByYear: "Year",
    statsLoading: "Loading…",
    statsNotConfigured: "Statistics are not available yet.",
    videoExport: "Export video",
    videoTitle: "Export game video",
    videoDesc: "Record the whole game as a video clip with sound to share.",
    videoMoves: (n: number) => `Game has ${n} moves`,
    videoStart: "Start recording",
    videoRecording: "Recording… keep the screen on.",
    videoCancel: "Cancel",
    videoShare: "Share",
    videoDownload: "Download",
    videoClose: "Close",
    videoDone: "Done! Your video is ready.",
    videoError: "Couldn't record video on this device.",
    videoSpeed: "Speed",
    videoSpeedSlow: "Slow",
    videoSpeedNormal: "Normal",
    videoSpeedFast: "Fast",
    videoMic: "🎤 Record voice commentary",
    videoMicDenied: "Couldn't access the microphone.",
    setupTitle: "Board setup",
    setupPieces: "Pieces",
    setupMove: "Move",
    setupErase: "Erase",
    setupHint: "Choose a piece, then tap squares to place it. With Move, tap a piece and then its destination.",
    setupTurn: "First move",
    setupStart: "▶ Play this position",
    setupReset: "Reset",
    setupClear: "Clear",
    setupErrKings: "Place exactly one white king and one black king.",
    setupErrPawns: "Pawns cannot stand on the first or last rank.",
    setupErrKingsAdjacent: "The two kings cannot be next to each other.",
    setupErrOpponentInCheck: "The side that is not to move cannot be in check. Change the position or the first move.",
    setupErrMaterial: "Each side can have at most 16 pieces and 8 pawns.",
    setupErrFinished: "This position is already decided or drawn. Change it so the side to move can continue the game.",
    libTagline: "An interactive journey: openings, traps, mating art and endgames. Complete lessons to unlock the next chapter.",
    libProgress: (d, t) => `${d} / ${t} lessons completed`,
    libLessons: (d, t) => `${d} / ${t} lessons`,
    libUnlockHint: (prev) => `Finish “${prev}” to unlock`,
    libBack: "← Back",
    libStep: (i, n) => `Step ${i} / ${n}`,
    libDone: "Completed",
    libShowMove: "Show move ▶",
    libFindMove: "Find the move!",
    libTryAgain: "Not that one — try again!",
    libExploreDone: "Done exploring",
    libCompleteLesson: "Complete lesson",
    libCelebration: "Lesson complete! Your progress has been saved.",
    libNextLesson: "Next lesson →",
    libBackToLibrary: "Back to library",
    /* Profile modal */
    profile: "Profile",
    profileFullName: "Full name",
    profileBirthDate: "Date of birth",
    profileCity: "City",
    profileCountry: "Country",
    profileAvatar: "Avatar",
    profileChangeAvatar: "Change photo",
    profileUploading: "Uploading…",
    profileUsername: "Leaderboard name",
    profileEmail: "Email",
    profileSave: "Save",
    profileSaved: "Profile saved ✓",
    achProfileTitle: "My chess achievements",
    achShare: "📤 Brag",
    shareDone: "Shared! 🎉",
    shareDownloaded: "Image saved + link copied 📋",
    leaderboard: "Leaderboard",
    leaderboardLogin: "Log in to see the leaderboard.",
    leaderboardEmpty: "No players yet — be the first!",
    topPlayers: "Top players",
    noName: "Unnamed",
    you: "you",
    wins: "wins",
    winRate: "win rate",
    gamesPlayed: "games",
    loading: "Loading…",
    achRankTitle: (rank) => `🏆 Ranked #${rank} on the leaderboard!`,
    xpToNext: (xp, lvl) => `${xp} XP to Lv ${lvl}`,
    ambStats: (invites: number, xp: number) =>
      `🎁 Ambassador: invited ${invites} ${invites === 1 ? "person" : "people"} · +${xp} XP earned`,
    referralTitle: "🎁 Invite friends",
    referralDesc:
      "Send your link to friends — when they log in and play 1 game, you both get +20 XP!",
    referralCopy: "Copy invite link",
    referralCopied: "Invite link copied! 📋",
    referralShare: "Share",
    changePassword: "Change password",
    newPassword: "New password",
    confirmPassword: "Confirm new password",
    passwordChanged: "Password changed ✓",
    passwordMismatch: "Passwords don't match",
    passwordTooShort: "Password must be at least 6 characters",
    friendsTitle: "👤 Friends",
    friendsChallengeIncoming: "⚔️ Challenges",
    friendsChallengeFrom: (name: string) => `⚔️ ${name} challenges you!`,
    friendsAccept: "Accept",
    friendsDecline: "Decline",
    friendsEmpty: "No friends yet. Add friends from the leaderboard or inside a room!",
    friendsOnline: "online",
    friendsInMatch: "in a match",
    friendsWatch: "👁 Watch",
    friendsChallengeBtn: "⚔️ Challenge",
    friendsUnfriend: "Remove",
    friendsLoading: "Loading…",
    friendsSignIn: "Sign in to add friends.",
    friendsActionError: "Something went wrong. Please try again.",
    roomPromote: "Promote",
    roomPromoMembers: (n) => `${n} member${n === 1 ? "" : "s"} in room`,
    roomPromoFooter: "👉 Challenge me at chess-my-cheese-vn.vercel.app",
    roomPromoCodeLabel: "Room code",
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
    stats: "Thống kê",
    statsTotalPlays: "Tổng lượt chơi",
    statsGuests: "Khách",
    statsFinished: "Chơi đến cùng",
    statsAbandoned: "bỏ cuộc",
    statsMembers: "Thành viên",
    statsNewMembers: "Thành viên mới",
    statsToday: "Hôm nay",
    statsThisWeek: "Tuần này",
    statsThisMonth: "Tháng này",
    statsPlays: "Lượt chơi",
    statsByDay: "Ngày",
    statsByWeek: "Tuần",
    statsByMonth: "Tháng",
    statsByYear: "Năm",
    statsLoading: "Đang tải…",
    statsNotConfigured: "Thống kê chưa khả dụng.",
    videoExport: "Xuất video",
    videoTitle: "Xuất video ván cờ",
    videoDesc: "Ghi lại toàn bộ ván cờ thành video clip có âm thanh để chia sẻ.",
    videoMoves: (n: number) => `Ván cờ có ${n} nước đi`,
    videoStart: "Bắt đầu ghi",
    videoRecording: "Đang ghi hình… giữ màn hình sáng.",
    videoCancel: "Hủy",
    videoShare: "Chia sẻ",
    videoDownload: "Tải xuống",
    videoClose: "Đóng",
    videoDone: "Xong! Video đã sẵn sàng.",
    videoError: "Không ghi được video trên thiết bị này.",
    videoSpeed: "Tốc độ",
    videoSpeedSlow: "Chậm",
    videoSpeedNormal: "Thường",
    videoSpeedFast: "Nhanh",
    videoMic: "🎤 Thu giọng bình luận",
    videoMicDenied: "Không truy cập được micro.",
    setupTitle: "Sắp xếp bàn cờ",
    setupPieces: "Quân cờ",
    setupMove: "Di chuyển",
    setupErase: "Xóa",
    setupHint: "Chọn một quân rồi chạm vào các ô để đặt. Với Di chuyển, chạm vào quân rồi chạm ô đích.",
    setupTurn: "Lượt đi đầu tiên",
    setupStart: "▶ Chơi thế cờ này",
    setupReset: "Đặt lại",
    setupClear: "Xóa sạch",
    setupErrKings: "Hãy đặt đúng một Vua trắng và một Vua đen.",
    setupErrPawns: "Tốt không thể đứng ở hàng đầu tiên hoặc hàng cuối cùng.",
    setupErrKingsAdjacent: "Hai Vua không thể đứng cạnh nhau.",
    setupErrOpponentInCheck: "Bên không tới lượt đi không thể đang bị chiếu. Hãy đổi thế cờ hoặc lượt đi đầu tiên.",
    setupErrMaterial: "Mỗi bên tối đa 16 quân và 8 Tốt.",
    setupErrFinished: "Thế cờ này đã kết thúc hoặc hòa. Hãy thay đổi để bên tới lượt có thể tiếp tục ván cờ.",
    libTagline: "Hành trình tương tác: khai cuộc, bẫy, sát pháp và tàn cuộc. Hoàn thành bài học để mở chương tiếp theo.",
    libProgress: (d, t) => `Đã hoàn thành ${d} / ${t} bài học`,
    libLessons: (d, t) => `${d} / ${t} bài học`,
    libUnlockHint: (prev) => `Hoàn thành “${prev}” để mở khóa`,
    libBack: "← Quay lại",
    libStep: (i, n) => `Bước ${i} / ${n}`,
    libDone: "Đã hoàn thành",
    libShowMove: "Xem nước đi ▶",
    libFindMove: "Hãy tìm nước đi!",
    libTryAgain: "Chưa đúng — thử lại nhé!",
    libExploreDone: "Đã khám phá xong",
    libCompleteLesson: "Hoàn thành bài học",
    libCelebration: "Hoàn thành bài học! Tiến độ của bạn đã được lưu.",
    libNextLesson: "Bài tiếp theo →",
    libBackToLibrary: "Về thư viện",
    /* Profile modal */
    profile: "Hồ sơ",
    profileFullName: "Họ tên",
    profileBirthDate: "Ngày sinh",
    profileCity: "Thành phố",
    profileCountry: "Quốc gia",
    profileAvatar: "Ảnh đại diện",
    profileChangeAvatar: "Đổi ảnh",
    profileUploading: "Đang tải ảnh…",
    profileUsername: "Tên trên bảng xếp hạng",
    profileEmail: "Email",
    profileSave: "Lưu",
    profileSaved: "Đã lưu hồ sơ ✓",
    achProfileTitle: "Thành tích cờ vua của tôi",
    achShare: "📤 Khoe",
    shareDone: "Đã chia sẻ! 🎉",
    shareDownloaded: "Đã tải ảnh + chép link 📋",
    leaderboard: "Bảng xếp hạng",
    leaderboardLogin: "Đăng nhập để xem bảng xếp hạng.",
    leaderboardEmpty: "Chưa có người chơi — hãy là người đầu tiên!",
    topPlayers: "Người chơi hàng đầu",
    noName: "Không tên",
    you: "bạn",
    wins: "thắng",
    winRate: "tỉ lệ thắng",
    gamesPlayed: "ván",
    loading: "Đang tải…",
    achRankTitle: (rank) => `🏆 Hạng #${rank} bảng xếp hạng!`,
    xpToNext: (xp, lvl) => `Còn ${xp} XP lên Cấp ${lvl}`,
    ambStats: (invites: number, xp: number) =>
      `🎁 Ambassador: invited ${invites} ${invites === 1 ? "person" : "people"} · +${xp} XP earned`,
    referralTitle: "🎁 Invite friends",
    referralDesc:
      "Send your link to friends — when they log in and play 1 game, you both get +20 XP!",
    referralCopy: "Copy invite link",
    referralCopied: "Invite link copied! 📋",
    referralShare: "Share",
    changePassword: "Đổi mật khẩu",
    newPassword: "Mật khẩu mới",
    confirmPassword: "Nhập lại mật khẩu mới",
    passwordChanged: "Đã đổi mật khẩu ✓",
    passwordMismatch: "Mật khẩu nhập lại không khớp",
    passwordTooShort: "Mật khẩu phải có ít nhất 6 ký tự",
    friendsTitle: "👤 Bạn bè",
    friendsChallengeIncoming: "⚔️ Lời thách đấu",
    friendsChallengeFrom: (name: string) => `⚔️ ${name} thách đấu bạn!`,
    friendsAccept: "Vào đấu",
    friendsDecline: "Từ chối",
    friendsEmpty: "Chưa có bạn bè. Kết bạn từ bảng xếp hạng hoặc trong phòng chơi nhé!",
    friendsOnline: "đang online",
    friendsInMatch: "đang đấu",
    friendsWatch: "👁 Xem",
    friendsChallengeBtn: "⚔️ Thách đấu",
    friendsUnfriend: "Xóa",
    friendsLoading: "Đang tải…",
    friendsSignIn: "Đăng nhập để kết bạn.",
    friendsActionError: "Đã xảy ra lỗi. Vui lòng thử lại.",
    roomPromote: "Quảng bá",
    roomPromoMembers: (n) => `Phòng có ${n} thành viên`,
    roomPromoFooter: "👉 Thách đấu ngay tại chess-my-cheese-vn.vercel.app",
    roomPromoCodeLabel: "Mã phòng",
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
