/** Shared shell geometry; desktop content and drawer must always agree. Pixels. */
export const sidebarDimensions = { expanded: 288, compact: 88, inset: 12, mobile: 304 } as const;
export const sidebarTransition = "240ms cubic-bezier(.22,1,.36,1)";

export interface SidebarCategory {
  label: string;
  items: readonly { url: string }[];
}

function navigationPath(value: string) {
  const path = value.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  // The existing /customers entry redirects its list view to /crm.
  return path === "/crm" ? "/customers" : path;
}

export function isNavigationActive(pathname: string, url: string) {
  const path = navigationPath(pathname), base = navigationPath(url);
  return path === base || (base !== "/" && path.startsWith(`${base}/`));
}

/** Prefer the most specific parent; similar prefixes must not select two pages. */
export function navigationCategoryForPath(categories: readonly SidebarCategory[], pathname: string) {
  let match: string | undefined;
  let length = -1;
  for (const category of categories) for (const item of category.items) {
    if (item.url.length > length && isNavigationActive(pathname, item.url)) {
      match = category.label;
      length = item.url.length;
    }
  }
  return match;
}

/** Treat localStorage as untrusted input, retaining only known boolean preferences. */
export function parseSidebarGroups(raw: string | null, labels: readonly string[]): Record<string, boolean> {
  if (!raw) return {};
  try {
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    return Object.fromEntries(Object.entries(saved).filter(([label, value]) => labels.includes(label) && typeof value === "boolean"));
  } catch { return {}; }
}

/** A saved closed group must not conceal the page after a reload/deep link. */
export function revealNavigationGroup(groups: Record<string, boolean>, active?: string) {
  return active && groups[active] === false ? { ...groups, [active]: true } : groups;
}

/** Match the existing navigation precedence, including accounts with multiple roles. */
export function sidebarRoleLabel(roles: readonly string[]) {
  if (roles.includes("customer")) return "Customer";
  if (roles.includes("technician") && !roles.includes("admin") && !roles.includes("staff")) return "Technician";
  if (roles.includes("admin")) return "Administrator";
  return roles.includes("staff") ? "Team member" : "Workspace member";
}

export function sidebarIdentity(fullName: unknown, email?: string | null) {
  const name = typeof fullName === "string" && fullName.trim() ? fullName.trim() : email?.split("@")[0] || "Your account";
  const words = name.split(/\s+/);
  const initials = words.length > 1 ? `${Array.from(words[0])[0]}${Array.from(words.at(-1)!)[0]}` : Array.from(name).slice(0, 2).join("");
  return { name, initials: initials.toUpperCase() };
}
