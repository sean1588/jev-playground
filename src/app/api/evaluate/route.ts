import { NextRequest } from "next/server";
import { maybeGate } from "@/lib/gate";
import { evaluateWithJev, JevError } from "@/lib/jev";
import { parseEvaluateBody } from "@/lib/schema";

export async function POST(req: NextRequest) {
  const started = Date.now();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = parseEvaluateBody(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const response = await evaluateWithJev(parsed.request);
    return Response.json({
      answers: response.answers,
      latencyMs: Date.now() - started,
      usage: response.usage,
      model: response.model,
      gate: maybeGate(parsed.request, response),
    });
  } catch (error) {
    if (error instanceof JevError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Evaluation failed." }, { status: 500 });
  }
}
