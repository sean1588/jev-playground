import { asKind, clamp01 } from "./policy";
import type { JevAnswer, JevResponse, Signals } from "./types";

function noul(answers: Record<string, JevAnswer>, id: string): number {
  const answer = answers[id];
  if (!answer || answer.type !== "noul") return 0;
  return clamp01(answer.noul);
}

function score(answers: Record<string, JevAnswer>, id: string): number {
  const answer = answers[id];
  if (!answer || answer.type !== "score") return 0;
  return answer.score;
}

function scoreLegend(
  answers: Record<string, JevAnswer>,
  id: string,
): Record<string, string> {
  const answer = answers[id];
  if (!answer || answer.type !== "score") return {};
  return answer.legend ?? {};
}

function scoreProbabilities(
  answers: Record<string, JevAnswer>,
  id: string,
): Record<string, number> {
  const answer = answers[id];
  if (!answer || answer.type !== "score") return {};
  return answer.probabilities ?? {};
}

export function parseSignals(response: JevResponse): Signals {
  const { answers } = response;
  const kindAnswer = answers.kind;

  return {
    hasAsk: noul(answers, "has_ask"),
    buriedAsk: noul(answers, "buried_ask"),
    willMisread: noul(answers, "will_misread"),
    passiveAggressive: noul(answers, "passive_aggressive"),
    startsFight: noul(answers, "starts_fight"),
    missingContext: noul(answers, "missing_context"),
    soundsGenerated: noul(answers, "sounds_generated"),
    unclearNext: noul(answers, "unclear_next"),
    heat: score(answers, "heat"),
    length: score(answers, "length"),
    hedge: score(answers, "hedge"),
    kind: kindAnswer?.type === "choice" ? asKind(kindAnswer.choice) : "other",
    kindConfidence:
      kindAnswer?.type === "choice" ? clamp01(kindAnswer.confidence ?? 0) : 0,
    kindProbabilities:
      kindAnswer?.type === "choice" ? (kindAnswer.probabilities ?? {}) : {},
    heatLegend: scoreLegend(answers, "heat"),
    lengthLegend: scoreLegend(answers, "length"),
    hedgeLegend: scoreLegend(answers, "hedge"),
    heatProbabilities: scoreProbabilities(answers, "heat"),
    lengthProbabilities: scoreProbabilities(answers, "length"),
    hedgeProbabilities: scoreProbabilities(answers, "hedge"),
  };
}
