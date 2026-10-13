// Thư viện bí kíp — interactive playbook library (Chess port).
// Content model follows the boardgame-engagement skill
// (references/library.md). Every line is machine-verified with the
// engine before shipping (see the verification run in the build
// notes): all moves legal in sequence, "mate" quizzes really mate,
// the stalemate lesson really stalemates.
//
// Lesson ids are prefixed "chess-" — the shared `library_progress`
// table also holds PacClone (xiangqi) rows, so ids must be unique
// across games.

import type { Color } from "./types";

export interface LText {
  vi: string;
  en: string;
}

export type QuizKind = "exact" | "mate";

export interface LibraryStep {
  /** UCI move "e2e4" / "e7e8q". Absent = no move (explore/observe step). */
  move?: string;
  /** Explanation shown for this step (or the "correct!" text after a quiz). */
  text: LText;
  /** If set, the user must find and play the move to advance. */
  quiz?: QuizKind;
  /** Quiz prompt (defaults to text when absent). */
  quizPrompt?: LText;
  /** Free inspection at the current position, then continue. */
  explore?: boolean;
  /** Algebraic square ("g5") to preselect when an explore step opens. */
  exploreFocus?: string;
}

export interface LibraryLesson {
  id: string;
  title: LText;
  intro: LText;
  /** Full FEN of the starting position (its active color = startTurn). */
  startFen: string;
  startTurn: Color;
  steps: LibraryStep[];
  outro: LText;
}

export interface LibraryChapter {
  id: string;
  icon: string;
  title: LText;
  subtitle: LText;
  lessons: LibraryLesson[];
}

const STARTPOS =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const LIBRARY: LibraryChapter[] = [
  {
    id: "chess-openings",
    icon: "🚀",
    title: { vi: "Khai cuộc căn bản", en: "Basic openings" },
    subtitle: {
      vi: "Những nước đi đầu tiên — nền móng của mọi ván cờ.",
      en: "The first moves — the foundation of every game.",
    },
    lessons: [
      {
        id: "chess-italian-game",
        title: { vi: "Cờ Ý — Khai cuộc kinh điển", en: "Italian Game — the classic opening" },
        intro: {
          vi: "Cờ Ý là khai cuộc lâu đời và mẫu mực nhất: phát triển quân nhanh, chiếm trung tâm, nhắm vào ô f7 yếu nhất của Đen.",
          en: "The Italian Game is the oldest, most instructive opening: develop fast, claim the center, and eye f7 — Black's weakest square.",
        },
        startFen: STARTPOS,
        startTurn: "white",
        steps: [
          {
            move: "e2e4",
            quiz: "exact",
            quizPrompt: {
              vi: "🎯 Mở màn bằng tốt vua: đi 1.e4!",
              en: "🎯 Open with the king's pawn: play 1.e4!",
            },
            text: {
              vi: "Chính xác! 1.e4 chiếm trung tâm và mở đường cho tượng cùng hậu.",
              en: "Exactly! 1.e4 claims the center and opens lines for the bishop and queen.",
            },
          },
          {
            move: "e7e5",
            text: {
              vi: "Đen đáp trả đối xứng, cùng tranh giành trung tâm.",
              en: "Black answers symmetrically, also fighting for the center.",
            },
          },
          {
            move: "g1f3",
            quiz: "exact",
            quizPrompt: {
              vi: "🎯 Phát triển mã về phía trung tâm và tấn công tốt e5!",
              en: "🎯 Develop a knight toward the center and attack the e5 pawn!",
            },
            text: {
              vi: "Mf3: vừa phát triển quân, vừa đe dọa — nước đi mẫu mực của Cờ Ý.",
              en: "Nf3: development with a threat — the model Italian move.",
            },
          },
          {
            move: "b8c6",
            text: {
              vi: "Đen đưa mã ra bảo vệ tốt, đồng thời phát triển quân.",
              en: "Black defends the pawn with a knight, developing at the same time.",
            },
          },
          {
            move: "f1c4",
            quiz: "exact",
            quizPrompt: {
              vi: "🎯 Đưa tượng về 'ngôi nhà Ý' ở c4!",
              en: "🎯 Bring the bishop to its Italian home on c4!",
            },
            text: {
              vi: "Tc4 — Cờ Ý thành hình! Tượng ngắm thẳng vào f7, ô yếu nhất cạnh vua Đen.",
              en: "Bc4 — the Italian Game! The bishop eyes f7, the weakest square near Black's king.",
            },
          },
        ],
        outro: {
          vi: "Khai cuộc Ý hoàn tất: tốt chiếm trung tâm, mã và tượng đã phát triển, tượng canh f7. Nhớ nguyên tắc: phát triển quân trước, nhập thành sớm, tấn công sau!",
          en: "Italian setup complete: pawns in the center, knight and bishop developed, bishop watching f7. Remember the order: develop first, castle soon, attack later!",
        },
      },
      {
        id: "chess-french-defense",
        title: { vi: "Phòng thủ Pháp — Chắc như bê tông", en: "French Defense — solid as concrete" },
        intro: {
          vi: "Gặp 1.e4 mà không muốn đối công? Phòng thủ Pháp dựng một chuỗi tốt vững chắc rồi từ từ phá trung tâm của Trắng.",
          en: "Facing 1.e4 and prefer not to clash? The French Defense builds a solid pawn chain, then slowly undermines White's center.",
        },
        startFen: STARTPOS,
        startTurn: "white",
        steps: [
          {
            move: "e2e4",
            quiz: "exact",
            quizPrompt: {
              vi: "🎯 Trắng bắt đầu bằng 1.e4!",
              en: "🎯 White starts with 1.e4!",
            },
            text: {
              vi: "1.e4 — nước mở màn phổ biến nhất của cờ vua.",
              en: "1.e4 — the most popular first move in chess.",
            },
          },
          {
            move: "e7e6",
            text: {
              vi: "Đen đáp 1...e6: chuẩn bị đòn ...d5 phía sau lá chắn tốt — đây là Phòng thủ Pháp.",
              en: "Black answers 1...e6: preparing ...d5 behind a pawn shield — the French Defense.",
            },
          },
          {
            move: "d2d4",
            quiz: "exact",
            quizPrompt: {
              vi: "🎯 Chiếm trung tâm bằng tốt thứ hai!",
              en: "🎯 Occupy the center with the second pawn!",
            },
            text: {
              vi: "2.d4 — Trắng dựng trung tâm tốt lý tưởng.",
              en: "2.d4 — White builds the ideal pawn center.",
            },
          },
          {
            move: "d7d5",
            text: {
              vi: "Đen đánh ngay vào trung tâm: 2...d5. Chuỗi tốt Pháp ra đời — bên giữ chuỗi tốt sẽ có tàn cuộc tốt hơn.",
              en: "Black strikes at the center at once: 2...d5. The French pawn chain is born — whoever keeps their chain usually gets the better endgame.",
            },
          },
          {
            move: "b1c3",
            text: {
              vi: "Trắng lên mã, giữ nguyên sức ép. Toàn bộ cuộc đấu sẽ xoay quanh chuỗi tốt d5/e4 này.",
              en: "White develops a knight and keeps the tension. The whole battle will revolve around this d5/e4 pawn chain.",
            },
          },
        ],
        outro: {
          vi: "Phòng thủ Pháp trong một câu: dựng chuỗi tốt, bảo vệ nó, rồi phá chuỗi của đối thủ bằng ...c5 hoặc ...f6. Chắc chắn thắng hào nhoáng!",
          en: "The French in one sentence: build a pawn chain, defend it, then undermine the enemy chain with ...c5 or ...f6. Solid beats flashy!",
        },
      },
      {
        id: "chess-queens-gambit",
        title: { vi: "Gambit Hậu — Mồi nhử trung tâm", en: "Queen's Gambit — the center decoy" },
        intro: {
          vi: "Gambit Hậu: Trắng 'thí' một tốt cánh để kéo tốt trung tâm của Đen ra khỏi vị trí. Đen nhận hay từ chối đều có cái giá riêng.",
          en: "The Queen's Gambit: White 'offers' a wing pawn to deflect Black's center pawn. Accepting or declining both carry a price.",
        },
        startFen: STARTPOS,
        startTurn: "white",
        steps: [
          {
            move: "d2d4",
            quiz: "exact",
            quizPrompt: {
              vi: "🎯 Mở màn bằng tốt hậu: 1.d4!",
              en: "🎯 Start with the queen's pawn: 1.d4!",
            },
            text: {
              vi: "1.d4 — chiếm trung tâm theo phong cách chắc chắn, vị trí.",
              en: "1.d4 — claiming the center in a solid, positional style.",
            },
          },
          {
            move: "d7d5",
            text: {
              vi: "Đen đối xứng: 1...d5, cùng giành trung tâm.",
              en: "Black mirrors: 1...d5, also staking a claim in the center.",
            },
          },
          {
            move: "c2c4",
            quiz: "exact",
            quizPrompt: {
              vi: "🎯 Dâng tốt c làm mồi để kéo tốt d5 của Đen đi chỗ khác!",
              en: "🎯 Offer the gambit pawn on c4 to deflect Black's d5 pawn!",
            },
            text: {
              vi: "2.c4 — Gambit Hậu! Nếu Đen ăn tốt này, Trắng sẽ chiếm trung tâm bằng e4.",
              en: "2.c4 — the Queen's Gambit! If Black captures, White will seize the center with e4.",
            },
          },
          {
            move: "e7e6",
            text: {
              vi: "Đen từ chối một cách khôn ngoan: 2...e6, mở đường cho tượng và giữ chắc trung tâm.",
              en: "Black wisely declines: 2...e6, opening the bishop's diagonal and keeping the center solid.",
            },
          },
          {
            move: "b1c3",
            text: {
              vi: "Trắng phát triển mã, tăng sức ép lên d5. Cái 'thí tốt' thực ra là cuộc đấu giành trung tâm.",
              en: "White develops a knight, increasing pressure on d5. The 'sacrifice' is really a fight for the center.",
            },
          },
        ],
        outro: {
          vi: "Gambit Hậu: tốt c chỉ là mồi nhử lệch hướng, không phải món quà. Kiểm soát trung tâm trước — chiến thuật sẽ đến sau.",
          en: "Queen's Gambit: the c-pawn is a deflection offer, not a gift. Control the center first — tactics come later.",
        },
      },
    ],
  },
  {
    id: "chess-tactics",
    icon: "🪤",
    title: { vi: "Chiến thuật & bẫy", en: "Tactics & traps" },
    subtitle: {
      vi: "Những đòn phối hợp bất ngờ — học để dùng và để tránh.",
      en: "Surprise combinations — learn them to use them, and to avoid them.",
    },
    lessons: [
      {
        id: "chess-scholars-mate",
        title: { vi: "Chiếu hết học trò", en: "Scholar's Mate" },
        intro: {
          vi: "Đòn chiếu hết 4 nước nổi tiếng nhất: hậu và tượng phối hợp đánh vào f7. Đen vừa đi một nước bất cẩn — hãy kết liễu!",
          en: "The most famous 4-move mate: queen and bishop team up against f7. Black just played carelessly — finish it!",
        },
        startFen:
          "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
        startTurn: "white",
        steps: [
          {
            move: "h5f7",
            quiz: "mate",
            quizPrompt: {
              vi: "🎯 Trắng chiếu hết trong 1 nước. Hậu đang rất 'đói'…",
              en: "🎯 White mates in ONE. The queen is hungry…",
            },
            text: {
              vi: "Hxf7#! Hậu được tượng c4 bảo vệ, vua Đen không còn đường chạy — ô d7 bị chính tốt nhà chặn. Đó là chiếu hết học trò!",
              en: "Qxf7#! The queen is guarded by the bishop on c4 and the king has no escape — d7 is blocked by its own pawn. That's Scholar's Mate!",
            },
          },
        ],
        outro: {
          vi: "Chiếu hết học trò chỉ thành công trước đối thủ bất cẩn — nhưng bài học thì vĩnh cửu: f7 (và f2) là ô mềm nhất trên bàn. Hãy canh giữ chúng!",
          en: "Scholar's Mate only works against careless defense — but the lesson is eternal: f7 (and f2) are the softest squares on the board. Guard them!",
        },
      },
      {
        id: "chess-knight-fork",
        title: { vi: "Chĩa mã — Đòn đôi im lặng", en: "Knight fork — the quiet double attack" },
        intro: {
          vi: "Mã là bậc thầy của đòn đôi: một nước nhảy vừa chiếu vua, vừa tấn công quân to khác. Thế cờ này mã Trắng đang đứng ở a6…",
          en: "The knight is the master of the double attack: one jump checks the king and hits a bigger piece. White's knight sits on a6 in this position…",
        },
        startFen: "r3k3/8/N7/8/8/8/8/4K3 w q - 0 1",
        startTurn: "white",
        steps: [
          {
            move: "a6c7",
            quiz: "exact",
            quizPrompt: {
              vi: "🎯 Tìm nước mã vừa chiếu vua, vừa tấn công xe!",
              en: "🎯 Find the knight move that checks the king AND attacks the rook!",
            },
            text: {
              vi: "Mc7+! Đòn chĩa hoàng gia: mã chiếu vua ở e8 và đồng thời tấn công xe ở a8.",
              en: "Nc7+! A royal fork: the knight checks the king on e8 and attacks the rook on a8 at the same time.",
            },
          },
          {
            move: "e8d8",
            text: {
              vi: "Vua Đen né sang một bên — nhưng không thể cứu được xe.",
              en: "The black king steps aside — but it cannot save the rook.",
            },
          },
          {
            move: "c7a8",
            quiz: "exact",
            quizPrompt: {
              vi: "🎯 Thu hoạch xe!",
              en: "🎯 Collect the rook!",
            },
            text: {
              vi: "Mxa8 — Trắng thắng chất. Mỗi khi mã đáp xuống có chiếu, hãy nhìn MỌI quân mà nó tấn công cùng lúc.",
              en: "Nxa8 — White wins the exchange. Whenever a knight lands with check, look at EVERY piece it attacks at the same time.",
            },
          },
        ],
        outro: {
          vi: "Đòn chĩa bằng mã chuyên xảy ra ở c7/c2 và f7/f2. Thấy mã địch lảng vảng gần vua và xe — hãy cảnh giác!",
          en: "Knight forks love the c7/c2 and f7/f2 squares. When an enemy knight hovers near your king and rook — beware!",
        },
      },
    ],
  },
  {
    id: "chess-mating-art",
    icon: "⚔️",
    title: { vi: "Sát pháp", en: "Mating art" },
    subtitle: {
      vi: "Nghệ thuật chiếu hết — những mẫu hình kinh điển phải thuộc lòng.",
      en: "The art of checkmate — classic patterns every player must know.",
    },
    lessons: [
      {
        id: "chess-ladder-mate",
        title: { vi: "Chiếu hết cầu thang", en: "The ladder mate" },
        intro: {
          vi: "Hai xe phối hợp như một chiếc cầu thang: một xe khóa hàng, một xe chiếu hết ở hàng trên. Vua Đen đang ở góc bàn…",
          en: "Two rooks work like a staircase: one locks a rank, the other mates on the rank above. Black's king is near the corner…",
        },
        startFen: "7k/8/8/8/8/8/8/RR4K1 w - - 0 1",
        startTurn: "white",
        steps: [
          {
            move: "b1b7",
            quiz: "exact",
            quizPrompt: {
              vi: "🎯 Dùng một xe khóa chặt hàng 7!",
              en: "🎯 Use one rook to lock the 7th rank!",
            },
            text: {
              vi: "Xb7! Xe khóa toàn bộ hàng 7 — cả 'tầng' thoát của vua Đen bị cắt đứt.",
              en: "Rb7! The rook seals the whole 7th rank — the king's entire escape floor is cut off.",
            },
          },
          {
            move: "h8g8",
            text: {
              vi: "Vua Đen lùi về g8 — ô duy nhất còn lại.",
              en: "The black king shuffles to g8 — the only square left.",
            },
          },
          {
            move: "a1a8",
            quiz: "mate",
            quizPrompt: {
              vi: "🎯 Xe còn lại kết liễu ở hàng cuối!",
              en: "🎯 The second rook delivers mate on the back rank!",
            },
            text: {
              vi: "Xa8#! Một xe canh hàng 7, một xe chiếu hết ở hàng 8 — cầu thang đã khép lại.",
              en: "Ra8#! One rook guards the 7th rank, the other mates on the 8th — the ladder closes.",
            },
          },
        ],
        outro: {
          vi: "Chiếu hết cầu thang: hai xe thay nhau cắt một hàng rồi chiếu hết ở hàng kế tiếp. Đơn giản, có hệ thống và không thể chống đỡ.",
          en: "The ladder (staircase) mate: two rooks take turns cutting one rank and mating on the next. Simple, systematic, unstoppable.",
        },
      },
      {
        id: "chess-arabian-mate",
        title: { vi: "Chiếu hết Ả Rập", en: "Arabian Mate" },
        intro: {
          vi: "Mẫu chiếu hết cổ xưa nhất: mã và xe dồn vua vào góc. Xe của bạn canh cột g, vua của bạn bịt các ô quanh góc…",
          en: "The oldest mating pattern of all: knight and rook corner the king. Your rook owns the g-file, your king covers the corner squares…",
        },
        startFen: "7k/8/7K/4N3/8/8/8/6R1 w - - 0 1",
        startTurn: "white",
        steps: [
          {
            move: "e5f7",
            quiz: "mate",
            quizPrompt: {
              vi: "🎯 Tìm nước chiếu hết kiểu Ả Rập — mã đánh vào nơi xe đang canh cột!",
              en: "🎯 Find the Arabian mate — the knight strikes where the rook guards the file!",
            },
            text: {
              vi: "Mf7#! Mã chiếu từ f7, xe làm chủ cột g, còn vua của bạn bịt kín g7 và h7. Vua Đen bị dồn vào góc không còn ô nào — chiếu hết Ả Rập!",
              en: "Nf7#! The knight checks from f7, the rook owns the g-file, and your king covers g7 and h7. The cornered king has no square — the Arabian Mate!",
            },
          },
        ],
        outro: {
          vi: "Chiếu hết Ả Rập: mã ở f7 (hoặc f2/c7/c2 ở các góc khác) cộng xe khóa cột biên. Một trong những mẫu hình lâu đời nhất của cờ vua!",
          en: "Arabian Mate: a knight on f7 (or f2/c7/c2 in other corners) plus a rook sealing the edge file. One of the oldest patterns in chess!",
        },
      },
    ],
  },
  {
    id: "chess-endgames",
    icon: "🏁",
    title: { vi: "Tàn cuộc & luật đặc biệt", en: "Endgames & special rules" },
    subtitle: {
      vi: "Giai đoạn cuối ván — và điểm khác biệt lớn so với cờ tướng.",
      en: "The final phase — and the big difference from xiangqi.",
    },
    lessons: [
      {
        id: "chess-stalemate-draw",
        title: { vi: "Hết nước đi là HÒA!", en: "No moves left is a DRAW!" },
        intro: {
          vi: "Khác hẳn cờ tướng (hết nước là thua): trong cờ vua, bên hết nước đi hợp lệ mà KHÔNG bị chiếu sẽ được hòa — gọi là stalemate. Hãy tự tay tạo ra nó!",
          en: "Unlike xiangqi (where having no moves loses): in chess, the side with no legal moves that is NOT in check draws — stalemate. Create one yourself!",
        },
        startFen: "7k/8/5K2/6Q1/8/8/8/8 w - - 0 1",
        startTurn: "white",
        steps: [
          {
            explore: true,
            exploreFocus: "g5",
            text: {
              vi: "🔍 Hậu của bạn đã được chọn sẵn — các ô đánh dấu là nơi hậu đi được. Hãy chạm thử các quân khác, rồi nhấn 'Đã khám phá xong' khi sẵn sàng.",
              en: "🔍 Your queen is preselected — the marked squares are where she can go. Tap other pieces too, then press 'Done exploring' when ready.",
            },
          },
          {
            move: "g5g6",
            quiz: "exact",
            quizPrompt: {
              vi: "🎯 Tìm nước thật 'lặng': không chiếu — nhưng khiến Đen không còn nước đi nào!",
              en: "🎯 Find the QUIET move: no check — but Black will have no legal move at all!",
            },
            text: {
              vi: "Hg6 — Đen KHÔNG bị chiếu, nhưng mọi nước vua đều bước vào tầm hậu hoặc vua của bạn. Hết nước hợp lệ + không bị chiếu = hết cờ hòa!",
              en: "Qg6 — Black is NOT in check, yet every king move walks into your queen or king. No legal moves + no check = stalemate!",
            },
          },
        ],
        outro: {
          vi: "Trong cờ vua, stalemate là HÒA — ngược hẳn cờ tướng, nơi bên bị bí sẽ thua! Khi đang thắng, hãy cẩn thận đừng 'bí' vua đơn độc của đối thủ.",
          en: "In chess, stalemate is a DRAW — the opposite of xiangqi, where the stalemated side loses! When you are winning, beware of stalemating a lone king.",
        },
      },
      {
        id: "chess-king-pawn-escort",
        title: { vi: "Vua hộ tống tốt", en: "The king escorts the pawn" },
        intro: {
          vi: "Tàn cuộc vua + tốt đấu vua: vua là vệ sĩ của tốt. Ở thế cờ này tốt e6 của bạn được vua d7 bảo vệ — hãy đưa nó về đích!",
          en: "King + pawn vs king: the king is the pawn's bodyguard. In this position your e6 pawn is guarded by the king on d7 — march it home!",
        },
        startFen: "5k2/3K4/4P3/8/8/8/8/8 w - - 0 1",
        startTurn: "white",
        steps: [
          {
            move: "e6e7",
            quiz: "exact",
            quizPrompt: {
              vi: "🎯 Đẩy tốt lên — nó đang được vua của bạn bảo vệ!",
              en: "🎯 Push the pawn — it is protected by your king!",
            },
            text: {
              vi: "e7+! Tốt chiếu, và vua Đen không thể ăn nó: vua bạn ở d7 đang canh ô e7.",
              en: "e7+! The pawn checks, and the black king cannot capture it: your king on d7 guards e7.",
            },
          },
          {
            move: "f8g8",
            text: {
              vi: "Vua Đen né sang bên — ăn tốt thì phạm luật, mà ô e8 cũng bị vua bạn canh giữ.",
              en: "The black king steps aside — capturing the pawn was illegal, and e8 is covered by your king too.",
            },
          },
          {
            move: "e7e8q",
            quiz: "exact",
            quizPrompt: {
              vi: "🎯 Phong cấp — hãy chọn Hậu!",
              en: "🎯 Promote — choose the queen!",
            },
            text: {
              vi: "e8=H! Với một hậu được vua hộ tống về đích, chiến thắng giờ chỉ còn là kỹ thuật.",
              en: "e8=Q! With a queen escorted home by the king, the win is now a matter of technique.",
            },
          },
        ],
        outro: {
          vi: "Vua + tốt đấu vua: vua là vệ sĩ của tốt. Giữ hai quân đi cùng nhau, tốt sẽ tự phong cấp.",
          en: "King and pawn vs king: the king is the pawn's bodyguard. Keep them together and the pawn promotes itself.",
        },
      },
    ],
  },
];

export const TOTAL_LESSONS = LIBRARY.reduce((n, c) => n + c.lessons.length, 0);

/** Ordered list of all lesson ids (for unlock logic). */
export function allLessonIds(): string[] {
  return LIBRARY.flatMap((c) => c.lessons.map((l) => l.id));
}

/** Is the lesson unlocked given the set of completed lesson ids? */
export function isLessonUnlocked(lessonId: string, done: Set<string>): boolean {
  const ids = allLessonIds();
  const i = ids.indexOf(lessonId);
  if (i <= 0) return true;
  return done.has(ids[i - 1]);
}

/** Is the chapter unlocked? (First chapter always; others need previous chapter complete.) */
export function isChapterUnlocked(chapterId: string, done: Set<string>): boolean {
  const ci = LIBRARY.findIndex((c) => c.id === chapterId);
  if (ci <= 0) return true;
  const prev = LIBRARY[ci - 1];
  return prev.lessons.every((l) => done.has(l.id));
}

export function findLesson(lessonId: string): LibraryLesson | null {
  for (const c of LIBRARY) {
    const l = c.lessons.find((x) => x.id === lessonId);
    if (l) return l;
  }
  return null;
}

export function nextLessonId(lessonId: string): string | null {
  const ids = allLessonIds();
  const i = ids.indexOf(lessonId);
  return i >= 0 && i + 1 < ids.length ? ids[i + 1] : null;
}
