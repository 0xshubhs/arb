import "dotenv/config";

/**
 * The off-chain "mandate compiler": turn ONE plain-English sentence into the structured on-chain
 * PolicyConfig, returned for human confirmation before the frontend writes it.
 *
 * The LLM AUTHORS policy and is STRUCTURALLY EXCLUDED from enforcement — `RiskEngine` evaluates the
 * compiled struct on-chain; nothing here is ever in the spend path.
 */
export interface PolicyConfig {
  velocityCapPerTx: bigint; // USDC, 6dp
  dailyCapUSDC: bigint; // USDC, 6dp
  drawdownBps: number;
  minCounterpartyReputation: number; // 0..100
  killSwitched: boolean;
}

const USDC = 1_000_000n;

/** Deterministic regex fallback so the compiler always works without an API key. */
export function compileWithRegex(sentence: string): PolicyConfig {
  const s = sentence.toLowerCase();

  const daily = s.match(/(\d+(?:\.\d+)?)\s*usdc?\s*(?:a|per)?\s*day/);
  const perTx = s.match(/(\d+(?:\.\d+)?)\s*usdc?\s*(?:per|each|a)\s*(?:tx|transaction|payment|spend)/);
  const dd = s.match(/(\d+(?:\.\d+)?)\s*%/);
  const rep = s.match(/reputation\s*(?:>=|over|above|of)?\s*(\d+)/);

  const dailyCap = daily ? BigInt(Math.round(parseFloat(daily[1]) * 1e6)) : 200n * USDC;
  const velocityCap = perTx ? BigInt(Math.round(parseFloat(perTx[1]) * 1e6)) : dailyCap / 4n;
  const drawdownBps = dd ? Math.round(parseFloat(dd[1]) * 100) : 2000;
  const wantsTrust = /unverified|untrusted|trusted|verified|reputable|denylist/.test(s);
  const minRep = rep ? Number(rep[1]) : wantsTrust ? 50 : 0;

  return {
    velocityCapPerTx: velocityCap,
    dailyCapUSDC: dailyCap,
    drawdownBps,
    minCounterpartyReputation: Math.min(100, minRep),
    killSwitched: false,
  };
}

export async function compilePolicy(sentence: string): Promise<{ cfg: PolicyConfig; via: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { cfg: compileWithRegex(sentence), via: "regex" };

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system:
        "You convert one plain-English spending mandate into JSON for an on-chain policy. " +
        "Reply with ONLY a JSON object: {velocityCapUSDC:number, dailyCapUSDC:number, " +
        "drawdownPercent:number, minCounterpartyReputation:number(0-100)}. " +
        "Use whole USDC dollars. If a field is unspecified, choose a sensible conservative default.",
      messages: [{ role: "user", content: sentence }],
    });
    const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    return {
      cfg: {
        velocityCapPerTx: BigInt(Math.round((json.velocityCapUSDC ?? 50) * 1e6)),
        dailyCapUSDC: BigInt(Math.round((json.dailyCapUSDC ?? 200) * 1e6)),
        drawdownBps: Math.round((json.drawdownPercent ?? 20) * 100),
        minCounterpartyReputation: Math.min(100, Math.max(0, json.minCounterpartyReputation ?? 50)),
        killSwitched: false,
      },
      via: "claude",
    };
  } catch {
    return { cfg: compileWithRegex(sentence), via: "regex-fallback" };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sentence =
    process.argv.slice(2).join(" ") ||
    "My agent may spend up to 50 USDC a day, never pay unverified contracts, and halt if it loses 20%.";
  compilePolicy(sentence).then(({ cfg, via }) => {
    console.log(`Compiled (${via}) from: "${sentence}"\n`);
    console.log(
      JSON.stringify(
        {
          velocityCapPerTx: cfg.velocityCapPerTx.toString(),
          dailyCapUSDC: cfg.dailyCapUSDC.toString(),
          drawdownBps: cfg.drawdownBps,
          minCounterpartyReputation: cfg.minCounterpartyReputation,
          killSwitched: cfg.killSwitched,
        },
        null,
        2,
      ),
    );
    console.log("\nConfirm, then PolicyRegistry.mint(cfg) writes it on-chain.");
  });
}
