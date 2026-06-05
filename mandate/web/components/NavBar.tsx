"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/format";
import { IS_DEMO_MODE } from "@/lib/contracts";

const LINKS = [
  { href: "/", label: "Onboarding" },
  { href: "/control", label: "Control Room" },
  { href: "/ledger", label: "Ledger" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-hair bg-canvas/70 backdrop-blur-glass">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="relative inline-flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-bound opacity-60 animate-pulseGreen" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-bound" />
          </span>
          <span className="text-sm font-semibold tracking-tight">Mandate</span>
          <span className="label ml-1 hidden sm:inline">Robinhood Chain</span>
        </Link>

        <nav className="flex items-center gap-1">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cx(
                  "rounded-md px-3 py-1.5 text-[13px] transition-colors",
                  active ? "bg-panel2 text-white" : "text-mute hover:text-white"
                )}
              >
                {l.label}
              </Link>
            );
          })}
          <span
            className={cx(
              "num ml-3 hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider sm:inline-flex",
              IS_DEMO_MODE
                ? "border-amber/40 text-amber"
                : "border-bound/40 text-bound"
            )}
          >
            <span
              className={cx(
                "h-1.5 w-1.5 rounded-full",
                IS_DEMO_MODE ? "bg-amber" : "bg-bound"
              )}
            />
            {IS_DEMO_MODE ? "Demo Mode" : "Live · 46630"}
          </span>
        </nav>
      </div>
    </header>
  );
}
