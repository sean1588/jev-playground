import { describe, expect, it } from "vitest";
import { questionsForJev } from "./questions";
import {
  blankQuestion,
  buildRequest,
  editorFromApi,
  parseEvaluateBody,
  questionsToApi,
} from "./schema";

describe("questionsToApi", () => {
  it("builds send-hold questions", () => {
    const editor = Object.entries(questionsForJev()).map(([id, question]) =>
      editorFromApi(id, question),
    );
    const built = questionsToApi(editor);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(Object.keys(built.questions)).toEqual(Object.keys(questionsForJev()));
    expect(built.questions.has_ask.type).toBe("noul");
    expect(built.questions.kind.type).toBe("choice");
    expect(built.questions.heat.type).toBe("score");
  });

  it("rejects duplicate ids", () => {
    const a = blankQuestion("noul", "q1");
    a.instructions = "Is this true?";
    const b = blankQuestion("noul", "q1");
    b.instructions = "Is that true?";
    const built = questionsToApi([a, b]);
    expect(built.ok).toBe(false);
  });

  it("rejects a choice with one option", () => {
    const question = blankQuestion("choice", "team");
    question.instructions = "Which team?";
    question.options = [{ uid: "1", key: "billing", description: "" }];
    const built = questionsToApi([question]);
    expect(built.ok).toBe(false);
  });

  it("omits noul criteria when both sides are empty", () => {
    const question = blankQuestion("noul", "urgent");
    question.instructions = "Is this urgent?";
    const built = questionsToApi([question]);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.questions.urgent).toEqual({
      type: "noul",
      instructions: "Is this urgent?",
    });
  });
});

describe("buildRequest", () => {
  it("parses JSON state", () => {
    const question = blankQuestion("noul", "urgent");
    question.instructions = "Urgent?";
    const built = buildRequest({
      model: "typesafe/jev-1.13",
      stateMode: "json",
      stateText: '{"ticket":"help"}',
      questions: [question],
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.body.state).toEqual({ ticket: "help" });
  });

  it("rejects invalid JSON state", () => {
    const question = blankQuestion("noul", "urgent");
    question.instructions = "Urgent?";
    const built = buildRequest({
      model: "typesafe/jev-1.13",
      stateMode: "json",
      stateText: "{nope",
      questions: [question],
    });
    expect(built.ok).toBe(false);
  });
});

describe("parseEvaluateBody", () => {
  it("accepts a TypeSafe-shaped request", () => {
    const parsed = parseEvaluateBody({
      model: "typesafe/jev-1.13",
      state: "Help, payouts are failing.",
      questions: {
        is_urgent: {
          type: "noul",
          instructions: "Does this convey urgency?",
          criteria: { true: "Time-sensitive", false: "Not urgent" },
        },
        team: {
          type: "choice",
          instructions: "Which team?",
          criteria: { billing: "Money", technical: "Bugs" },
        },
      },
    });
    expect(parsed.ok).toBe(true);
  });

  it("rejects an empty questions map", () => {
    const parsed = parseEvaluateBody({
      state: "hello",
      questions: {},
    });
    expect(parsed.ok).toBe(false);
  });
});
