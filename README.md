# Jev playground

A UI over TypeSafe's System One API. You set a **state** (text or JSON) and a map of typed **questions** (noul / choice / score). Jev answers them in one parallel pass. No prose comes back.

Send/Hold is a preset, not the app: twelve questions on a draft, then `src/lib/policy.ts` composes SEND / HOLD / DON'T. Load a different preset, or build your own request.

Calls `POST https://openrouter.ai/api/alpha/decisions` as `typesafe/jev-1.13`.

## Run

```bash
cp .env.example .env.local
# OPENROUTER_API_KEY is also picked up from the environment
npm install
npm test
npm run dev
```

Open [http://localhost:3007](http://localhost:3007). ⌘↵ runs.

## Shape

| File | What it is |
| --- | --- |
| `src/lib/schema.ts` | Request validation — the API contract |
| `src/lib/presets.ts` | Starting points, including Send/Hold |
| `src/lib/policy.ts` | Send/Hold gate. Only runs when that question set is intact |
| `src/lib/jev.ts` | OpenRouter decisions client |
| `src/app/api/evaluate/route.ts` | Server route. Key never hits the browser |
