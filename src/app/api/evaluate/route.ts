import { NextRequest } from "next/server";
import { evaluateWithJev, JevError } from "@/lib/jev";
import { parseSignals } from "@/lib/parse";
import { gateFor } from "@/lib/policy";
import { isChannel } from "@/lib/types";

const MAX_DRAFT = 8000;

export async function POST(req: NextRequest) {
  const started = Date.now();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "Expected an object." }, { status: 400 });
  }

  const { channel, draft } = body as { channel?: unknown; draft?: unknown };

  if (!isChannel(channel)) {
    return Response.json({ error: "Unknown channel." }, { status: 400 });
  }
  if (typeof draft !== "string") {
    return Response.json({ error: "Draft must be a string." }, { status: 400 });
  }

  const trimmed = draft.trim();
  if (trimmed.length === 0) {
    return Response.json({ error: "Draft is empty." }, { status: 400 });
  }
  if (trimmed.length > MAX_DRAFT) {
    return Response.json({ error: "Draft is too long." }, { status: 400 });
  }

  try {
    const response = await evaluateWithJev({ channel, draft: trimmed });
    const signals = parseSignals(response);
    const gate = gateFor(channel, signals);

    return Response.json({
      gate,
      signals,
      latencyMs: Date.now() - started,
      usage: response.usage,
      model: response.model,
    });
  } catch (error) {
    if (error instanceof JevError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Evaluation failed." }, { status: 500 });
  }
}
