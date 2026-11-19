"use client";

import { createContext, useContext, useId, useState, type ReactNode } from "react";
import { Box, Tabs, type BoxProps, type TabsProps } from "@mui/material";
import { keyframes } from "@emotion/react";
import { motionTokens } from "@/lib/motion-presets";

const panelEntrance = keyframes`from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; }`;

const TabState = createContext<{ value: string; setValue: (value: string) => void; id: string } | null>(null);
function useTabs() { const state = useContext(TabState); if (!state) throw new Error("TabBar/TabPanel must be inside TabView"); return state; }
export function TabView({ value: controlled, defaultValue = "", onChange, children, sx }: {
  value?: string; defaultValue?: string; onChange?: (value: string) => void; children?: ReactNode; sx?: BoxProps["sx"];
}) {
  const [internal, setInternal] = useState(defaultValue);
  const id = useId();
  return <TabState.Provider value={{ value: controlled ?? internal, setValue: value => { setInternal(value); onChange?.(value); }, id }}><Box sx={[{ minWidth: 0, maxWidth: "100%", width: "100%" }, ...(Array.isArray(sx) ? sx : [sx])]}>{children}</Box></TabState.Provider>;
}
export function TabBar({ children, sx, ...props }: Omit<TabsProps, "value" | "onChange">) {
  const state = useTabs();
  return <Tabs value={state.value} onChange={(_event, value: string) => state.setValue(value)} variant="scrollable" scrollButtons="auto" aria-label="View sections" {...props}
    sx={[{ minHeight: 40, borderBottom: 1, borderColor: "divider", "& .MuiTab-root": { minHeight: 40, textTransform: "none", fontSize: 13, gap: 0.5 } }, ...(Array.isArray(sx) ? sx : [sx])]}>{children}</Tabs>;
}
export function TabPanel({ value, children, sx, ...props }: BoxProps & { value: string }) {
  const state = useTabs();
  return <Box role="tabpanel" id={`${state.id}-${value}-panel`} aria-label={value.replace(/_/g, " ")} hidden={state.value !== value} {...props} sx={[{ pt: 2.5, animation: state.value === value ? `${panelEntrance} ${motionTokens.base}s cubic-bezier(.22,1,.36,1) both` : "none", "@media (prefers-reduced-motion: reduce)": { animation: "none" }, "@media print": { animation: "none" } }, ...(Array.isArray(sx) ? sx : [sx])]}>{state.value === value ? children : null}</Box>;
}
