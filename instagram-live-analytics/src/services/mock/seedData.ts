/**
 * Fictional sample content for the demo data source. All usernames are
 * invented; none refer to real accounts.
 */

const FIRST = [
  "maya", "jordan", "alex", "sam", "nina", "leo", "zara", "kai", "ivy", "theo", "ruby", "omar",
  "lena", "felix", "aria", "noah", "mila", "ezra", "sofia", "jonah", "tessa", "idris", "luca", "priya",
  "hana", "diego", "amara", "finn", "yara", "nico", "elsie", "remy", "juno", "arlo", "ines", "kofi",
  "wren", "sasha", "bea", "tomas", "anya", "malik", "cleo", "otis", "lior", "esme", "ravi", "dara",
];
const SUFFIX = [
  "creates", ".studio", "_films", ".design", "writes", "_co", ".jpg", "makes", "daily", ".art",
  "_visuals", ".builds", "shoots", "_draws", ".codes", "_motion", ".ink", "_sketch", "", "",
];

export function buildUsernamePool(size: number, rngNext: () => number) {
  const seen = new Set<string>();
  const out: { username: string; displayName: string }[] = [];
  while (out.length < size) {
    const f = FIRST[Math.floor(rngNext() * FIRST.length)];
    const s = SUFFIX[Math.floor(rngNext() * SUFFIX.length)];
    const n = rngNext() < 0.35 ? String(Math.floor(rngNext() * 99)) : "";
    const username = `${f}${s}${n}`;
    if (seen.has(username)) continue;
    seen.add(username);
    out.push({ username, displayName: f[0].toUpperCase() + f.slice(1) });
  }
  return out;
}

export const GENERIC_COMMENTS = [
  "hi from london 👋", "just joined!", "hey everyone", "love this 🔥", "so good", "🙌🙌🙌",
  "this is gold", "taking notes 📝", "facts", "yesss", "❤️❤️", "hello from lagos!", "hiii",
  "first time catching you live", "great energy today", "this is so helpful", "wow", "👏👏",
  "agree 100%", "needed this today", "hello from toronto", "back again!", "the lighting looks amazing",
  "saving this", "lol", "this is why I follow you", "🔥🔥🔥", "love the setup",
];

export const SPAM_COMMENTS = [
  "DM me for promo 💸 bit.ly/grow-fast",
  "follow me for free followers!!!",
  "check my page for crypto signals 🚀",
  "cheap followers link in bio",
];

export interface QuestionTemplate {
  /** Variants of the same underlying question. */
  variants: string[];
}

export const TOPIC_LIBRARY: Record<string, { comments: string[]; questions: QuestionTemplate[] }> = {
  "Intro & catch-up": {
    comments: ["how was your week?", "missed you last week", "excited for this one"],
    questions: [{ variants: ["will this be saved as a replay?", "is there a replay after?", "will you save the replay?"] }],
  },
  "Pricing your work": {
    comments: ["I always undercharge 😅", "this pricing tip is huge", "raising my rates tomorrow"],
    questions: [
      { variants: ["how do you price a logo project?", "how much should I charge for a logo?", "what do you charge for logos?"] },
      { variants: ["hourly or per project?", "do you charge hourly or per project?", "per project or hourly rate?"] },
    ],
  },
  "Gear & studio setup": {
    comments: ["that mic sounds crisp", "love the desk setup", "the lighting is 🔥"],
    questions: [
      { variants: ["what mic are you using?", "what mic is that?", "which microphone do you use?"] },
      { variants: ["what camera do you use?", "which camera is this?", "what camera are you using for lives?"] },
    ],
  },
  "Portfolio reviews": {
    comments: ["please review mine!", "such good feedback", "this critique is so kind"],
    questions: [{ variants: ["can you review my portfolio?", "will you review my portfolio next?", "can you look at my portfolio please?"] }],
  },
  "Audience Q&A": {
    comments: ["great question", "same question!", "love this answer"],
    questions: [
      { variants: ["how did you get your first client?", "how did you land your first client?", "how do I find my first client?"] },
      { variants: ["when is the next live?", "when's your next live?", "will you go live next week?"] },
    ],
  },
  "Building a content system": {
    comments: ["batching changed my life", "need this template", "notion setup looks clean"],
    questions: [{ variants: ["can you share the template?", "is the template available?", "where can I get the template?"] }],
  },
  "Giveaway announcement": {
    comments: ["ME PLEASE 🙏", "entering!!", "omg giveaway", "count me in", "🎁🎁🎁"],
    questions: [{ variants: ["how do I enter the giveaway?", "how do we enter?", "what are the giveaway rules?"] }],
  },
  "Brand deals & collabs": {
    comments: ["this is so transparent", "nobody talks about this", "contract tips 🙏"],
    questions: [{ variants: ["how do you pitch to brands?", "how do you reach out to brands?", "how to pitch brands as a small creator?"] }],
  },
  "Wrap-up": {
    comments: ["thank you!!", "this was amazing", "see you next time", "bye 👋", "so worth it"],
    questions: [{ variants: ["where is the link you mentioned?", "can you drop the link?", "link please?"] }],
  },
  "Guest conversation": {
    comments: ["love you both", "this duo 🔥", "the collab we needed", "please do this again"],
    questions: [{ variants: ["how did you two meet?", "how did you guys meet?", "how do you know each other?"] }],
  },
};

export const GUEST_POOL = [
  { username: "maya.frames", displayName: "Maya Okafor" },
  { username: "theo.makes.type", displayName: "Theo Lindqvist" },
  { username: "priya_brandlab", displayName: "Priya Raman" },
  { username: "jonah.motion", displayName: "Jonah Reyes" },
  { username: "ines.illustrates", displayName: "Inês Duarte" },
];

export const PREVIOUS_LIVE_TITLES = [
  "Pricing Your Creative Work (No Fluff)",
  "Studio Tour + Gear Q&A",
  "Portfolio Review Night",
  "How I Plan a Month of Content",
  "Ask Me Anything: Freelancing",
  "Brand Deals for Small Creators",
  "Sunday Sketch Session",
  "Building a Personal Brand from Zero",
  "Client Horror Stories (and Fixes)",
  "Type Design Deep Dive",
  "Behind the Scenes: Rebrand Project",
  "Q&A: Burnout & Boundaries",
  "Live Logo Challenge",
  "Motion Design Basics",
  "Growing on Reels in 2026",
  "Friday Feedback Session",
  "Monthly Recap + Giveaway",
  "Creative Tools I Actually Use",
];
