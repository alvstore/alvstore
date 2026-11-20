export interface CustomerMetadata {
  customerType: "B2B" | "B2C";
  isVIP: boolean;
  creditLimit: string | null;
  cleanNotes: string;
}

export function parseCustomerMetadata(
  notes: string | null | undefined,
  gstNumber: string | null | undefined
): CustomerMetadata {
  const isB2B = !!(gstNumber && gstNumber.trim().length > 0);
  const text = notes || "";
  const isVIP = /\[VIP\]|\bVIP\b/i.test(text);
  const creditMatch = text.match(/\[Credit(?:\s*Limit)?:\s*([^\]]+)\]/i);
  const creditLimit = creditMatch ? creditMatch[1].trim() : null;
  const cleanNotes = text
    .replace(/\[VIP\]/gi, "")
    .replace(/\[Credit(?:\s*Limit)?:\s*[^\]]+\]/gi, "")
    .trim();
  return {
    customerType: isB2B ? "B2B" : "B2C",
    isVIP,
    creditLimit,
    cleanNotes,
  };
}

export function serializeCustomerNotes(
  cleanNotes: string,
  isVIP: boolean,
  creditLimit: string | null
): string | null {
  const tags: string[] = [];
  if (isVIP) tags.push("[VIP]");
  if (creditLimit && creditLimit.trim()) tags.push(`[Credit: ${creditLimit.trim()}]`);
  const prefix = tags.join(" ");
  if (prefix && cleanNotes.trim()) return `${prefix}\n${cleanNotes.trim()}`;
  if (prefix) return prefix;
  return cleanNotes.trim() || null;
}
