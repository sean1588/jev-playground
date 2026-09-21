import {
  isQuestionType,
  type ChoiceQuestion,
  type EvaluateRequest,
  type NoulQuestion,
  type Question,
  type QuestionType,
  type ScoreQuestion,
} from "./types";

export const DEFAULT_MODEL = "typesafe/jev-1.13";
export const MAX_QUESTIONS = 32;
export const MAX_STATE_CHARS = 32_000;
export const MAX_CHOICE_OPTIONS = 255;
export const MIN_CHOICE_OPTIONS = 2;
export const MAX_SCORE_LEVELS = 10;
export const MIN_SCORE_LEVELS = 2;

export type StateMode = "text" | "json";

export type EditorOption = {
  uid: string;
  key: string;
  description: string;
};

export type EditorLevel = {
  uid: string;
  label: string;
};

export type EditorQuestion = {
  uid: string;
  id: string;
  type: QuestionType;
  instructions: string;
  noulTrue: string;
  noulFalse: string;
  options: EditorOption[];
  levels: EditorLevel[];
};

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function blankOptions(): EditorOption[] {
  return [
    { uid: uid(), key: "a", description: "" },
    { uid: uid(), key: "b", description: "" },
  ];
}

export function blankLevels(): EditorLevel[] {
  return [
    { uid: uid(), label: "low" },
    { uid: uid(), label: "high" },
  ];
}

export function blankQuestion(type: QuestionType, id: string): EditorQuestion {
  return {
    uid: uid(),
    id,
    type,
    instructions: "",
    noulTrue: "",
    noulFalse: "",
    options: blankOptions(),
    levels: blankLevels(),
  };
}

export function nextQuestionId(existing: EditorQuestion[]): string {
  const used = new Set(existing.map((question) => question.id));
  let n = existing.length + 1;
  while (used.has(`q${n}`)) n += 1;
  return `q${n}`;
}

export function editorFromApi(id: string, question: Question): EditorQuestion {
  const base: EditorQuestion = {
    uid: id,
    id,
    type: question.type,
    instructions: stringifyInstructions(question.instructions),
    noulTrue: "",
    noulFalse: "",
    options: blankOptions(),
    levels: blankLevels(),
  };

  if (question.type === "noul") {
    base.noulTrue = question.criteria?.true ?? "";
    base.noulFalse = question.criteria?.false ?? "";
  }

  if (question.type === "choice") {
    const options = Object.entries(question.criteria).map(([key, description]) => ({
      uid: `${id}-${key}`,
      key,
      description: description ?? "",
    }));
    if (options.length >= MIN_CHOICE_OPTIONS) base.options = options;
  }

  if (question.type === "score") {
    const levels = question.criteria.map((label, index) => ({
      uid: `${id}-${index}`,
      label,
    }));
    if (levels.length >= MIN_SCORE_LEVELS) base.levels = levels;
  }

  return base;
}

function stringifyInstructions(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

export function parseState(
  mode: StateMode,
  text: string,
): { ok: true; state: EvaluateRequest["state"] } | { ok: false; error: string } {
  if (text.length > MAX_STATE_CHARS) {
    return { ok: false, error: `State is over ${MAX_STATE_CHARS} characters.` };
  }

  if (mode === "text") {
    const trimmed = text.trim();
    if (!trimmed) return { ok: false, error: "State is empty." };
    return { ok: true, state: trimmed };
  }

  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "State JSON is empty." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "State is not valid JSON." };
  }

  if (typeof parsed === "string") return { ok: true, state: parsed };
  if (Array.isArray(parsed)) return { ok: true, state: parsed };
  if (parsed && typeof parsed === "object") {
    return { ok: true, state: parsed as Record<string, unknown> };
  }
  return { ok: false, error: "State JSON must be a string, object, or array." };
}

export function questionsToApi(
  questions: EditorQuestion[],
): { ok: true; questions: Record<string, Question> } | { ok: false; error: string } {
  if (questions.length === 0) return { ok: false, error: "Add at least one question." };
  if (questions.length > MAX_QUESTIONS) {
    return { ok: false, error: `At most ${MAX_QUESTIONS} questions per request.` };
  }

  const api: Record<string, Question> = {};
  const seen = new Set<string>();

  for (const question of questions) {
    const id = question.id.trim();
    if (!id) return { ok: false, error: "Every question needs an id." };
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(id)) {
      return {
        ok: false,
        error: `Question id "${id}" must start with a letter and use only letters, digits, and underscores.`,
      };
    }
    if (seen.has(id)) return { ok: false, error: `Duplicate question id "${id}".` };
    seen.add(id);

    const instructions = question.instructions.trim();
    if (!instructions) {
      return { ok: false, error: `Question "${id}" needs instructions. The id is not sent to Jev.` };
    }

    const built = editorToApi(question, instructions);
    if (!built.ok) return built;
    api[id] = built.question;
  }

  return { ok: true, questions: api };
}

function editorToApi(
  question: EditorQuestion,
  instructions: string,
): { ok: true; question: Question } | { ok: false; error: string } {
  const id = question.id.trim();

  if (question.type === "noul") {
    const yes = question.noulTrue.trim();
    const no = question.noulFalse.trim();
    const noul: NoulQuestion = { type: "noul", instructions };
    if (yes || no) {
      if (!yes || !no) {
        return { ok: false, error: `Noul "${id}" needs both true and false criteria, or neither.` };
      }
      noul.criteria = { true: yes, false: no };
    }
    return { ok: true, question: noul };
  }

  if (question.type === "choice") {
    const criteria: Record<string, string | null> = {};
    for (const option of question.options) {
      const key = option.key.trim();
      if (!key) continue;
      if (key in criteria) {
        return { ok: false, error: `Choice "${id}" has a duplicate option "${key}".` };
      }
      const description = option.description.trim();
      criteria[key] = description ? description : null;
    }
    const count = Object.keys(criteria).length;
    if (count < MIN_CHOICE_OPTIONS) {
      return { ok: false, error: `Choice "${id}" needs at least ${MIN_CHOICE_OPTIONS} options.` };
    }
    if (count > MAX_CHOICE_OPTIONS) {
      return { ok: false, error: `Choice "${id}" has more than ${MAX_CHOICE_OPTIONS} options.` };
    }
    const choice: ChoiceQuestion = { type: "choice", instructions, criteria };
    return { ok: true, question: choice };
  }

  const levels = question.levels.map((level) => level.label.trim()).filter(Boolean);
  if (levels.length < MIN_SCORE_LEVELS) {
    return { ok: false, error: `Score "${id}" needs at least ${MIN_SCORE_LEVELS} levels.` };
  }
  if (levels.length > MAX_SCORE_LEVELS) {
    return { ok: false, error: `Score "${id}" has more than ${MAX_SCORE_LEVELS} levels.` };
  }
  const score: ScoreQuestion = { type: "score", instructions, criteria: levels };
  return { ok: true, question: score };
}

export function buildRequest(input: {
  model: string;
  stateMode: StateMode;
  stateText: string;
  questions: EditorQuestion[];
}): { ok: true; body: EvaluateRequest } | { ok: false; error: string } {
  const model = input.model.trim() || DEFAULT_MODEL;
  const state = parseState(input.stateMode, input.stateText);
  if (!state.ok) return state;
  const questions = questionsToApi(input.questions);
  if (!questions.ok) return questions;
  return { ok: true, body: { model, state: state.state, questions: questions.questions } };
}

export function parseEvaluateBody(
  body: unknown,
): { ok: true; request: EvaluateRequest } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Expected an object." };
  }

  const raw = body as {
    model?: unknown;
    state?: unknown;
    questions?: unknown;
  };

  const model =
    raw.model === undefined || raw.model === ""
      ? DEFAULT_MODEL
      : typeof raw.model === "string"
        ? raw.model.trim()
        : "";
  if (!model) return { ok: false, error: "Model must be a string." };

  const state = parseWireState(raw.state);
  if (!state.ok) return state;

  const questions = parseWireQuestions(raw.questions);
  if (!questions.ok) return questions;

  return { ok: true, request: { model, state: state.state, questions: questions.questions } };
}

function parseWireState(
  state: unknown,
): { ok: true; state: EvaluateRequest["state"] } | { ok: false; error: string } {
  if (typeof state === "string") {
    const trimmed = state.trim();
    if (!trimmed) return { ok: false, error: "State is empty." };
    if (trimmed.length > MAX_STATE_CHARS) {
      return { ok: false, error: `State is over ${MAX_STATE_CHARS} characters.` };
    }
    return { ok: true, state: trimmed };
  }
  if (Array.isArray(state)) return { ok: true, state };
  if (state && typeof state === "object") {
    return { ok: true, state: state as Record<string, unknown> };
  }
  return { ok: false, error: "State must be a string, object, or array." };
}

function parseWireQuestions(
  questions: unknown,
): { ok: true; questions: Record<string, Question> } | { ok: false; error: string } {
  if (!questions || typeof questions !== "object" || Array.isArray(questions)) {
    return { ok: false, error: "Questions must be an object keyed by id." };
  }

  const entries = Object.entries(questions as Record<string, unknown>);
  if (entries.length === 0) return { ok: false, error: "Add at least one question." };
  if (entries.length > MAX_QUESTIONS) {
    return { ok: false, error: `At most ${MAX_QUESTIONS} questions per request.` };
  }

  const api: Record<string, Question> = {};
  for (const [id, value] of entries) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(id)) {
      return { ok: false, error: `Invalid question id "${id}".` };
    }
    const parsed = parseWireQuestion(id, value);
    if (!parsed.ok) return parsed;
    api[id] = parsed.question;
  }
  return { ok: true, questions: api };
}

function parseWireQuestion(
  id: string,
  value: unknown,
): { ok: true; question: Question } | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: `Question "${id}" must be an object.` };
  }
  const raw = value as { type?: unknown; instructions?: unknown; criteria?: unknown };
  if (!isQuestionType(raw.type)) {
    return { ok: false, error: `Question "${id}" needs type noul, choice, or score.` };
  }
  if (typeof raw.instructions !== "string" || !raw.instructions.trim()) {
    return { ok: false, error: `Question "${id}" needs string instructions.` };
  }
  const instructions = raw.instructions.trim();

  if (raw.type === "noul") {
    const noul: NoulQuestion = { type: "noul", instructions };
    if (raw.criteria !== undefined) {
      if (!raw.criteria || typeof raw.criteria !== "object" || Array.isArray(raw.criteria)) {
        return { ok: false, error: `Noul "${id}" criteria must be { true, false }.` };
      }
      const criteria = raw.criteria as { true?: unknown; false?: unknown };
      if (typeof criteria.true !== "string" || typeof criteria.false !== "string") {
        return { ok: false, error: `Noul "${id}" criteria need string true and false.` };
      }
      noul.criteria = { true: criteria.true, false: criteria.false };
    }
    return { ok: true, question: noul };
  }

  if (raw.type === "choice") {
    if (!raw.criteria || typeof raw.criteria !== "object" || Array.isArray(raw.criteria)) {
      return { ok: false, error: `Choice "${id}" needs an options object.` };
    }
    const criteria: Record<string, string | null> = {};
    for (const [key, description] of Object.entries(raw.criteria as Record<string, unknown>)) {
      if (!key.trim()) continue;
      if (description === null) {
        criteria[key] = null;
      } else if (typeof description === "string") {
        criteria[key] = description;
      } else {
        return { ok: false, error: `Choice "${id}" option "${key}" needs a string or null.` };
      }
    }
    const count = Object.keys(criteria).length;
    if (count < MIN_CHOICE_OPTIONS) {
      return { ok: false, error: `Choice "${id}" needs at least ${MIN_CHOICE_OPTIONS} options.` };
    }
    if (count > MAX_CHOICE_OPTIONS) {
      return { ok: false, error: `Choice "${id}" has more than ${MAX_CHOICE_OPTIONS} options.` };
    }
    return { ok: true, question: { type: "choice", instructions, criteria } };
  }

  if (!Array.isArray(raw.criteria)) {
    return { ok: false, error: `Score "${id}" criteria must be an array of levels.` };
  }
  const levels = raw.criteria.filter((level): level is string => typeof level === "string" && level.trim() !== "");
  if (levels.length < MIN_SCORE_LEVELS) {
    return { ok: false, error: `Score "${id}" needs at least ${MIN_SCORE_LEVELS} levels.` };
  }
  if (levels.length > MAX_SCORE_LEVELS) {
    return { ok: false, error: `Score "${id}" has more than ${MAX_SCORE_LEVELS} levels.` };
  }
  return { ok: true, question: { type: "score", instructions, criteria: levels } };
}
