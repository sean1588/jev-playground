# Send / Hold

Jev judges a draft. Code decides whether you send it.

Paste a Slack, email, tweet, or PR comment. One call to TypeSafe's System One model (`typesafe/jev-1.13` via OpenRouter) answers twelve typed questions in parallel — yes/no probabilities, rubric scores, a message kind. **No prose comes back.** A small policy in `src/lib/policy.ts` composes those numbers into SEND, HOLD, or DON'T.

The interesting part is not the model call. It is that the gate is ordinary code with named thresholds you can change without touching a prompt.

## Run

```bash
cp .env.example .env.local
# OPENROUTER_API_KEY is also picked up from the environment
npm install
npm test
npm run dev
```

Open [http://localhost:3007](http://localhost:3007).

## Shape

| File | What it is |
| --- | --- |
| `src/lib/questions.ts` | The twelve questions Jev sees |
| `src/lib/policy.ts` | The gate. Thresholds live here |
| `src/lib/jev.ts` | `POST https://openrouter.ai/api/alpha/decisions` |
| `src/app/api/evaluate/route.ts` | Server route. Key never hits the browser |

Jev cannot generate a rewrite. If a draft is held, you edit it.
