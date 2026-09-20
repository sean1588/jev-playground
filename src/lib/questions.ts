import type { Channel, Kind } from "./types";

export const HEAT_LEVELS = ["calm", "firm", "sharp", "hostile"] as const;
export const LENGTH_LEVELS = ["too terse", "tight", "long", "wall of text"] as const;
export const HEDGE_LEVELS = ["blunt", "direct", "hedged", "lost in hedges"] as const;

export const CHANNEL_LABEL: Record<Channel, string> = {
  slack: "Slack",
  email: "Email",
  tweet: "Tweet",
  pr: "PR comment",
};

export const CHANNEL_STATE: Record<Channel, string> = {
  slack: "A Slack message to coworkers. It will sit on the record in a work channel.",
  email: "An email. It is a lasting written record the recipient can forward.",
  tweet: "A public post on X. Anyone can screenshot it.",
  pr: "A comment on a pull request. The author and other reviewers will read it.",
};

export const KIND_LABEL: Record<Kind, string> = {
  ask: "Ask",
  update: "Update",
  disagreement: "Disagreement",
  apology: "Apology",
  vent: "Vent",
  other: "Other",
};

type NoulQuestion = {
  type: "noul";
  instructions: string;
  criteria: { true: string; false: string };
};

type ScoreQuestion = {
  type: "score";
  instructions: string;
  criteria: string[];
};

type ChoiceQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
};

export type Question = NoulQuestion | ScoreQuestion | ChoiceQuestion;

export type SignalPolarity = "good" | "bad" | "neutral";

export type SignalMeta = {
  label: string;
  polarity: SignalPolarity;
  question: Question;
};

/**
 * One Jev call, twelve independent questions. The id is for our code only —
 * TypeSafe does not send it to the model, so every instruction is a full sentence.
 */
export const SIGNALS = {
  has_ask: {
    label: "Has an ask",
    polarity: "good",
    question: {
      type: "noul",
      instructions:
        "Does the draft contain a clear request, question, or decision the recipient can act on?",
      criteria: {
        true: "There is an explicit ask, question, or requested action.",
        false:
          "The draft is only an update, opinion, vent, or statement with nothing to do.",
      },
    },
  },
  buried_ask: {
    label: "Ask is buried",
    polarity: "bad",
    question: {
      type: "noul",
      instructions:
        "Is a request or question present but easy for a busy reader to miss because it is buried, implied, or after a long preamble?",
      criteria: {
        true: "The action is in the draft but not obvious on a first read.",
        false:
          "Either there is no ask, or the ask is in the opening and hard to miss.",
      },
    },
  },
  will_misread: {
    label: "Easy to misread",
    polarity: "bad",
    question: {
      type: "noul",
      instructions:
        "Would a reasonable recipient reasonably misread the tone or intent of this draft?",
      criteria: {
        true: "Tone or intent is easy to take the wrong way.",
        false: "A reasonable reader would take it as written.",
      },
    },
  },
  passive_aggressive: {
    label: "Passive-aggressive",
    polarity: "bad",
    question: {
      type: "noul",
      instructions:
        "Does this draft read as passive-aggressive, sarcastic, or resentful without saying so directly?",
      criteria: {
        true: "Sarcasm, weaponized politeness, implied blame, or 'just circling back' energy.",
        false: "Direct, even if unhappy, or genuinely polite.",
      },
    },
  },
  starts_fight: {
    label: "Starts a fight",
    polarity: "bad",
    question: {
      type: "noul",
      instructions:
        "Does this draft pick a fight, assign personal blame, or escalate conflict?",
      criteria: {
        true: "An attack on a person, contempt, or an invitation to argue.",
        false:
          "Disagreement or criticism of the work without attacking the person.",
      },
    },
  },
  missing_context: {
    label: "Missing context",
    polarity: "bad",
    question: {
      type: "noul",
      instructions:
        "Is the recipient missing facts they would need in order to act that are not in the draft?",
      criteria: {
        true: "They would have to ask a follow-up before they could do anything.",
        false: "The draft has enough to act, or no action is requested.",
      },
    },
  },
  sounds_generated: {
    label: "Sounds generated",
    polarity: "bad",
    question: {
      type: "noul",
      instructions:
        "Does this read as generic, padded, or machine-written rather than from a specific person?",
      criteria: {
        true: "Stock phrasing, empty warmth, or template cadence.",
        false: "Sounds like a particular person wrote it.",
      },
    },
  },
  unclear_next: {
    label: "Unclear next step",
    polarity: "bad",
    question: {
      type: "noul",
      instructions:
        "After reading this, is it unclear who should do what next?",
      criteria: {
        true: "No owner, no next step, or several possible owners.",
        false: "The next step and owner are clear, or none is needed.",
      },
    },
  },
  heat: {
    label: "Heat",
    polarity: "neutral",
    question: {
      type: "score",
      instructions: "How heated is the tone of this draft?",
      criteria: [...HEAT_LEVELS],
    },
  },
  length: {
    label: "Length",
    polarity: "neutral",
    question: {
      type: "score",
      instructions:
        "How long is this draft for the channel named in the state? Judge relative to that channel, not in absolute words.",
      criteria: [...LENGTH_LEVELS],
    },
  },
  hedge: {
    label: "Hedge",
    polarity: "neutral",
    question: {
      type: "score",
      instructions: "How hedged is the point of this draft?",
      criteria: [...HEDGE_LEVELS],
    },
  },
  kind: {
    label: "Kind",
    polarity: "neutral",
    question: {
      type: "choice",
      instructions: "What kind of message is this draft?",
      criteria: {
        ask: "The point is a request, question, or decision for the recipient.",
        update: "The point is to inform. No action is required.",
        disagreement: "The point is to push back on work, a plan, or a claim.",
        apology: "The point is to own a mistake.",
        vent: "The point is to discharge frustration, not to get something done.",
        other: "None of the other labels fit.",
      } satisfies Record<Kind, string>,
    },
  },
} as const satisfies Record<string, SignalMeta>;

export type SignalId = keyof typeof SIGNALS;

export function questionsForJev(): Record<string, Question> {
  const questions: Record<string, Question> = {};
  for (const [id, meta] of Object.entries(SIGNALS)) {
    questions[id] = meta.question as Question;
  }
  return questions;
}


