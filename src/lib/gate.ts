import { parseSignals } from "./parse";
import { gateFor } from "./policy";
import { questionsForJev } from "./questions";
import { isChannel, type Channel, type EvaluateRequest, type Gate, type JevResponse } from "./types";

const SEND_HOLD_IDS = Object.keys(questionsForJev());

export function sendHoldChannel(request: EvaluateRequest): Channel | null {
  for (const id of SEND_HOLD_IDS) {
    if (!(id in request.questions)) return null;
  }

  const { state } = request;
  if (!state || typeof state !== "object" || Array.isArray(state)) return null;
  const channel = (state as { channel?: unknown }).channel;
  return isChannel(channel) ? channel : null;
}

export function maybeGate(request: EvaluateRequest, response: JevResponse): Gate | null {
  const channel = sendHoldChannel(request);
  if (!channel) return null;
  return gateFor(channel, parseSignals(response));
}
