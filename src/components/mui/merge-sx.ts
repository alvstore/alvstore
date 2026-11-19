import type { SxProps, Theme } from "@mui/material";

/** Compose optional/conditional sx values without losing nested selectors. */
export function mergeSx(...styles: Array<SxProps<Theme> | false | null | undefined>): SxProps<Theme> {
  return styles.flatMap(style => !style ? [] : Array.isArray(style) ? style : [style]) as SxProps<Theme>;
}
