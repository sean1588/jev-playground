"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EXAMPLES } from "@/lib/examples";
import {
  CHANNEL_LABEL,
  HEDGE_LEVELS,
  HEAT_LEVELS,
  KIND_LABEL,
  LENGTH_LEVELS,
  SIGNALS,
} from "@/lib/questions";
import { CHANNELS, type Channel, type Evaluation, type Verdict } from "@/lib/types";

const DEBOUNCE_MS = 450;
const MIN_CHARS = 8;

type Status = "idle" | "pending" | "live" | "error";

const VERDICT_COPY: Record<Verdict, { mark: string; hint: string }> = {
  send: { mark: "SEND", hint: "No rule fired. The draft can go out." },
  hold: { mark: "HOLD", hint: "Fix the flagged rules, then send." },
  dont: { mark: "DON'T", hint: "Do not send this as written." },
};

const NOUL_ORDER = [
  "has_ask",
  "buried_ask",
  "will_misread",
  "passive_aggressive",
  "starts_fight",
  "missing_context",
  "sounds_generated",
  "unclear_next",
] as const;

export function SendHoldApp() {
  const [channel, setChannel] = useState<Channel>("slack");
  const [draft, setDraft] = useState(EXAMPLES[0].draft);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evaluatedKey, setEvaluatedKey] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const draftKey = `${channel}\n${draft.trim()}`;
  const stale = evaluatedKey !== null && evaluatedKey !== draftKey;

  const run = useMemo(() => {
    return (nextChannel: Channel, nextDraft: string) => {
      const trimmed = nextDraft.trim();
      if (trimmed.length < MIN_CHARS) {
        seq.current += 1;
        abort.current?.abort();
        setEvaluation(null);
        setEvaluatedKey(null);
        setStatus("idle");
        setError(null);
        return;
      }

      const id = ++seq.current;
      setStatus("pending");
      setError(null);
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;

      void (async () => {
        try {
          const res = await fetch("/api/evaluate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channel: nextChannel, draft: trimmed }),
            signal: controller.signal,
          });
          const payload = (await res.json()) as Evaluation & { error?: string };
          if (id !== seq.current) return;
          if (!res.ok) {
            setStatus("error");
            setError(payload.error ?? `Request failed (${res.status})`);
            return;
          }
          setEvaluation(payload);
          setEvaluatedKey(`${nextChannel}\n${trimmed}`);
          setStatus("live");
        } catch (caught) {
          if (id !== seq.current) return;
          if (caught instanceof DOMException && caught.name === "AbortError") return;
          setStatus("error");
          setError("Could not reach the evaluate endpoint.");
        }
      })();
    };
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => run(channel, draft), DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [channel, draft, run]);

  function loadExample(id: string) {
    const example = EXAMPLES.find((item) => item.id === id);
    if (!example) return;
    setChannel(example.channel);
    setDraft(example.draft);
  }

  const verdict = evaluation?.gate.verdict;
  const dimmed = stale && status === "pending";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-baseline justify-between gap-4 border-b border-line px-5 py-3">
        <div>
          <div className="text-[13px] font-medium tracking-[0.18em] text-ink">
            SEND / HOLD
          </div>
          <p className="mt-0.5 text-[12px] text-muted">
            Jev judges the draft. Code decides the gate. Nothing is rewritten.
          </p>
        </div>
        <p className="hidden text-right font-mono text-[11px] text-faint sm:block">
          typesafe/jev-1.13 · OpenRouter
        </p>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-2">
        <section className="flex min-h-[50dvh] flex-col border-b border-line lg:min-h-0 lg:border-r lg:border-b-0">
          <div className="flex flex-wrap gap-1 border-b border-line px-4 py-2">
            {CHANNELS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setChannel(item)}
                className={`px-2.5 py-1 font-mono text-[11px] tracking-wide ${
                  channel === item
                    ? "bg-ink text-bg"
                    : "text-muted hover:text-ink"
                }`}
              >
                {CHANNEL_LABEL[item]}
              </button>
            ))}
          </div>

          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck
            className="min-h-[220px] flex-1 resize-none bg-paper px-5 py-4 text-[15px] leading-7 text-ink outline-none placeholder:text-faint"
            placeholder="Write the thing. The gate updates as you type."
          />

          <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2">
            <span className="font-mono text-[10px] tracking-widest text-faint">
              EXAMPLES
            </span>
            {EXAMPLES.map((example) => (
              <button
                key={example.id}
                type="button"
                onClick={() => loadExample(example.id)}
                className="font-mono text-[11px] text-muted hover:text-ink"
              >
                {example.title}
              </button>
            ))}
            <span className="ml-auto font-mono text-[11px] text-faint">
              {draft.trim().length}
            </span>
          </div>
        </section>

        <section className="flex flex-col bg-panel">
          <VerdictHeader
            evaluation={evaluation}
            status={status}
            error={error}
            dimmed={dimmed}
          />

          {evaluation && verdict ? (
            <div className={`flex-1 overflow-auto px-5 py-4 ${dimmed ? "opacity-55" : ""}`}>
              <p className="text-[13px] text-muted">
                {evaluation.gate.rules[0]?.text ?? VERDICT_COPY[verdict].hint}
              </p>

              {evaluation.gate.rules.length > 0 && (
                <ol className="mt-3 space-y-1.5">
                  {evaluation.gate.rules.map((rule) => (
                    <li
                      key={rule.id}
                      className="flex flex-wrap items-baseline gap-x-2 font-mono text-[12px]"
                    >
                      <span
                        className={
                          rule.verdict === "dont" ? "text-dont" : "text-hold"
                        }
                      >
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

              <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-y border-line py-3">
                <span className="font-mono text-[11px] tracking-widest text-faint">
                  KIND
                </span>
                <span className="text-[14px]">{KIND_LABEL[evaluation.gate.kind]}</span>
                <span className="font-mono text-[12px] text-muted">
                  {formatNum(evaluation.signals.kindConfidence)} confidence
                </span>
              </div>

              <div className="mt-5 space-y-2.5">
                {NOUL_ORDER.map((id) => {
                  const value = noulValue(evaluation, id);
                  const meta = SIGNALS[id];
                  return (
                    <NoulBar
                      key={id}
                      label={meta.label}
                      value={value}
                      polarity={meta.polarity}
                    />
                  );
                })}
              </div>

              <div className="mt-6 space-y-4">
                <ScoreTrack
                  label="Heat"
                  score={evaluation.signals.heat}
                  levels={HEAT_LEVELS}
                />
                <ScoreTrack
                  label="Length"
                  score={evaluation.signals.length}
                  levels={LENGTH_LEVELS}
                />
                <ScoreTrack
                  label="Hedge"
                  score={evaluation.signals.hedge}
                  levels={HEDGE_LEVELS}
                />
              </div>
            </div>
          ) : (
            <Idle status={status} error={error} chars={draft.trim().length} />
          )}
        </section>
      </div>
    </div>
  );
}

function VerdictHeader({
  evaluation,
  status,
  error,
  dimmed,
}: {
  evaluation: Evaluation | null;
  status: Status;
  error: string | null;
  dimmed: boolean;
}) {
  const verdict = evaluation?.gate.verdict;
  const color =
    verdict === "send" ? "text-send" : verdict === "hold" ? "text-hold" : verdict === "dont" ? "text-dont" : "text-faint";

  return (
    <div className="border-b border-line px-5 py-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div
            className={`font-sans text-[42px] leading-none font-medium tracking-tight ${color} ${
              dimmed ? "live-pulse" : ""
            }`}
          >
            {verdict ? VERDICT_COPY[verdict].mark : status === "pending" ? "…" : "—"}
          </div>
        </div>
        <div className="text-right font-mono text-[11px] text-faint">
          {evaluation ? (
            <>
              <div>{evaluation.latencyMs} ms</div>
              <div>{formatCost(evaluation.usage.cost)}</div>
              <div className="max-w-[220px] truncate">{evaluation.model}</div>
            </>
          ) : status === "pending" ? (
            <div className="live-pulse">calling jev</div>
          ) : status === "error" ? (
            <div className="text-dont">{error}</div>
          ) : (
            <div>type to evaluate</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Idle({
  status,
  error,
  chars,
}: {
  status: Status;
  error: string | null;
  chars: number;
}) {
  return (
    <div className="flex flex-1 items-center px-5 py-10">
      <p className="max-w-sm text-[14px] leading-6 text-muted">
        {status === "error"
          ? error
          : chars < MIN_CHARS
            ? "Write at least a sentence. Twelve questions fire in one pass; the bars are the whole answer."
            : "Calling Jev…"}
      </p>
    </div>
  );
}

function NoulBar({
  label,
  value,
  polarity,
}: {
  label: string;
  value: number;
  polarity: "good" | "bad" | "neutral";
}) {
  const fill =
    polarity === "good" ? "bg-send" : polarity === "bad" ? "bg-dont" : "bg-hold";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-[12px] text-muted">{label}</span>
        <span className="font-mono text-[12px] tabular-nums text-ink">
          {formatNum(value)}
        </span>
      </div>
      <div className="h-[3px] bg-track">
        <div
          className={`h-full ${fill}`}
          style={{ width: `${Math.round(clamp(value) * 100)}%` }}
        />
      </div>
    </div>
  );
}

function ScoreTrack({
  label,
  score,
  levels,
}: {
  label: string;
  score: number;
  levels: readonly string[];
}) {
  const max = Math.max(levels.length - 1, 1);
  const pct = clamp(score / max) * 100;
  const nearest = Math.min(max, Math.max(0, Math.round(score)));

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-[12px] text-muted">{label}</span>
        <span className="font-mono text-[12px] text-ink">
          {levels[nearest] ?? formatNum(score)}
          <span className="text-faint"> · {formatNum(score)}</span>
        </span>
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
          <span key={level} className={index === nearest ? "text-muted" : undefined}>
            {level}
          </span>
        ))}
      </div>
    </div>
  );
}

function noulValue(evaluation: Evaluation, id: (typeof NOUL_ORDER)[number]): number {
  switch (id) {
    case "has_ask":
      return evaluation.signals.hasAsk;
    case "buried_ask":
      return evaluation.signals.buriedAsk;
    case "will_misread":
      return evaluation.signals.willMisread;
    case "passive_aggressive":
      return evaluation.signals.passiveAggressive;
    case "starts_fight":
      return evaluation.signals.startsFight;
    case "missing_context":
      return evaluation.signals.missingContext;
    case "sounds_generated":
      return evaluation.signals.soundsGenerated;
    case "unclear_next":
      return evaluation.signals.unclearNext;
  }
}

function formatNum(value: number): string {
  return value.toFixed(2);
}

function formatCost(cost: number | undefined): string {
  if (cost == null) return "—";
  if (cost < 0.0001) return `$${cost.toExponential(1)}`;
  return `$${cost.toFixed(5)}`;
}

function clamp(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
