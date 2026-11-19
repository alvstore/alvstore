"use client";

import { useEffect, useState, type RefObject } from "react";
import { useInView, useReducedMotion } from "framer-motion";

/** Repeating decoration must stop offscreen, in hidden tabs, and for reduced motion. */
export function useMotionActivity<T extends Element>(ref: RefObject<T | null>) {
  const reduced = useReducedMotion();
  const inView = useInView(ref, { margin: "100px" });
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return !reduced && inView && visible;
}
