"use client";

import { useId, useState, cloneElement, type ReactElement, type ReactNode } from "react";
import { Menu, type SxProps, type Theme } from "@mui/material";

export function ActionMenu({ trigger, children, sx }: { trigger: ReactElement<{ onClick?: (event: React.MouseEvent<HTMLElement>) => void }>; children: ReactNode; sx?: SxProps<Theme> }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const id = useId();
  return <>
    {cloneElement(trigger, {
      onClick: event => { trigger.props.onClick?.(event); setAnchor(event.currentTarget); },
      ...{ "aria-haspopup": "menu", "aria-expanded": !!anchor, "aria-controls": anchor ? id : undefined },
    })}
    <Menu id={id} anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} onClick={() => setAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }} slotProps={{ paper: { sx } }}>{children}</Menu>
  </>;
}
