type Rgb = [number, number, number];

function parseRgb(color: string): Rgb | null {
  const s = color.trim().toLowerCase();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
      ];
    }
    if (hex.length === 6 || hex.length === 8) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ];
    }
    return null;
  }
  const rgbMatch = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (rgbMatch) {
    return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])].map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
    ) as Rgb;
  }
  const hslMatch = s.match(/^hsla?\(\s*([\d.]+)[,\s]+([\d.]+)%?[,\s]+([\d.]+)%?/);
  if (hslMatch) {
    const h = Number(hslMatch[1]);
    const sat = Number(hslMatch[2]) / 100;
    const lig = Number(hslMatch[3]) / 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = sat * Math.min(lig, 1 - lig);
    const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
  }
  return null;
}

function relativeLuminance([r, g, b]: Rgb): number {
  const lin = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function wcagContrast(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function mixRgb(from: Rgb, to: Rgb, amount: number): Rgb {
  return [
    Math.round(from[0] + (to[0] - from[0]) * amount),
    Math.round(from[1] + (to[1] - from[1]) * amount),
    Math.round(from[2] + (to[2] - from[2]) * amount),
  ];
}

function toRgbCss([r, g, b]: Rgb): string {
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Produce soft Materialize/Vuexy-style pill fill + foreground ink guaranteed
 * to achieve >= 4.5:1 WCAG AA contrast over both light and dark cards.
 */
export function pastelPillColors(
  baseColor: string,
  surfaceBg: string,
  isDark: boolean
): { backgroundColor: string; color: string } {
  const base = parseRgb(baseColor) ?? (isDark ? [129, 140, 248] : [79, 70, 229]);
  const surface = parseRgb(surfaceBg) ?? (isDark ? [18, 18, 18] : [255, 255, 255]);
  const alphaVal = isDark ? 0.18 : 0.12;
  const compositedBg = mixRgb(surface, base, alphaVal);
  const backgroundColor = `rgba(${base[0]}, ${base[1]}, ${base[2]}, ${alphaVal})`;

  const targetAnchor: Rgb = isDark ? [255, 255, 255] : [0, 0, 0];
  let ink = mixRgb(base, targetAnchor, isDark ? 0.28 : 0.32);
  for (let t = 0.25; t <= 0.96; t += 0.06) {
    const candidate = mixRgb(base, targetAnchor, Math.min(0.96, t));
    if (wcagContrast(candidate, compositedBg) >= 4.7) {
      ink = candidate;
      break;
    }
    ink = candidate;
  }
  if (wcagContrast(ink, compositedBg) < 4.5) {
    ink = isDark ? [248, 250, 252] : [15, 23, 42];
  }

  return { backgroundColor, color: toRgbCss(ink) };
}

/** Opaque tinted header fill for sticky table headers (never translucent). */
export function solidHeaderBg(surfaceBg: string, isDark: boolean): string {
  const base = parseRgb(surfaceBg) ?? (isDark ? [18, 18, 18] : [255, 255, 255]);
  const tint: Rgb = isDark ? [255, 255, 255] : [34, 48, 62];
  return toRgbCss(mixRgb(base, tint, isDark ? 0.055 : 0.04));
}

/** Adjust a palette accent color until it meets >= 4.5:1 WCAG AA contrast on `surfaceBg`. */
export function solidTextTone(baseColor: string, surfaceBg: string, isDark: boolean): string {
  const fg = parseRgb(baseColor) ?? (isDark ? [129, 140, 248] : [79, 70, 229]);
  const bg = parseRgb(surfaceBg) ?? (isDark ? [18, 18, 18] : [255, 255, 255]);
  if (wcagContrast(fg, bg) >= 4.55) return toRgbCss(fg);
  const target: Rgb = isDark ? [248, 250, 252] : [15, 23, 42];
  for (let step = 1; step <= 20; step += 1) {
    const candidate = mixRgb(fg, target, step / 20);
    if (wcagContrast(candidate, bg) >= 4.6) return toRgbCss(candidate);
  }
  return toRgbCss(target);
}
