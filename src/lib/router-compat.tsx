"use client";

/**
 * react-router-dom compatibility layer on top of next/navigation.
 * Lets the migrated pages keep their original imports with identical
 * semantics (Link to=, NavLink active states, useNavigate, useLocation,
 * useParams, useSearchParams, Navigate).
 */
import NextLink from "next/link";
import {
  useRouter,
  usePathname,
  useSearchParams as useNextSearchParams,
  useParams as useNextParams,
} from "next/navigation";
import {
  forwardRef,
  useCallback,
  useEffect,
  type AnchorHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Link
// ---------------------------------------------------------------------------
export interface LinkProps {
  to: string;
  replace?: boolean;
  state?: unknown;
  className?: string;
  children?: ReactNode;
  style?: CSSProperties;
  target?: string;
  rel?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  id?: string;
  title?: string;
  role?: string;
  "aria-label"?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  ({ to, replace, state: _state, ...props }, ref) => (
    <NextLink href={to} replace={replace} ref={ref} {...props} />
  )
);
Link.displayName = "Link";

// ---------------------------------------------------------------------------
// NavLink — react-router style active class handling
// ---------------------------------------------------------------------------
export interface NavLinkProps extends Omit<LinkProps, "className"> {
  className?: string | ((args: { isActive: boolean; isPending: boolean }) => string | undefined);
  activeClassName?: string;
  end?: boolean;
}

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ to, className, activeClassName, end, ...props }, ref) => {
    const pathname = usePathname() ?? "";
    const path = String(to);
    const isActive =
      path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path.endsWith("/") ? path : path + "/");
    const resolved =
      typeof className === "function"
        ? className({ isActive, isPending: false })
        : cn(className, isActive && activeClassName);
    return <NextLink href={path} ref={ref} className={resolved} {...props} />;
  }
);
NavLink.displayName = "NavLink";

// ---------------------------------------------------------------------------
// hooks
// ---------------------------------------------------------------------------
export function useNavigate() {
  const router = useRouter();
  return useCallback(
    (to: string | number, opts?: { replace?: boolean; state?: unknown }) => {
      if (typeof to === "number") {
        if (to < 0) router.back();
        else router.forward();
        return;
      }
      if (opts?.replace) router.replace(to);
      else router.push(to);
    },
    [router]
  );
}

export function useLocation() {
  const pathname = usePathname() ?? "";
  const searchParams = useNextSearchParams();
  const qs = searchParams?.toString();
  return {
    pathname,
    search: qs ? `?${qs}` : "",
    hash: "",
    state: null,
    key: "default",
  };
}

export function useParams<T extends Record<string, string | string[]> = Record<string, string>>(): T {
  return useNextParams() as unknown as T;
}

export function useSearchParams(): [
  URLSearchParams,
  (init: Record<string, string> | URLSearchParams, opts?: { replace?: boolean }) => void
] {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const sp = useNextSearchParams();
  const set = useCallback(
    (init: Record<string, string> | URLSearchParams, opts?: { replace?: boolean }) => {
      const params = init instanceof URLSearchParams ? init : new URLSearchParams(init);
      const url = `${pathname}?${params.toString()}`;
      if (opts?.replace) router.replace(url);
      else router.push(url);
    },
    [router, pathname]
  );
  return [sp as unknown as URLSearchParams, set];
}

// ---------------------------------------------------------------------------
// Navigate — declarative redirect
// ---------------------------------------------------------------------------
export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (replace) router.replace(to);
    else router.push(to);
  }, [router, to, replace]);
  return null;
}
