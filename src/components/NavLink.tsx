"use client";

import { forwardRef } from "react";
import { NavLink as RouterNavLink } from "@/lib/router-compat";
import { cn } from "@/lib/utils";

interface NavLinkCompatProps {
  to: string;
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
  children?: React.ReactNode;
  end?: boolean;
  onClick?: () => void;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName: _pending, to, ...props }, ref) => {
    void _pending;
    return (
      <RouterNavLink
        ref={ref}
        to={to}
        className={({ isActive }: { isActive: boolean }) => cn(className, isActive && activeClassName)}
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
