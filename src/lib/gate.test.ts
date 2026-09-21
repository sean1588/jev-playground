import { describe, expect, it } from "vitest";
import { maybeGate, sendHoldChannel } from "./gate";
import { questionsForJev } from "./questions";
import { DEFAULT_MODEL } from "./schema";

const questions = questionsForJev();

describe("sendHoldChannel", () => {
  it("reads channel from send-hold JSON state", () => {
    expect(
      sendHoldChannel({
        model: DEFAULT_MODEL,
        state: { channel: "email", draft: "hello" },
        questions,
      }),
    ).toBe("email");
  });

  it("ignores a partial question set", () => {
    const partial = Object.fromEntries(
      Object.entries(questions).filter(([id]) => id !== "kind"),
    );
    expect(
      sendHoldChannel({
        model: DEFAULT_MODEL,
        state: { channel: "slack", draft: "hello" },
        questions: partial,
      }),
    ).toBeNull();
  });
});

describe("maybeGate", () => {
  it("returns a send verdict for a calm ask", () => {
    const gate = maybeGate(
      {
        model: DEFAULT_MODEL,
        state: { channel: "slack", draft: "please look" },
        questions,
      },
      {
        model: DEFAULT_MODEL,
        answers: {
          has_ask: { type: "noul", noul: 0.95 },
          buried_ask: { type: "noul", noul: 0.02 },
          will_misread: { type: "noul", noul: 0.05 },
          passive_aggressive: { type: "noul", noul: 0.02 },
          starts_fight: { type: "noul", noul: 0.01 },
          missing_context: { type: "noul", noul: 0.1 },
          sounds_generated: { type: "noul", noul: 0.04 },
          unclear_next: { type: "noul", noul: 0.05 },
          heat: { type: "score", score: 0.2 },
          length: { type: "score", score: 1 },
          hedge: { type: "score", score: 1 },
          kind: { type: "choice", choice: "ask", confidence: 0.9 },
        },
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    );
    expect(gate?.verdict).toBe("send");
  });
});
