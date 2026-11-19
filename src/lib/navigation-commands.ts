export interface NavigationCategory { label: string; items: { title: string; url: string }[] }
export interface NavigationCommand { id: string; title: string; url: string; section: string; action: boolean }

/** Derive both pages and creation shortcuts from this user's existing navigation. */
export function navigationCommands(categories: NavigationCategory[]): NavigationCommand[] {
  const allowed = new Set(categories.flatMap(category => category.items.map(item => item.url)));
  const shortcuts = [
    { parent: "/pos", title: "Start a sale", url: "/pos" },
    { parent: "/sales", title: "Create quotation", url: "/sales/new" },
    { parent: "/invoices", title: "Create invoice", url: "/invoices/new" },
    { parent: "/repairs", title: "Create repair job", url: "/repairs/new" },
    { parent: "/inventory", title: "Add product", url: "/inventory/add" },
  ].filter(shortcut => allowed.has(shortcut.parent)).map(shortcut => ({ id: `action:${shortcut.url}`, title: shortcut.title, url: shortcut.url, section: "Quick actions", action: true }));
  const pages = categories.flatMap(category => category.items.map(item => ({ id: `page:${item.url}`, title: item.title, url: item.url, section: category.label, action: false })));
  return [...shortcuts, ...pages];
}
