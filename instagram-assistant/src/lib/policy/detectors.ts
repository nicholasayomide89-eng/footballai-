/**
 * Deterministic content detectors for the hard rules. These run on every
 * outbound draft regardless of what the AI (or its critic) concluded, so a
 * model mistake can never be the only thing standing between a draft and
 * your account. They are deliberately conservative: a false positive turns
 * an automatic send into a draft for you to review, which is cheap.
 */

export type DetectorKey =
  | "no_sexual"
  | "no_offensive"
  | "no_arguments"
  | "no_financial"
  | "no_private_info"
  | "no_commitments";

export interface Detection {
  key: DetectorKey;
  message: string;
}

const SEXUAL = [
  /\b(sex|sexy|nudes?|naked|horny|hook ?up|dtf|onlyfans|send (me )?pics)\b/i,
  /\b(bed(room)? tonight|come over tonight|in bed with)\b/i,
];

const OFFENSIVE = [
  /\b(idiot|stupid|dumb(ass)?|moron|loser|pathetic|ugly|shut up|stfu|screw you|f+u+c+k+ (you|off|u)|bitch|slut|whore|retard(ed)?)\b/i,
];

const ARGUMENT = [
  /\b(you('re| are) (wrong|lying|a liar)|that'?s (not true|a lie|ridiculous)|whatever you say|i don'?t care what you think|you always|you never)\b/i,
];

const FINANCIAL = [
  /\b(send|lend|loan|borrow|transfer|wire|venmo|cash ?app|paypal|zelle|revolut|western union)\b.{0,30}\b(money|cash|\$|£|€|₦|dollars?|pounds?|naira|euros?)/i,
  /\b(bank (account|details)|account number|routing number|sort code|iban|swift|bvn|crypto wallet|seed phrase|pin code|cvv)\b/i,
  // Card numbers: 13-19 digits, optionally grouped.
  /\b(?:\d[ -]?){13,19}\b/,
  /\b(bitcoin|btc|eth|usdt)\b.{0,20}\b(address|send|wallet)\b/i,
];

const PRIVATE_INFO = [
  // Phone numbers: +country or 10+ digits with separators.
  /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{3,4}\b/,
  /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/,
  /\b\d{1,5}\s+\w+(\s\w+)?\s(street|st|road|rd|avenue|ave|close|crescent|lane|ln|drive|dr|way|boulevard|blvd)\b/i,
  /\b(my (home )?address is|i live at|my password|passcode|social security|ssn|passport number|national id|nin)\b/i,
];

const COMMITMENT = [
  /\b(i promise|i'?ll (definitely|be there|pay|send|bring|do it|call you|come)|i will (be there|pay|send|bring|call|come)|count me in|it'?s a deal|see you (at|on|tomorrow|tonight|then)|let'?s (meet|do|book|go)|booked|i can do (monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|tonight))\b/i,
  /\b(on|this|next) (monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend)\b/i,
  /\b(at|by) \d{1,2}(:\d{2})?\s?(am|pm)\b/i,
];

const TABLE: Array<[DetectorKey, RegExp[], string]> = [
  ["no_sexual", SEXUAL, "Looks sexual or suggestive."],
  ["no_offensive", OFFENSIVE, "Contains insulting or offensive language."],
  ["no_arguments", ARGUMENT, "Reads as argumentative."],
  ["no_financial", FINANCIAL, "Mentions money transfers or financial details."],
  ["no_private_info", PRIVATE_INFO, "Contains private information (phone, email, address or ID)."],
  ["no_commitments", COMMITMENT, "Makes a promise, plan or commitment."],
];

export function detect(text: string, enabled: ReadonlySet<string>): Detection[] {
  const hits: Detection[] = [];
  for (const [key, patterns, message] of TABLE) {
    if (!enabled.has(key)) continue;
    if (patterns.some((p) => p.test(text))) hits.push({ key, message });
  }
  return hits;
}

/** Normalised word set used for near-duplicate detection. */
function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1),
  );
}

/** Jaccard similarity of the two texts' word sets, 0..1. */
export function similarity(a: string, b: string): number {
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 && wb.size === 0) return a.trim() === b.trim() ? 1 : 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / (wa.size + wb.size - inter);
}
