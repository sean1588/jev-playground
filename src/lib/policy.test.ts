import { describe, expect, it } from "vitest";
import { gateFor, THRESHOLDS } from "./policy";
import { parseSignals } from "./parse";
import type { JevAnswer, JevResponse, Signals } from "./types";

function signals(overrides: Partial<Signals> = {}): Signals {
  return {
    hasAsk: 0.9,
    buriedAsk: 0.05,
    willMisread: 0.08,
    passiveAggressive: 0.04,
    startsFight: 0.03,
    missingContext: 0.1,
    soundsGenerated: 0.05,
    unclearNext: 0.08,
    heat: 0.2,
    length: 1.0,
    hedge: 1.0,
    kind: "ask",
    kindConfidence: 0.9,
    kindProbabilities: { ask: 0.9 },
    heatLegend: {},
    lengthLegend: {},
    hedgeLegend: {},
    heatProbabilities: {},
    lengthProbabilities: {},
    hedgeProbabilities: {},
    ...overrides,
  };
}

describe("gateFor", () => {
  it("sends a clean ask", () => {
    const gate = gateFor("slack", signals());
    expect(gate.verdict).toBe("send");
    expect(gate.rules).toEqual([]);
  });

  it("does not send a fight", () => {
    const gate = gateFor("slack", signals({ startsFight: 0.81 }));
    expect(gate.verdict).toBe("dont");
    expect(gate.rules[0]?.id).toBe("fight");
  });

  it("does not send hostile heat even without a fight noul", () => {
    const gate = gateFor("pr", signals({ heat: 2.8, startsFight: 0.2 }));
    expect(gate.verdict).toBe("dont");
    expect(gate.rules.some((rule) => rule.id === "hostile")).toBe(true);
  });

  it("holds a buried ask", () => {
    const gate = gateFor(
      "slack",
      signals({ hasAsk: 0.7, buriedAsk: 0.82 }),
    );
    expect(gate.verdict).toBe("hold");
    expect(gate.rules[0]?.id).toBe("buried");
  });

  it("does not hold buried_ask when there is no ask", () => {
    const gate = gateFor(
      "slack",
      signals({ kind: "update", hasAsk: 0.1, buriedAsk: 0.9 }),
    );
    expect(gate.rules.some((rule) => rule.id === "buried")).toBe(false);
  });

  it("holds a vent on slack, not on a tweet", () => {
    const vent = signals({ kind: "vent", kindConfidence: 0.88, hasAsk: 0.1 });
    expect(gateFor("slack", vent).verdict).toBe("hold");
    expect(gateFor("tweet", vent).verdict).toBe("send");
  });

  it("tolerates more misread on tweets than on slack", () => {
    const punchy = signals({ kind: "update", hasAsk: 0.1, willMisread: 0.64 });
    expect(gateFor("tweet", punchy).verdict).toBe("send");
    expect(gateFor("slack", punchy).verdict).toBe("hold");
  });

  it("does not hold missing context when nobody is asked to act", () => {
    const update = signals({
      kind: "update",
      hasAsk: 0.07,
      missingContext: 0.8,
      willMisread: 0.1,
    });
    expect(gateFor("tweet", update).verdict).toBe("send");
  });

  it("holds missing context when there is an ask", () => {
    const gate = gateFor("slack", signals({ hasAsk: 0.9, missingContext: 0.8 }));
    expect(gate.rules.some((rule) => rule.id === "context")).toBe(true);
  });

  it("holds long slack, not long email", () => {
    const long = signals({ length: 2.6 });
    expect(gateFor("slack", long).rules.some((rule) => rule.id === "length")).toBe(
      true,
    );
    expect(gateFor("email", long).rules.some((rule) => rule.id === "length")).toBe(
      false,
    );
  });

  it("lets dont win over hold and sorts dont first", () => {
    const gate = gateFor(
      "email",
      signals({
        startsFight: 0.74,
        willMisread: 0.91,
        buriedAsk: 0.8,
        hasAsk: 0.7,
      }),
    );
    expect(gate.verdict).toBe("dont");
    expect(gate.rules[0]?.verdict).toBe("dont");
    expect(gate.rules.some((rule) => rule.verdict === "hold")).toBe(true);
  });

  it("holds sharp plus some misread together", () => {
    const gate = gateFor(
      "slack",
      signals({
        heat: THRESHOLDS.sharpAndMisreadHeat,
        willMisread: THRESHOLDS.sharpAndMisread,
      }),
    );
    expect(gate.verdict).toBe("hold");
    expect(gate.rules.some((rule) => rule.id === "sharp_misread")).toBe(true);
  });
});

describe("parseSignals", () => {
  it("reads nouls, scores, and kind from a Jev payload", () => {
    const answers: Record<string, JevAnswer> = {
      has_ask: { type: "noul", noul: 0.97 },
      buried_ask: { type: "noul", noul: 0.04 },
      will_misread: { type: "noul", noul: 0.1 },
      passive_aggressive: { type: "noul", noul: 0.02 },
      starts_fight: { type: "noul", noul: 0.01 },
      missing_context: { type: "noul", noul: 0.2 },
      sounds_generated: { type: "noul", noul: 0.03 },
      unclear_next: { type: "noul", noul: 0.05 },
      heat: {
        type: "score",
        score: 0.4,
        legend: { "0": "calm" },
        probabilities: { "0": 0.8, "1": 0.2 },
      },
      length: { type: "score", score: 1 },
      hedge: { type: "score", score: 1.1 },
      kind: {
        type: "choice",
        choice: "ask",
        confidence: 0.86,
        probabilities: { ask: 0.86, update: 0.14 },
      },
    };

    const response: JevResponse = {
      model: "typesafe/jev-1.13-20260917",
      answers,
      usage: { input_tokens: 10, output_tokens: 4 },
    };

    const parsed = parseSignals(response);
    expect(parsed.hasAsk).toBe(0.97);
    expect(parsed.kind).toBe("ask");
    expect(parsed.kindConfidence).toBe(0.86);
    expect(parsed.heat).toBe(0.4);
    expect(parsed.heatProbabilities["0"]).toBe(0.8);
  });

  it("falls back when answers are missing", () => {
    const parsed = parseSignals({
      model: "typesafe/jev-1.13",
      answers: {},
      usage: { input_tokens: 1, output_tokens: 0 },
    });
    expect(parsed.hasAsk).toBe(0);
    expect(parsed.kind).toBe("other");
  });
});
