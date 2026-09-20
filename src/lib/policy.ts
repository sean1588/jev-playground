import { isKind, type Channel, type FiredRule, type Gate, type Kind, type Signals } from "./types";

/**
 * Jev answers questions. This file is the product: named thresholds and
 * composition. Change a number here, not a prompt, to change the gate.
 */
export const THRESHOLDS = {
  fight: 0.7,
  hostileHeat: 2.55,
  passiveAggressive: 0.8,
  misread: 0.6,
  tweetMisread: 0.75,
  buriedAsk: 0.55,
  buriedAskNeedsAsk: 0.4,
  missingContext: 0.62,
  overHedged: 2.4,
  tooLong: 2.4,
  generated: 0.7,
  unclearNext: 0.65,
  sharpAndMisreadHeat: 1.8,
  sharpAndMisread: 0.4,
} as const;

const SHORT_CHANNELS: ReadonlySet<Channel> = new Set(["slack", "tweet"]);
const WORK_CHANNELS: ReadonlySet<Channel> = new Set(["slack", "email", "pr"]);

function dont(
  id: string,
  signal: string,
  value: number,
  threshold: number,
  text: string,
): FiredRule {
  return { id, verdict: "dont", signal, value, threshold, text };
}

function hold(
  id: string,
  signal: string,
  value: number,
  threshold: number,
  text: string,
): FiredRule {
  return { id, verdict: "hold", signal, value, threshold, text };
}

function over(value: number, threshold: number): number {
  return value - threshold;
}

export function gateFor(channel: Channel, signals: Signals): Gate {
  const rules: FiredRule[] = [];

  if (signals.startsFight >= THRESHOLDS.fight) {
    rules.push(
      dont(
        "fight",
        "starts_fight",
        signals.startsFight,
        THRESHOLDS.fight,
        "Reads as picking a fight.",
      ),
    );
  }

  if (signals.heat >= THRESHOLDS.hostileHeat) {
    rules.push(
      dont(
        "hostile",
        "heat",
        signals.heat,
        THRESHOLDS.hostileHeat,
        "Tone is past sharp and into hostile.",
      ),
    );
  }

  if (signals.passiveAggressive >= THRESHOLDS.passiveAggressive) {
    rules.push(
      dont(
        "passive_aggressive",
        "passive_aggressive",
        signals.passiveAggressive,
        THRESHOLDS.passiveAggressive,
        "Reads as passive-aggressive.",
      ),
    );
  }

  const misreadAt = channel === "tweet" ? THRESHOLDS.tweetMisread : THRESHOLDS.misread;
  if (signals.willMisread >= misreadAt) {
    rules.push(
      hold(
        "misread",
        "will_misread",
        signals.willMisread,
        misreadAt,
        "A reasonable reader could take this the wrong way.",
      ),
    );
  }

  if (
    signals.hasAsk >= THRESHOLDS.buriedAskNeedsAsk &&
    signals.buriedAsk >= THRESHOLDS.buriedAsk
  ) {
    rules.push(
      hold(
        "buried",
        "buried_ask",
        signals.buriedAsk,
        THRESHOLDS.buriedAsk,
        "There is an ask, but a busy reader will miss it.",
      ),
    );
  }

  const expectsAction = signals.hasAsk >= THRESHOLDS.buriedAskNeedsAsk || signals.kind === "ask";
  if (expectsAction && signals.missingContext >= THRESHOLDS.missingContext) {
    rules.push(
      hold(
        "context",
        "missing_context",
        signals.missingContext,
        THRESHOLDS.missingContext,
        "The recipient would have to ask a follow-up before acting.",
      ),
    );
  }

  if (signals.hedge >= THRESHOLDS.overHedged) {
    rules.push(
      hold(
        "hedge",
        "hedge",
        signals.hedge,
        THRESHOLDS.overHedged,
        "The point is lost in hedges.",
      ),
    );
  }

  if (SHORT_CHANNELS.has(channel) && signals.length >= THRESHOLDS.tooLong) {
    rules.push(
      hold(
        "length",
        "length",
        signals.length,
        THRESHOLDS.tooLong,
        `Too long for ${channel}.`,
      ),
    );
  }

  if (signals.soundsGenerated >= THRESHOLDS.generated) {
    rules.push(
      hold(
        "generated",
        "sounds_generated",
        signals.soundsGenerated,
        THRESHOLDS.generated,
        "Reads as padded or machine-written.",
      ),
    );
  }

  if (WORK_CHANNELS.has(channel) && signals.unclearNext >= THRESHOLDS.unclearNext) {
    rules.push(
      hold(
        "next",
        "unclear_next",
        signals.unclearNext,
        THRESHOLDS.unclearNext,
        "Unclear who should do what next.",
      ),
    );
  }

  if (
    signals.heat >= THRESHOLDS.sharpAndMisreadHeat &&
    signals.willMisread >= THRESHOLDS.sharpAndMisread
  ) {
    rules.push(
      hold(
        "sharp_misread",
        "will_misread",
        signals.willMisread,
        THRESHOLDS.sharpAndMisread,
        "Sharp, and easy to misread.",
      ),
    );
  }

  if (signals.kind === "vent" && channel !== "tweet") {
    rules.push(
      hold(
        "vent",
        "kind",
        signals.kindConfidence,
        0,
        "This is a vent. Work channels keep it.",
      ),
    );
  }

  rules.sort((a, b) => {
    if (a.verdict !== b.verdict) return a.verdict === "dont" ? -1 : 1;
    return over(b.value, b.threshold) - over(a.value, a.threshold);
  });

  const verdict = rules.some((rule) => rule.verdict === "dont")
    ? "dont"
    : rules.length > 0
      ? "hold"
      : "send";

  return { verdict, rules, kind: signals.kind };
}

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function asKind(value: string): Kind {
  return isKind(value) ? value : "other";
}
