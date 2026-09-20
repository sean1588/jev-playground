import type { Channel } from "./types";

export type Example = {
  id: string;
  title: string;
  channel: Channel;
  draft: string;
};

export const EXAMPLES: Example[] = [
  {
    id: "clean-ask",
    title: "Clean ask",
    channel: "slack",
    draft:
      "Hey — can you take a look at the deploy script when you have a minute? The staging job failed on the migration step. I left the error in the thread.",
  },
  {
    id: "buried",
    title: "Buried ask",
    channel: "slack",
    draft:
      "I've been waiting on this review for a week and I'm blocked on everything else. The tests are fine, I already addressed the nits from last time, and the rest of the stack is sitting on this. Anyway whenever you get a chance can you approve it.",
  },
  {
    id: "circling",
    title: "Circling back",
    channel: "email",
    draft:
      "Per my last email, I wanted to follow up on the timeline we discussed. I'm sure you're busy, but it would be great if we could finally get a decision here so the rest of us aren't left hanging.",
  },
  {
    id: "hostile",
    title: "Hostile review",
    channel: "pr",
    draft:
      "This is sloppy. You clearly didn't run the tests. I'm not going to keep cleaning up after this. Fix it.",
  },
  {
    id: "tweet",
    title: "Fine tweet",
    channel: "tweet",
    draft:
      "Shipped Send/Hold: Jev scores a draft, a tiny policy says send, hold, or don't. No generated rewrite.",
  },
];
