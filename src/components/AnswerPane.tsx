"use client";

import { clamp01, formatCost, formatNum } from "@/lib/format";
import type { EditorQuestion } from "@/lib/schema";
import type { Evaluation, JevAnswer, Verdict } from "@/lib/types";

const VERDICT_COPY: Record<Verdict, { mark: string; hint: string }> = {
  send: { mark: "SEND", hint: "No rule fired. The draft can go out." },
  hold: { mark: "HOLD", hint: "Fix the flagged rules, then send." },
  dont: { mark: "DON'T", hint: "Do not send this as written." },
};

export function AnswerPane({
  questions,
  evaluation,
  status,
  error,
  pending,
}: {
  questions: EditorQuestion[];
  evaluation: Evaluation | null;
  status: "idle" | "pending" | "live" | "error";
  error: string | null;
  pending: boolean;
}) {
  const verdict = evaluation?.gate?.verdict;
  const color =
    verdict === "send"
      ? "text-send"
      : verdict === "hold"
        ? "text-hold"
        : verdict === "dont"
          ? "text-dont"
          : "text-ink";

  return (
    <section className="flex min-h-0 flex-col bg-panel">
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-end justify-between gap-4">
          <div
            className={`font-sans text-[42px] leading-none font-medium tracking-tight ${color} ${
              pending ? "live-pulse" : ""
            }`}
          >
            {verdict ? VERDICT_COPY[verdict].mark : pending ? "…" : "ANSWERS"}
          </div>
          <div className="text-right font-mono text-[11px] text-faint">
            {evaluation ? (
              <>
                <div>{evaluation.latencyMs} ms</div>
                <div>{formatCost(evaluation.usage.cost)}</div>
                <div className="max-w-[220px] truncate">{evaluation.model}</div>
              </>
            ) : pending ? (
              <div className="live-pulse">calling jev</div>
            ) : status === "error" ? (
              <div className="max-w-[220px] text-dont">{error}</div>
            ) : (
              <div>run to evaluate</div>
            )}
          </div>
        </div>
      </div>

      <div className={`flex-1 overflow-auto px-5 py-4 ${pending && evaluation ? "opacity-55" : ""}`}>
        {evaluation ? (
          <>
            {evaluation.gate && (
              <div className="mb-5">
                <p className="text-[13px] text-muted">
                  {evaluation.gate.rules[0]?.text ?? VERDICT_COPY[evaluation.gate.verdict].hint}
                </p>
                {evaluation.gate.rules.length > 0 && (
                  <ol className="mt-3 space-y-1.5">
                    {evaluation.gate.rules.map((rule) => (
                      <li
                        key={rule.id}
                        className="flex flex-wrap items-baseline gap-x-2 font-mono text-[12px]"
                      >
                        <span className={rule.verdict === "dont" ? "text-dont" : "text-hold"}>
                          {rule.verdict === "dont" ? "DON'T" : "HOLD"}
                        </span>
                        <span className="text-ink">{rule.text}</span>
                        <span className="text-faint">
                          {rule.signal} {formatNum(rule.value)} ≥ {formatNum(rule.threshold)}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            <div className="space-y-5">
              {questions.map((question) => (
                <AnswerBlock
                  key={question.uid}
                  question={question}
                  answer={evaluation.answers[question.id.trim()]}
                />
              ))}
            </div>
          </>
        ) : (
          <p className="max-w-sm text-[14px] leading-6 text-muted">
            {status === "error"
              ? error
              : "Edit state and questions, then run. Jev returns typed answers — a probability, a choice, or a score. No prose."}
          </p>
        )}
      </div>
    </section>
  );
}

function AnswerBlock({
  question,
  answer,
}: {
  question: EditorQuestion;
  answer: JevAnswer | undefined;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="font-mono text-[11px] text-muted">{question.id || "untitled"}</span>
        <span className="font-mono text-[10px] tracking-widest text-faint">{question.type}</span>
      </div>
      {!answer ? (
        <p className="text-[12px] text-faint">No answer for this id.</p>
      ) : answer.type === "noul" ? (
        <NoulBar value={answer.noul} />
      ) : answer.type === "choice" ? (
        <ChoiceBars
          winner={answer.choice}
          confidence={answer.confidence}
          probabilities={answer.probabilities ?? {}}
          optionOrder={question.options.map((option) => option.key.trim()).filter(Boolean)}
        />
      ) : (
        <ScoreTrack
          score={answer.score}
          levels={
            Object.keys(answer.legend ?? {}).length > 0
              ? Object.keys(answer.legend ?? {})
                  .sort((a, b) => Number(a) - Number(b))
                  .map((key) => answer.legend?.[key] ?? key)
              : question.levels.map((level) => level.label).filter(Boolean)
          }
        />
      )}
    </div>
  );
}

function NoulBar({ value }: { value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[12px] text-muted">P(yes)</span>
        <span className="font-mono text-[12px] tabular-nums">{formatNum(value)}</span>
      </div>
      <div className="h-[3px] bg-track">
        <div className="h-full bg-ink" style={{ width: `${Math.round(clamp01(value) * 100)}%` }} />
      </div>
    </div>
  );
}

function ChoiceBars({
  winner,
  confidence,
  probabilities,
  optionOrder,
}: {
  winner: string;
  confidence?: number;
  probabilities: Record<string, number>;
  optionOrder: string[];
}) {
  const keys = optionOrder.length
    ? [...optionOrder, ...Object.keys(probabilities).filter((key) => !optionOrder.includes(key))]
    : Object.keys(probabilities);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 text-[13px]">
        <span>{winner}</span>
        {confidence != null && (
          <span className="font-mono text-[12px] text-muted">{formatNum(confidence)} conf</span>
        )}
      </div>
      <div className="space-y-1.5">
        {keys.map((key) => {
          const value = probabilities[key] ?? 0;
          return (
            <div key={key}>
              <div className="mb-0.5 flex items-baseline justify-between gap-3">
                <span className={`text-[12px] ${key === winner ? "text-ink" : "text-muted"}`}>
                  {key}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-faint">
                  {formatNum(value)}
                </span>
              </div>
              <div className="h-[3px] bg-track">
                <div
                  className={`h-full ${key === winner ? "bg-ink" : "bg-hair"}`}
                  style={{ width: `${Math.round(clamp01(value) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScoreTrack({ score, levels }: { score: number; levels: string[] }) {
  const max = Math.max(levels.length - 1, 1);
  const pct = clamp01(score / max) * 100;
  const nearest = Math.min(max, Math.max(0, Math.round(score)));

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-[12px] text-muted">{levels[nearest] ?? "score"}</span>
        <span className="font-mono text-[12px]">{formatNum(score)}</span>
      </div>
      <div className="relative h-3">
        <div className="absolute top-1/2 right-0 left-0 h-px bg-hair" />
        {levels.map((_, index) => (
          <div
            key={index}
            className="absolute top-0 h-3 w-px bg-hair"
            style={{ left: `${(index / max) * 100}%` }}
          />
        ))}
        <div
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between gap-1 font-mono text-[10px] text-faint">
        {levels.map((level, index) => (
          <span key={`${level}-${index}`} className={index === nearest ? "text-muted" : undefined}>
            {level}
          </span>
        ))}
      </div>
    </div>
  );
}
