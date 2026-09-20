export const CHANNELS = ["slack", "email", "tweet", "pr"] as const;
export type Channel = (typeof CHANNELS)[number];

export const KINDS = [
  "ask",
  "update",
  "disagreement",
  "apology",
  "vent",
  "other",
] as const;
export type Kind = (typeof KINDS)[number];

export const VERDICTS = ["send", "hold", "dont"] as const;
export type Verdict = (typeof VERDICTS)[number];

export function isChannel(value: unknown): value is Channel {
  return typeof value === "string" && (CHANNELS as readonly string[]).includes(value);
}

export function isKind(value: unknown): value is Kind {
  return typeof value === "string" && (KINDS as readonly string[]).includes(value);
}

export type NoulAnswer = {
  type: "noul";
  noul: number;
};

export type ChoiceAnswer = {
  type: "choice";
  choice: string;
  confidence?: number;
  probabilities?: Record<string, number>;
};

export type ScoreAnswer = {
  type: "score";
  score: number;
  confidence?: number;
  legend?: Record<string, string>;
  probabilities?: Record<string, number>;
};

export type JevAnswer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

export type JevResponse = {
  model: string;
  answers: Record<string, JevAnswer>;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cost?: number;
  };
  id?: string;
  provider?: string;
};

export type Signals = {
  hasAsk: number;
  buriedAsk: number;
  willMisread: number;
  passiveAggressive: number;
  startsFight: number;
  missingContext: number;
  soundsGenerated: number;
  unclearNext: number;
  heat: number;
  length: number;
  hedge: number;
  kind: Kind;
  kindConfidence: number;
  kindProbabilities: Record<string, number>;
  heatLegend: Record<string, string>;
  lengthLegend: Record<string, string>;
  hedgeLegend: Record<string, string>;
  heatProbabilities: Record<string, number>;
  lengthProbabilities: Record<string, number>;
  hedgeProbabilities: Record<string, number>;
};

export type FiredRule = {
  id: string;
  verdict: "hold" | "dont";
  signal: string;
  value: number;
  threshold: number;
  text: string;
};

export type Gate = {
  verdict: Verdict;
  rules: FiredRule[];
  kind: Kind;
};

export type Evaluation = {
  gate: Gate;
  signals: Signals;
  latencyMs: number;
  usage: JevResponse["usage"];
  model: string;
};
