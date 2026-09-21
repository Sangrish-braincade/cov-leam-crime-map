// police.uk outcome statuses folded into groups a reader can act on.
export const OUTCOME_GROUPS = [
  { id: "no-suspect", label: "No suspect identified" },
  { id: "not-prosecuted", label: "Suspect known, not prosecuted" },
  { id: "court", label: "Charged or at court" },
  { id: "out-of-court", label: "Dealt with out of court" },
  { id: "open", label: "Still under investigation" },
  { id: "public-interest", label: "No further action (public interest)" },
  { id: "unknown", label: "Status not available" },
] as const;

export type OutcomeGroupId = (typeof OUTCOME_GROUPS)[number]["id"];

export function outcomeGroup(outcome: string | null): OutcomeGroupId | null {
  if (outcome === null) return null; // anti-social behaviour: not a crime, no outcome
  const o = outcome.toLowerCase();
  if (o.includes("no suspect identified")) return "no-suspect";
  if (o.includes("unable to prosecute")) return "not-prosecuted";
  if (o.includes("under investigation")) return "open";
  if (o.includes("public interest")) return "public-interest";
  if (o.includes("status update unavailable")) return "unknown";
  if (
    o.includes("court") ||
    o.includes("charged") ||
    o.includes("sent to prison") ||
    o.includes("found not guilty") ||
    o.includes("sentence") ||
    o.includes("fined") ||
    o.includes("discharge") ||
    o.includes("community")
  )
    return "court";
  if (o.includes("local resolution") || o.includes("caution") || o.includes("another organisation") || o.includes("penalty notice") || o.includes("cannabis") || o.includes("khat"))
    return "out-of-court";
  return "unknown";
}
