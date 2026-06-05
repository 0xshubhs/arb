"use client";

import { useEffect } from "react";
import { animate, useMotionValue, useTransform, motion } from "framer-motion";

interface Props {
  value: number;
  /** Decimal places to render. */
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Render as a US-dollar amount. */
  currency?: boolean;
  className?: string;
}

/**
 * Counts up/down to `value` with a spring, formatting on every frame.
 * Always renders in the mono/tabular context via the `.num` class.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  currency = false,
  className,
}: Props) {
  const mv = useMotionValue(value);

  const text = useTransform(mv, (latest) => {
    if (currency) {
      return latest.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }
    return (
      prefix +
      latest.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }) +
      suffix
    );
  });

  useEffect(() => {
    const controls = animate(mv, value, {
      type: "spring",
      stiffness: 90,
      damping: 18,
      mass: 0.6,
    });
    return controls.stop;
  }, [value, mv]);

  return <motion.span className={`num ${className ?? ""}`}>{text}</motion.span>;
}
