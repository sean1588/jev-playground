"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnswerPane } from "@/components/AnswerPane";
import { QuestionList } from "@/components/QuestionList";
import { DEFAULT_PRESET, PRESETS, type Preset, type StateSample } from "@/lib/presets";
import {
  buildRequest,
  DEFAULT_MODEL,
  type EditorQuestion,
  type StateMode,
} from "@/lib/schema";
import type { EvaluateRequest, Evaluation } from "@/lib/types";

type Status = "idle" | "pending" | "live" | "error";

function cloneQuestions(questions: EditorQuestion[]): EditorQuestion[] {
  return questions.map((question) => ({
    ...question,
    options: question.options.map((option) => ({ ...option })),
    levels: question.levels.map((level) => ({ ...level })),
  }));
}

export function Playground() {
  const [presetId, setPresetId] = useState(DEFAULT_PRESET.id);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [stateMode, setStateMode] = useState<StateMode>(DEFAULT_PRESET.stateMode);
  const [stateText, setStateText] = useState(DEFAULT_PRESET.stateText);
  const [questions, setQuestions] = useState(() => cloneQuestions(DEFAULT_PRESET.questions));
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const seq = useRef(0);
  const abort = useRef<AbortController | null>(null);

  const built = useMemo(
    () => buildRequest({ model, stateMode, stateText, questions }),
    [model, stateMode, stateText, questions],
  );

  const preset = PRESETS.find((item) => item.id === presetId);
  const samples = preset?.samples;

  const runWith = useCallback(async (body: EvaluateRequest) => {
    const id = ++seq.current;
    setStatus("pending");
    setError(null);
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;

    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      setStatus("live");
    } catch (caught) {
      if (id !== seq.current) return;
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setStatus("error");
      setError("Could not reach the evaluate endpoint.");
    }
  }, []);

  const run = useCallback(() => {
    if (!built.ok) {
      setStatus("error");
      setError(built.error);
      return;
    }
    void runWith(built.body);
  }, [built, runWith]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        run();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  function applyPreset(next: Preset) {
    const nextQuestions = cloneQuestions(next.questions);
    setPresetId(next.id);
    setModel(next.model ?? DEFAULT_MODEL);
    setStateMode(next.stateMode);
    setStateText(next.stateText);
    setQuestions(nextQuestions);
    setEvaluation(null);
    const nextBuilt = buildRequest({
      model: next.model ?? DEFAULT_MODEL,
      stateMode: next.stateMode,
      stateText: next.stateText,
      questions: nextQuestions,
    });
    if (nextBuilt.ok) void runWith(nextBuilt.body);
    else {
      setStatus("idle");
      setError(null);
    }
  }

  function applySample(sample: StateSample) {
    setStateMode(sample.stateMode);
    setStateText(sample.stateText);
    const nextBuilt = buildRequest({
      model,
      stateMode: sample.stateMode,
      stateText: sample.stateText,
      questions,
    });
    if (nextBuilt.ok) void runWith(nextBuilt.body);
  }

  async function copyRequest() {
    if (!built.ok) return;
    await navigator.clipboard.writeText(JSON.stringify(built.body, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
        <div className="mr-auto">
          <div className="text-[13px] font-medium tracking-[0.18em] text-ink">JEV</div>
          <p className="mt-0.5 text-[12px] text-muted">
            State and typed questions in. Answers out. No prose.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => applyPreset(item)}
              className={`px-2.5 py-1 font-mono text-[11px] tracking-wide ${
                presetId === item.id ? "bg-ink text-bg" : "text-muted hover:text-ink"
              }`}
            >
              {item.title}
            </button>
          ))}
        </div>
        <input
          value={model}
          onChange={(event) => setModel(event.target.value)}
          spellCheck={false}
          className="field w-[220px] font-mono text-[11px]"
          aria-label="Model"
        />
        <button
          type="button"
          onClick={run}
          disabled={status === "pending"}
          className="bg-ink px-3 py-1.5 font-mono text-[11px] tracking-wide text-bg disabled:opacity-40"
        >
          {status === "pending" ? "RUNNING" : "RUN"}
        </button>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-2">
        <section className="flex min-h-0 flex-col border-b border-line lg:border-r lg:border-b-0">
          <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
            {preset && <p className="mb-4 text-[12px] text-muted">{preset.blurb}</p>}

            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] tracking-widest text-faint">STATE</span>
              {(["text", "json"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setStateMode(mode)}
                  className={`px-2 py-0.5 font-mono text-[11px] ${
                    stateMode === mode ? "bg-ink text-bg" : "text-muted hover:text-ink"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <textarea
              value={stateText}
              onChange={(event) => setStateText(event.target.value)}
              spellCheck={stateMode === "text"}
              className={`field mt-2 min-h-[160px] w-full resize-y px-3 py-2 text-[14px] leading-6 ${
                stateMode === "json" ? "font-mono text-[12px]" : ""
              }`}
              placeholder={stateMode === "json" ? '{ "draft": "…" }' : "The text or JSON Jev will read."}
            />

            {samples && samples.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] tracking-widest text-faint">SAMPLES</span>
                {samples.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => applySample(sample)}
                    className="font-mono text-[11px] text-muted hover:text-ink"
                  >
                    {sample.title}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-6">
              <QuestionList questions={questions} onChange={setQuestions} />
            </div>

            <details className="mt-6 border-t border-line pt-3">
              <summary className="cursor-pointer font-mono text-[10px] tracking-widest text-faint">
                REQUEST JSON
              </summary>
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void copyRequest()}
                  disabled={!built.ok}
                  className="font-mono text-[11px] text-muted hover:text-ink disabled:opacity-30"
                >
                  {copied ? "copied" : "copy json"}
                </button>
                {!built.ok && <span className="text-[12px] text-dont">{built.error}</span>}
              </div>
              {built.ok && (
                <pre className="mt-2 overflow-auto font-mono text-[11px] leading-5 text-faint">
                  {JSON.stringify(built.body, null, 2)}
                </pre>
              )}
            </details>
          </div>
          <div className="border-t border-line px-5 py-2 font-mono text-[11px] text-faint">
            ⌘↵ run
          </div>
        </section>

        <AnswerPane
          questions={questions}
          evaluation={evaluation}
          status={status}
          error={error}
          pending={status === "pending"}
        />
      </div>
    </div>
  );
}
