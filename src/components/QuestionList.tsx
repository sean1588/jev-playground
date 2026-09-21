"use client";

import {
  blankQuestion,
  MAX_CHOICE_OPTIONS,
  MAX_SCORE_LEVELS,
  MIN_CHOICE_OPTIONS,
  MIN_SCORE_LEVELS,
  nextQuestionId,
  uid,
  type EditorLevel,
  type EditorOption,
  type EditorQuestion,
} from "@/lib/schema";
import { QUESTION_TYPES, type QuestionType } from "@/lib/types";

export function QuestionList({
  questions,
  onChange,
}: {
  questions: EditorQuestion[];
  onChange: (questions: EditorQuestion[]) => void;
}) {
  function update(uid: string, patch: Partial<EditorQuestion>) {
    onChange(questions.map((question) => (question.uid === uid ? { ...question, ...patch } : question)));
  }

  function add(type: QuestionType) {
    onChange([...questions, blankQuestion(type, nextQuestionId(questions))]);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] tracking-widest text-faint">QUESTIONS</span>
        {QUESTION_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => add(type)}
            className="font-mono text-[11px] text-muted hover:text-ink"
          >
            + {type}
          </button>
        ))}
        <span className="ml-auto font-mono text-[11px] text-faint">{questions.length}</span>
      </div>

      <div className="mt-3 space-y-3">
        {questions.map((question) => (
          <QuestionCard
            key={question.uid}
            question={question}
            onChange={(patch) => update(question.uid, patch)}
            onRemove={() => onChange(questions.filter((item) => item.uid !== question.uid))}
          />
        ))}
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  onChange,
  onRemove,
}: {
  question: EditorQuestion;
  onChange: (patch: Partial<EditorQuestion>) => void;
  onRemove: () => void;
}) {
  return (
    <article className="border border-line bg-paper p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={question.id}
          onChange={(event) => onChange({ id: event.target.value })}
          spellCheck={false}
          className="field w-36 font-mono text-[12px]"
          aria-label="Question id"
        />
        <select
          value={question.type}
          onChange={(event) => onChange({ type: event.target.value as QuestionType })}
          className="field w-28 font-mono text-[12px]"
          aria-label="Question type"
        >
          {QUESTION_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto font-mono text-[11px] text-faint hover:text-dont"
        >
          remove
        </button>
      </div>

      <textarea
        value={question.instructions}
        onChange={(event) => onChange({ instructions: event.target.value })}
        placeholder="Instructions — the id is not sent to Jev"
        className="field mt-2 min-h-[56px] w-full resize-y text-[13px] leading-5"
      />

      {question.type === "noul" && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="label">true</span>
            <input
              value={question.noulTrue}
              onChange={(event) => onChange({ noulTrue: event.target.value })}
              placeholder="optional"
              className="field mt-1 w-full text-[12px]"
            />
          </label>
          <label className="block">
            <span className="label">false</span>
            <input
              value={question.noulFalse}
              onChange={(event) => onChange({ noulFalse: event.target.value })}
              placeholder="optional"
              className="field mt-1 w-full text-[12px]"
            />
          </label>
        </div>
      )}

      {question.type === "choice" && (
        <OptionEditor
          options={question.options}
          onChange={(options) => onChange({ options })}
        />
      )}

      {question.type === "score" && (
        <LevelEditor
          levels={question.levels}
          onChange={(levels) => onChange({ levels })}
        />
      )}
    </article>
  );
}

function OptionEditor({
  options,
  onChange,
}: {
  options: EditorOption[];
  onChange: (options: EditorOption[]) => void;
}) {
  return (
    <div className="mt-2 space-y-1.5">
      <span className="label">options</span>
      {options.map((option) => (
        <div key={option.uid} className="flex gap-2">
          <input
            value={option.key}
            onChange={(event) =>
              onChange(
                options.map((item) =>
                  item.uid === option.uid ? { ...item, key: event.target.value } : item,
                ),
              )
            }
            placeholder="key"
            spellCheck={false}
            className="field w-28 font-mono text-[12px]"
          />
          <input
            value={option.description}
            onChange={(event) =>
              onChange(
                options.map((item) =>
                  item.uid === option.uid ? { ...item, description: event.target.value } : item,
                ),
              )
            }
            placeholder="description (optional)"
            className="field min-w-0 flex-1 text-[12px]"
          />
          <button
            type="button"
            disabled={options.length <= MIN_CHOICE_OPTIONS}
            onClick={() => onChange(options.filter((item) => item.uid !== option.uid))}
            className="font-mono text-[11px] text-faint hover:text-dont disabled:opacity-30"
          >
            ×
          </button>
        </div>
      ))}
      {options.length < MAX_CHOICE_OPTIONS && (
        <button
          type="button"
          onClick={() =>
            onChange([...options, { uid: uid(), key: "", description: "" }])
          }
          className="font-mono text-[11px] text-muted hover:text-ink"
        >
          + option
        </button>
      )}
    </div>
  );
}

function LevelEditor({
  levels,
  onChange,
}: {
  levels: EditorLevel[];
  onChange: (levels: EditorLevel[]) => void;
}) {
  return (
    <div className="mt-2 space-y-1.5">
      <span className="label">levels, low to high</span>
      {levels.map((level) => (
        <div key={level.uid} className="flex gap-2">
          <input
            value={level.label}
            onChange={(event) =>
              onChange(
                levels.map((item) =>
                  item.uid === level.uid ? { ...item, label: event.target.value } : item,
                ),
              )
            }
            className="field min-w-0 flex-1 text-[12px]"
          />
          <button
            type="button"
            disabled={levels.length <= MIN_SCORE_LEVELS}
            onClick={() => onChange(levels.filter((item) => item.uid !== level.uid))}
            className="font-mono text-[11px] text-faint hover:text-dont disabled:opacity-30"
          >
            ×
          </button>
        </div>
      ))}
      {levels.length < MAX_SCORE_LEVELS && (
        <button
          type="button"
          onClick={() => onChange([...levels, { uid: uid(), label: "" }])}
          className="font-mono text-[11px] text-muted hover:text-ink"
        >
          + level
        </button>
      )}
    </div>
  );
}
