"use client";

import { Box, Skeleton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, type TableProps } from "@mui/material";
import { keyframes } from "@emotion/react";
import { Children, isValidElement, type ReactNode } from "react";
import { EmptyState } from "./EmptyState";
import { entranceDelay, motionTokens } from "@/lib/motion-presets";

const rowEntrance = keyframes`from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; }`;
export interface DataColumn<T> { key: string; label: ReactNode; render?: (row: T) => ReactNode; align?: "left" | "center" | "right"; }
export type DataTableProps<T> = TableProps & {
  columns?: DataColumn<T>[]; rows?: T[]; getRowId?: (row: T, index: number) => string | number;
  loading?: boolean; empty?: boolean; emptyMessage?: ReactNode; columnsCount?: number; maxHeight?: number | string;
};

/** Supports both column-driven CRUD lists and composed document/complex tables. */
export function DataTable<T extends object>({ columns, rows, getRowId, children, loading, empty, emptyMessage, columnsCount = columns?.length ?? 6, maxHeight = 560, sx, ...props }: DataTableProps<T>) {
  const parts = Children.toArray(children);
  const header = columns ? <TableHead><TableRow>{columns.map(c => <TableCell key={c.key} align={c.align}>{c.label}</TableCell>)}</TableRow></TableHead> : parts.filter(p => isValidElement(p) && p.type === TableHead);
  const body = columns && rows ? <TableBody>{rows.map((row, i) => <TableRow hover key={getRowId?.(row, i) ?? i}>{columns.map(c => <TableCell key={c.key} align={c.align}>{c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "—")}</TableCell>)}</TableRow>)}</TableBody> : parts.filter(p => !isValidElement(p) || p.type !== TableHead);
  const noRows = empty ?? (rows ? rows.length === 0 : false);
  return <TableContainer aria-busy={!!loading} sx={{ maxHeight, width: "100%", overflow: "auto", "@media print": { maxHeight: "none", overflow: "visible" } }}>
    <Table stickyHeader size="small" aria-label="Data table" {...props} sx={[{
      "& thead th": { bgcolor: "background.paper", color: "text.secondary", fontWeight: 650, whiteSpace: "nowrap" },
      "& td, & th": { borderColor: "divider", px: 2, py: 1.5 },
      "& tbody > tr": { animation: `${rowEntrance} ${motionTokens.base}s cubic-bezier(.22,1,.36,1) both`, "&:hover": { bgcolor: "action.hover" } },
      ...Object.fromEntries(Array.from({ length: 24 }, (_, i) => [`& tbody > tr:nth-of-type(${i + 1})`, { animationDelay: `${entranceDelay(i) * 1000}ms` }])),
      "@media (prefers-reduced-motion: reduce)": { "& tbody > tr": { animation: "none" } },
      "@media print": { "& tbody > tr": { animation: "none" }, "& thead th": { position: "static" } },
    }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {header}
      {loading ? <TableBody>{Array.from({ length: 5 }, (_, r) => <TableRow key={r}>{Array.from({ length: columnsCount }, (_, c) => <TableCell key={c}><Skeleton variant="text" /></TableCell>)}</TableRow>)}</TableBody>
        : noRows ? <TableBody><TableRow><TableCell colSpan={columnsCount}><EmptyState title={emptyMessage} /></TableCell></TableRow></TableBody> : body}
    </Table>
  </TableContainer>;
}
