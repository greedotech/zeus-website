// lib/tier.ts

export type Tier = "STANDARD" | "SILVER" | "GOLD" | "DIAMOND";

export function getTierForCoins(coins: number): Tier {
  if (coins >= 50000) return "DIAMOND";
  if (coins >= 25000) return "GOLD";
  if (coins >= 10000) return "SILVER";
  return "STANDARD";
}

export function getTierLabel(tier: Tier): string {
  switch (tier) {
    case "SILVER":
      return "Silver (50% platform redeem fees covered)";
    case "GOLD":
      return "Gold (100% platform redeem fees covered)";
    case "DIAMOND":
      return "Diamond (100% fees + 5% bonus on deposits over $50)";
    default:
      return "Standard";
  }
}

export function getTierProgress(coins: number): {
  current: Tier;
  next: Tier | null;
  currentMin: number;
  nextMin: number | null;
  neededForNext: number | null;
  percentToNext: number | null;
} {
  const tier = getTierForCoins(coins);

  if (tier === "DIAMOND") {
    return {
      current: "DIAMOND",
      next: null,
      currentMin: 50000,
      nextMin: null,
      neededForNext: null,
      percentToNext: null,
    };
  }

  let next: Tier;
  let currentMin = 0;
  let nextMin = 0;

  if (tier === "STANDARD") {
    next = "SILVER";
    currentMin = 0;
    nextMin = 10000;
  } else if (tier === "SILVER") {
    next = "GOLD";
    currentMin = 10000;
    nextMin = 25000;
  } else {
    // GOLD
    next = "DIAMOND";
    currentMin = 25000;
    nextMin = 50000;
  }

  const neededForNext = Math.max(0, nextMin - coins);
  const span = nextMin - currentMin;
  const progress = Math.min(
    100,
    Math.max(0, ((coins - currentMin) / span) * 100)
  );

  return {
    current: tier,
    next,
    currentMin,
    nextMin,
    neededForNext,
    percentToNext: Math.round(progress),
  };
}