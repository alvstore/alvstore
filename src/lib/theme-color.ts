/** MUI's color utilities need comma-separated HSL, including an explicit alpha. */
export function themeColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const [channels, opacity] = value.split("/").map(part => part.trim());
  const hsl = channels.split(/\s+/).join(", ");
  return opacity ? `hsla(${hsl}, ${opacity})` : `hsl(${hsl})`;
}
