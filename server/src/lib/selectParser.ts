/**
 * Parser for PostgREST-style select strings, e.g.
 *   "*, customers(name, phone)"
 *   "id, customer:customers!customer_id(name)"
 * Supports nesting, aliases (`alias:name(...)`) and hints (`name!fk(...)`).
 */

export type SelectNode =
  | { kind: "all" }
  | { kind: "column"; name: string }
  | {
      kind: "embed";
      name: string;
      alias?: string;
      hint?: string;
      inner?: boolean;
      aggregate?: "count";
      children: SelectNode[];
    };

export function parseSelect(input: string | undefined | null): SelectNode[] {
  if (!input || !input.trim()) return [{ kind: "all" }];
  const s = input.trim();
  const nodes: SelectNode[] = [];
  let i = 0;

  function parseElements(stopAtParen: boolean): SelectNode[] {
    const out: SelectNode[] = [];
    while (i < s.length) {
      // skip whitespace and commas
      while (i < s.length && /[\s,]/.test(s[i])) i++;
      if (i >= s.length) break;
      if (stopAtParen && s[i] === ")") break;

      if (s[i] === "*") {
        out.push({ kind: "all" });
        i++;
        continue;
      }

      // read an identifier-ish token (may include alias colon / hint !)
      let token = "";
      while (i < s.length && !/[\s,()]/.test(s[i])) {
        token += s[i];
        i++;
      }
      if (!token) {
        i++;
        continue;
      }

      // skip whitespace before possible '('
      while (i < s.length && /\s/.test(s[i])) i++;

      if (s[i] === "(") {
        // embed
        i++; // consume '('
        let name = token;
        let alias: string | undefined;
        let hint: string | undefined;
        const colonIdx = name.indexOf(":");
        if (colonIdx > 0) {
          alias = name.slice(0, colonIdx);
          name = name.slice(colonIdx + 1);
        }
        const bangIdx = name.indexOf("!");
        if (bangIdx > 0) {
          hint = name.slice(bangIdx + 1);
          name = name.slice(0, bangIdx);
          if (hint === "inner") {
            // inner join marker
            (out as unknown[]); // no-op
          }
        }
        const inner = hint === "inner";
        if (inner) hint = undefined;
        const children = parseElements(true);
        if (s[i] === ")") i++; // consume ')'
        const aggregate = name === "count" ? ("count" as const) : undefined;
        out.push({ kind: "embed", name, alias, hint, inner, aggregate, children });
      } else {
        out.push({ kind: "column", name: token });
      }
    }
    return out;
  }

  nodes.push(...parseElements(false));
  return nodes;
}
