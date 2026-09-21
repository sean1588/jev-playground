import { DEFAULT_MODEL } from "./schema";
import type { EvaluateRequest, JevResponse } from "./types";

const OPENROUTER_DECISIONS = "https://openrouter.ai/api/alpha/decisions";

export class JevError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "JevError";
    this.status = status;
  }
}

export async function evaluateWithJev(request: EvaluateRequest): Promise<JevResponse> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new JevError("OPENROUTER_API_KEY is not set on the server.", 500);
  }

  const res = await fetch(OPENROUTER_DECISIONS, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/sean1588/send-hold",
      "X-Title": "Jev playground",
    },
    body: JSON.stringify({
      model: request.model || DEFAULT_MODEL,
      state: request.state,
      questions: request.questions,
    }),
  });

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new JevError(`OpenRouter returned non-JSON (${res.status}).`, res.status);
  }

  if (!res.ok) {
    const message = openRouterMessage(body) ?? `OpenRouter error ${res.status}`;
    throw new JevError(message, res.status);
  }

  if (!isJevResponse(body)) {
    throw new JevError("OpenRouter returned an unexpected decisions payload.", 502);
  }

  return body;
}

function openRouterMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const error = (body as { error?: { message?: unknown } }).error;
  if (error && typeof error.message === "string") return error.message;
  return null;
}

function isJevResponse(body: unknown): body is JevResponse {
  if (!body || typeof body !== "object") return false;
  const value = body as Partial<JevResponse>;
  return (
    typeof value.model === "string" &&
    !!value.answers &&
    typeof value.answers === "object" &&
    !!value.usage &&
    typeof value.usage.input_tokens === "number"
  );
}
