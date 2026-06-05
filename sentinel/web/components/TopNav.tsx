"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isLive } from "@/lib/contracts";

const LINKS = [
  { href: "/", label: "Mandate" },
  { href: "/floor", label: "Live Floor" },
  { href: "/proof", label: "Proof" },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-grid bg-ink-900/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1500px] items-center gap-6 px-5 py-3">
        <Link href="/" className="group flex items-center gap-3">
          <span className="relative grid h-7 w-7 place-items-center rounded-sm border border-signal/40 bg-signal/10">
            <span className="block h-2.5 w-2.5 rounded-[2px] bg-signal shadow-signal-glow" />
          </span>
          <span className="font-sans text-sm font-semibold uppercase tracking-[0.32em] text-muted-bright group-hover:text-signal">
            Sentinel
          </span>
          <span className="hidden font-mono text-2xs uppercase tracking-[0.2em] text-muted sm:inline">
            Agent Risk Firewall
          </span>
        </Link>

        <nav className="ml-4 flex items-center gap-5">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`nav-link ${active ? "nav-link-active" : ""}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <span className="hidden font-mono text-2xs uppercase tracking-[0.18em] text-muted md:inline">
            Arbitrum Sepolia · 421614
          </span>
          <span
            className={`flex items-center gap-2 rounded-sm border px-2.5 py-1 font-mono text-2xs uppercase tracking-[0.18em] ${
              isLive
                ? "border-signal/40 text-signal"
                : "border-caution/40 text-caution"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isLive ? "bg-signal animate-pulse" : "bg-caution animate-pulse"
              }`}
            />
            {isLive ? "Live" : "Demo Mode"}
          </span>
        </div>
      </div>
    </header>
  );
}
