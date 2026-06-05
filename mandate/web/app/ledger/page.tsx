"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useVaultEvents, type ActivityEvent } from "@/lib/useVaultEvents";
import { blockscoutTx } from "@/lib/wagmi";
import { STOCKS } from "@/lib/contracts";
import { cx, pct, shortHash, timeAgo, usd } from "@/lib/format";

export default function LedgerPage() {
  const vault = useVaultEvents();

  // Only settled receipts belong in the accountability ledger.
  const receipts = useMemo(
    () =>
      vault.feed.filter(
        (e) => (e.status === "EXECUTED" || e.status === "REVERTED") && e.kind !== "PolicyCheck"
      ),
    [vault.feed]
  );

  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="room-default min-h-[calc(100vh-3.5rem)]">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Accountability ledger</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-mute">
              Every rebalance your agent ever attempted, as a verifiable on-chain receipt: pre/post
              weights, the oracle prices it used, and the keccak256 hash of its rationale. Nothing is
              taken on trust.
            </p>
          </div>
          <div className="card px-5 py-3 text-right">
            <span className="label">Receipts</span>
            <div className="num text-2xl font-semibold text-white/90">{receipts.length}</div>
            <span className="num text-[10px] text-faint">on-chain · verifiable</span>
          </div>
        </div>

        {/* column header */}
        <div className="mt-8 grid grid-cols-12 gap-3 border-b border-hair px-4 pb-2">
          <span className="label col-span-1">#</span>
          <span className="label col-span-4">Action</span>
          <span className="label col-span-2 text-right">Notional</span>
          <span className="label col-span-2 text-right">Status</span>
          <span className="label col-span-3 text-right">Receipt</span>
        </div>

        <div className="mt-2 space-y-2">
          {receipts.map((r) => (
            <ReceiptRow
              key={r.id}
              receipt={r}
              open={openId === r.id}
              onToggle={() => setOpenId((cur) => (cur === r.id ? null : r.id))}
            />
          ))}
          {receipts.length === 0 && (
            <div className="rounded-xl border border-hairsoft bg-panel2/30 px-4 py-10 text-center">
              <span className="num text-sm text-faint">
                No settled receipts yet — head to the Control Room and let the agent work.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReceiptRow({
  receipt,
  open,
  onToggle,
}: {
  receipt: ActivityEvent;
  open: boolean;
  onToggle: () => void;
}) {
  const isRevert = receipt.status === "REVERTED";

  return (
    <div
      className={cx(
        "overflow-hidden rounded-xl border bg-panel2/40",
        isRevert ? "border-breach/40" : "border-hairsoft"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="grid w-full grid-cols-12 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-panel2/60"
      >
        <span className="num col-span-1 text-sm text-faint">#{receipt.nonce}</span>
        <span className="col-span-4 min-w-0">
          <span className="block truncate text-sm font-medium text-white/90">{receipt.summary}</span>
          <span className="num text-[11px] text-faint">{timeAgo(receipt.timestamp)}</span>
        </span>
        <span className="num col-span-2 text-right text-sm text-white/80">
          {receipt.notionalUsd > 0 ? usd(receipt.notionalUsd, true) : "—"}
        </span>
        <span className="col-span-2 text-right">
          <span
            className={cx(
              "num inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider",
              isRevert ? "border-breach/45 text-breach" : "border-bound/30 text-bound"
            )}
          >
            {receipt.status}
          </span>
        </span>
        <span className="col-span-3 flex items-center justify-end gap-2">
          {receipt.txHash && (
            <a
              href={blockscoutTx(receipt.txHash)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="num text-[11px] text-mute underline-offset-2 hover:text-bound hover:underline"
            >
              {shortHash(receipt.txHash)}
            </a>
          )}
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className={cx("text-faint transition-transform", open && "rotate-180")}
            aria-hidden
          >
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="border-t border-hairsoft px-4 py-4"
        >
          <div className="grid gap-6 md:grid-cols-2">
            {/* weights table */}
            <div>
              <span className="label">Weights · pre → post</span>
              <div className="mt-3 space-y-1.5">
                {(receipt.symbols ?? []).map((sym, i) => {
                  const pre = receipt.preWeightsBps?.[i] ?? 0;
                  const post = receipt.postWeightsBps?.[i] ?? pre;
                  return (
                    <div key={sym} className="flex items-center gap-3 text-sm">
                      <span
                        className="h-2 w-2 shrink-0 rounded-sm"
                        style={{ background: STOCKS[sym]?.color ?? "#14E08A" }}
                      />
                      <span className="w-12 font-medium">{sym}</span>
                      <span className="num w-16 text-right text-mute">{pct(pre)}</span>
                      <span className="text-faint">→</span>
                      <span
                        className={cx(
                          "num w-16 text-right",
                          isRevert ? "text-breach line-through" : "text-bound"
                        )}
                      >
                        {isRevert ? pct(pre) : pct(post)}
                      </span>
                    </div>
                  );
                })}
                {(receipt.symbols ?? []).length === 0 && (
                  <span className="num text-xs text-faint">Weights not recorded for this entry.</span>
                )}
              </div>
            </div>

            {/* oracle prices + rationale */}
            <div className="space-y-4">
              <div>
                <span className="label">Oracle prices used</span>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {(receipt.symbols ?? []).map((sym, i) => {
                    const raw = receipt.oraclePrices?.[i];
                    const price = raw ? raw / 1e8 : undefined;
                    return (
                      <div key={sym} className="flex items-center justify-between text-sm">
                        <span className="text-mute">{sym}</span>
                        <span className="num text-white/80">
                          {price ? usd(price, true) : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="label">Rationale</span>
                <p className={cx("mt-2 text-sm leading-relaxed", isRevert ? "text-breach/90" : "text-white/80")}>
                  {receipt.rationale}
                </p>
                <p className="num mt-1 text-[10px] text-faint">advisory only · off the validation path</p>
              </div>

              <div>
                <span className="label">rationaleHash</span>
                <div className="mt-1.5 flex items-center justify-between rounded-lg border border-hairsoft bg-canvas/40 px-3 py-2">
                  <code className="num truncate text-[11px] text-mute">{receipt.rationaleHash}</code>
                </div>
              </div>

              {isRevert && receipt.revertReason && (
                <div className="rounded-lg border border-breach/40 bg-breach/[0.06] px-3 py-2">
                  <span className="num text-[11px] text-breach">
                    Reverted on-chain · {receipt.revertReason}
                  </span>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
