"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Board, type FightAnim } from "./Board";
import { burstConfetti } from "@/lib/chess/confetti";
import {
  applyMove,
  gameStatus,
  inCheck,
  legalMovesForSquare,
} from "@/lib/chess/engine";
import { startPositionFromFen, type ParsedFen } from "@/lib/chess/fen";
import { STR } from "@/lib/chess/i18n";
import {
  LIBRARY,
  TOTAL_LESSONS,
  allLessonIds,
  findLesson,
  isChapterUnlocked,
  isLessonUnlocked,
  nextLessonId,
  type LibraryLesson,
} from "@/lib/chess/library";
import {
  completeLesson,
  loadLocalDone,
  syncLibraryProgress,
} from "@/lib/supabase/libraryProgress";
import { moveToUci, uciToMove } from "@/lib/chess/uci";
import {
  opposite,
  type Board as BoardT,
  type CastlingRights,
  type Color,
  type Lang,
  type Move,
  type Piece,
} from "@/lib/chess/types";

type View =
  | { name: "home" }
  | { name: "chapter"; chapterId: string }
  | { name: "lesson"; lessonId: string };

interface Position {
  board: BoardT;
  castling: CastlingRights;
  ep: { x: number; y: number } | null;
  halfmove: number;
  turn: Color;
}

/** Derive the position after the first `upto` steps of a lesson. */
function positionAt(start: ParsedFen, lesson: LibraryLesson, upto: number): Position {
  let board = start.board;
  let castling = { ...start.castling };
  let ep = start.ep;
  let halfmove = start.halfmove;
  let turn = start.turn;
  for (let i = 0; i < upto && i < lesson.steps.length; i++) {
    const uci = lesson.steps[i].move;
    if (!uci) continue;
    const move = uciToMove(uci);
    const piece = board[move.fromY][move.fromX];
    if (!piece) break;
    const isCapture =
      !!board[move.toY][move.toX] ||
      (piece.type === "P" && !!ep && move.toX === ep.x && move.toY === ep.y);
    const r = applyMove(board, move, castling, ep);
    board = r.board;
    castling = r.castling;
    ep = r.ep;
    halfmove = piece.type === "P" || isCapture ? 0 : halfmove + 1;
    turn = opposite(turn);
  }
  return { board, castling, ep, halfmove, turn };
}

function findKing(board: BoardT, color: Color): { x: number; y: number } | null {
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const p = board[y][x];
      if (p && p.type === "K" && p.color === color) return { x, y };
    }
  return null;
}

export function LibraryView({ lang }: { lang: Lang }) {
  const s = STR[lang];
  const [view, setView] = useState<View>({ name: "home" });
  const [done, setDone] = useState<Set<string>>(() => new Set(loadLocalDone()));

  useEffect(() => {
    let live = true;
    syncLibraryProgress().then((merged) => {
      if (live) setDone(new Set(merged));
    });
    return () => {
      live = false;
    };
  }, []);

  const markDone = async (lessonId: string) => {
    const merged = await completeLesson(lessonId);
    setDone(new Set(merged));
  };

  if (view.name === "lesson") {
    const lesson = findLesson(view.lessonId);
    if (!lesson) return null;
    return (
      <LessonPlayer
        key={lesson.id}
        lesson={lesson}
        lang={lang}
        done={done}
        onDone={markDone}
        onExit={() => setView({ name: "home" })}
        onNext={(id) => setView({ name: "lesson", lessonId: id })}
      />
    );
  }

  if (view.name === "chapter") {
    const ch = LIBRARY.find((c) => c.id === view.chapterId);
    if (ch && isChapterUnlocked(ch.id, done)) {
      return (
        <div className="ch-scroll-area">
          <div className="ch-lib-home">
            <button type="button" className="ch-lib-back" onClick={() => setView({ name: "home" })}>
              {s.libBack}
            </button>
            <div className="ch-lib-chead">
              <span className="ch-lib-cicon">{ch.icon}</span>
              <div>
                <h2>{ch.title[lang]}</h2>
                <p>{ch.subtitle[lang]}</p>
              </div>
            </div>
            <div className="ch-lib-lessons">
              {ch.lessons.map((l, i) => {
                const unlocked = isLessonUnlocked(l.id, done);
                const finished = done.has(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    className={`ch-lib-lesson${finished ? " is-done" : ""}${!unlocked ? " is-locked" : ""}`}
                    disabled={!unlocked}
                    onClick={() => setView({ name: "lesson", lessonId: l.id })}
                  >
                    <span className="ch-lib-lnum">
                      {finished ? "✅" : unlocked ? `${i + 1}` : "🔒"}
                    </span>
                    <span className="ch-lib-ltitle">{l.title[lang]}</span>
                    <span className="ch-lib-lgo">{unlocked ? "›" : ""}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      );
    }
    // fall through to home
  }

  const doneCount = allLessonIds().filter((id) => done.has(id)).length;
  return (
    <div className="ch-scroll-area">
      <div className="ch-lib-home">
        <div className="ch-lib-hero">
          <h2>📚 {lang === "vi" ? "Thư viện bí kíp" : "Playbook library"}</h2>
          <p>{s.libTagline}</p>
          <div className="ch-lib-progress">
            <div className="ch-lib-bar">
              <div
                className="ch-lib-fill"
                style={{ width: `${(doneCount / TOTAL_LESSONS) * 100}%` }}
              />
            </div>
            <span>{s.libProgress(doneCount, TOTAL_LESSONS)}</span>
          </div>
        </div>
        <div className="ch-lib-chapters">
          {LIBRARY.map((ch, ci) => {
            const unlocked = isChapterUnlocked(ch.id, done);
            const chDone = ch.lessons.filter((l) => done.has(l.id)).length;
            const complete = chDone === ch.lessons.length;
            return (
              <button
                key={ch.id}
                type="button"
                className={`ch-lib-chapter${complete ? " is-done" : ""}${!unlocked ? " is-locked" : ""}`}
                disabled={!unlocked}
                onClick={() => setView({ name: "chapter", chapterId: ch.id })}
              >
                <span className="ch-lib-cicon">{unlocked ? ch.icon : "🔒"}</span>
                <span className="ch-lib-cbody">
                  <span className="ch-lib-ctitle">
                    {ch.title[lang]}
                    {complete && <em> ✓</em>}
                  </span>
                  <span className="ch-lib-csub">
                    {unlocked
                      ? ch.subtitle[lang]
                      : s.libUnlockHint(LIBRARY[ci - 1]?.title[lang] ?? "")}
                  </span>
                  <span className="ch-lib-cmeta">
                    {unlocked ? s.libLessons(chDone, ch.lessons.length) : ""}
                  </span>
                </span>
                <span className="ch-lib-lgo">{unlocked ? "›" : ""}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Lesson player ------------------------------ */

function LessonPlayer({
  lesson,
  lang,
  done,
  onDone,
  onExit,
  onNext,
}: {
  lesson: LibraryLesson;
  lang: Lang;
  done: Set<string>;
  onDone: (id: string) => void;
  onExit: () => void;
  onNext: (id: string) => void;
}) {
  const s = STR[lang];
  const n = lesson.steps.length;
  const [stepIdx, setStepIdx] = useState(0);
  const [solved, setSolved] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<{ x: number; y: number } | null>(null);
  const [targets, setTargets] = useState<Move[]>([]);
  const [fight, setFight] = useState<FightAnim | null>(null);
  const [shake, setShake] = useState(0);
  const [wrongMsg, setWrongMsg] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const fightId = useRef(0);
  const fightTimer = useRef<number | null>(null);

  const start = useMemo(() => startPositionFromFen(lesson.startFen), [lesson]);
  const pos = useMemo(
    () => positionAt(start, lesson, stepIdx),
    [start, lesson, stepIdx]
  );
  const board = pos.board;

  const lastMove: Move | null = useMemo(() => {
    for (let i = stepIdx - 1; i >= 0; i--) {
      const uci = lesson.steps[i].move;
      if (uci) return uciToMove(uci);
    }
    return null;
  }, [lesson, stepIdx]);

  const finished = stepIdx >= n;
  const step = finished ? null : lesson.steps[stepIdx];
  const quizActive = !!step?.quiz && !solved.has(stepIdx);
  const exploreActive = !!step?.explore;

  const checkAt = useMemo(() => {
    if (!inCheck(board, pos.turn)) return null;
    return findKing(board, pos.turn);
  }, [board, pos.turn]);

  const clearSel = () => {
    setSelected(null);
    setTargets([]);
  };

  // Preselect the focus piece when an explore step opens.
  useEffect(() => {
    clearSel();
    setWrongMsg(false);
    if (step?.explore && step.exploreFocus) {
      const focus = step.exploreFocus;
      const x = "abcdefgh".indexOf(focus[0]);
      const y = 8 - Number(focus[1]);
      const pc = board[y]?.[x];
      if (pc && x >= 0) {
        setSelected({ x, y });
        setTargets(
          legalMovesForSquare(board, pc.color, x, y, pos.castling, pos.ep)
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx]);

  useEffect(() => {
    return () => {
      if (fightTimer.current) window.clearTimeout(fightTimer.current);
    };
  }, []);

  const advance = (move: Move) => {
    const piece: Piece | undefined = board[move.fromY][move.fromX] ?? undefined;
    let captured: Piece | null = board[move.toY][move.toX];
    if (
      !captured &&
      piece?.type === "P" &&
      pos.ep &&
      move.toX === pos.ep.x &&
      move.toY === pos.ep.y
    ) {
      captured = board[move.fromY][move.toX];
    }
    if (piece) {
      fightId.current += 1;
      const shown: Piece = move.promotion
        ? { type: move.promotion, color: piece.color }
        : piece;
      setFight({ id: fightId.current, move, piece: shown, captured });
      if (fightTimer.current) window.clearTimeout(fightTimer.current);
      fightTimer.current = window.setTimeout(
        () => setFight(null),
        captured ? 1050 : 620
      );
    }
    setStepIdx((i) => i + 1);
    clearSel();
  };

  const doWrong = () => {
    setShake((x) => x + 1);
    setWrongMsg(true);
    clearSel();
  };

  const attemptQuizMove = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    if (!step?.move || !step.quiz) return;
    // Candidates are the legal moves for the selected piece to the
    // clicked square (several when a pawn can promote).
    const candidates = targets.filter(
      (t) =>
        t.fromX === from.x && t.fromY === from.y && t.toX === to.x && t.toY === to.y
    );
    if (candidates.length === 0) return;
    if (step.quiz === "exact") {
      const hit = candidates.find((c) => moveToUci(c) === step.move);
      if (hit) {
        setSolved((prev) => new Set(prev).add(stepIdx));
        advance(hit);
      } else {
        doWrong();
      }
      return;
    }
    // quiz === "mate": any immediate checkmate wins.
    for (const played of candidates) {
      const piece = board[played.fromY][played.fromX];
      const isCapture =
        !!board[played.toY][played.toX] ||
        (piece?.type === "P" && !!pos.ep && played.toX === pos.ep.x && played.toY === pos.ep.y);
      const r = applyMove(board, played, pos.castling, pos.ep);
      const halfmove = piece?.type === "P" || isCapture ? 0 : pos.halfmove + 1;
      const status = gameStatus(r.board, opposite(pos.turn), r.castling, r.ep, halfmove);
      if (status.over && status.kind === "checkmate" && status.winner === pos.turn) {
        setSolved((prev) => new Set(prev).add(stepIdx));
        advance(played);
        return;
      }
    }
    doWrong();
  };

  const onSquareClick = (x: number, y: number) => {
    if (finished) return;
    if (quizActive) {
      if (selected && targets.some((t) => t.toX === x && t.toY === y)) {
        attemptQuizMove(selected, { x, y });
        return;
      }
      const p = board[y][x];
      if (p && p.color === pos.turn) {
        setSelected({ x, y });
        setTargets(legalMovesForSquare(board, pos.turn, x, y, pos.castling, pos.ep));
      } else {
        clearSel();
      }
      return;
    }
    if (exploreActive) {
      const p = board[y][x];
      if (p) {
        setSelected({ x, y });
        setTargets(legalMovesForSquare(board, p.color, x, y, pos.castling, pos.ep));
      } else {
        clearSel();
      }
    }
  };

  const showGuidedMove = () => {
    if (!step?.move || step.quiz || step.explore) return;
    advance(uciToMove(step.move));
  };

  // Autoplay: advance guided steps only.
  useEffect(() => {
    if (!autoplay || finished) return;
    if (step?.quiz || step?.explore) {
      setAutoplay(false);
      return;
    }
    const t = window.setTimeout(() => showGuidedMove(), 2200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, stepIdx, finished]);

  const complete = async () => {
    setFinishing(true);
    burstConfetti();
    await onDone(lesson.id);
  };

  const nextId = nextLessonId(lesson.id);
  const nextUnlocked = nextId ? isLessonUnlocked(nextId, done) : false;

  return (
    <div className="ch-page">
      <main className="ch-layout">
        <div className="ch-board-area">
          <div
            key={shake}
            className={`ch-board-fit${shake > 0 ? " shake" : ""}`}
          >
            <Board
              board={board}
              flipped={lesson.startTurn === "black"}
              selected={selected}
              targets={targets}
              lastMove={lastMove}
              checkAt={checkAt}
              checkKey={stepIdx}
              checkBadge={s.checkBadge}
              fight={fight}
              interactive={quizActive || exploreActive}
              boardLabel={lesson.title[lang]}
              onSquareClick={onSquareClick}
            />
          </div>
        </div>
        <aside className="ch-panel">
          <div className="ch-lib-topbar">
            <button type="button" className="ch-lib-back" onClick={onExit}>
              {s.libBack}
            </button>
            <span className="ch-lib-stepcount">
              {finished ? s.libDone : s.libStep(stepIdx + 1, n)}
            </span>
          </div>
          <h2 className="ch-lib-lesson-title">{lesson.title[lang]}</h2>

          {!finished ? (
            <>
              <div
                className={`ch-lib-card${quizActive ? " is-quiz" : ""}${exploreActive ? " is-explore" : ""}`}
                role="status"
                aria-live="polite"
              >
                <p>
                  {quizActive
                    ? (step!.quizPrompt?.[lang] ?? step!.text[lang])
                    : step!.text[lang]}
                </p>
                {wrongMsg && quizActive && (
                  <p className="ch-lib-wrong">{s.libTryAgain}</p>
                )}
              </div>
              <div className="ch-lib-controls">
                <button
                  type="button"
                  disabled={stepIdx === 0}
                  onClick={() => {
                    setAutoplay(false);
                    setStepIdx((i) => Math.max(0, i - 1));
                  }}
                  aria-label="previous"
                >
                  ◀
                </button>
                {step!.explore ? (
                  <button
                    type="button"
                    className="ch-lib-primary"
                    onClick={() => setStepIdx((i) => i + 1)}
                  >
                    {s.libExploreDone}
                  </button>
                ) : step!.quiz ? (
                  <span className="ch-lib-quizbadge">🎯 {s.libFindMove}</span>
                ) : (
                  <>
                    <button
                      type="button"
                      className="ch-lib-primary"
                      onClick={showGuidedMove}
                    >
                      {s.libShowMove}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAutoplay((a) => !a)}
                      aria-pressed={autoplay}
                      title="autoplay"
                    >
                      {autoplay ? "⏸" : "▶️"}
                    </button>
                  </>
                )}
              </div>
              <div className="ch-lib-moves">
                {lesson.steps.map((st, i) =>
                  st.move ? (
                    <button
                      key={i}
                      type="button"
                      className={`ch-lib-chip${i < stepIdx ? " is-past" : ""}${i === stepIdx ? " is-cur" : ""}`}
                      onClick={() => {
                        // Can't jump ahead past an unsolved quiz.
                        let target = i;
                        for (let k = 0; k < i; k++) {
                          if (lesson.steps[k].quiz && !solved.has(k)) {
                            target = k;
                            break;
                          }
                        }
                        setAutoplay(false);
                        setStepIdx(target);
                      }}
                    >
                      {i + 1}
                    </button>
                  ) : null
                )}
              </div>
            </>
          ) : (
            <>
              <div className="ch-lib-card is-outro" role="status">
                <p>{lesson.outro[lang]}</p>
              </div>
              {!finishing ? (
                <button
                  type="button"
                  className="ch-lib-primary ch-lib-complete"
                  onClick={complete}
                >
                  {done.has(lesson.id) ? s.libDone : s.libCompleteLesson} ✓
                </button>
              ) : (
                <div className="ch-lib-celebrate" role="status">
                  <div className="ch-lib-celebrate-emoji">🎉</div>
                  <p>{s.libCelebration}</p>
                  <div className="ch-lib-controls">
                    {nextId && nextUnlocked && (
                      <button
                        type="button"
                        className="ch-lib-primary"
                        onClick={() => onNext(nextId)}
                      >
                        {s.libNextLesson}
                      </button>
                    )}
                    <button type="button" onClick={onExit}>
                      {s.libBackToLibrary}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </aside>
      </main>
    </div>
  );
}
