// lib/tiers.ts

// NOTE: "Standard" is the base tier.
// Tier ladder: Standard → Bronze → Silver → Gold → Platinum → Diamond → Olympus
// Tiers are based on LIFETIME coins earned (never decreases on redemption)

export type Tier =
  | "Standard"
  | "Bronze"
  | "Silver"
  | "Gold"
  | "Platinum"
  | "Diamond"
  | "Olympus";

type TierConfig = {
  id: Tier;
  label: string;
  minCoins: number;
  extraDailySpins: number;
  description: string;
};

export const TIER_CONFIG: TierConfig[] = [
  {
    id: "Standard",
    label: "Standard",
    minCoins: 0,
    extraDailySpins: 1,
    description: "1 daily spin. Welcome to Zeus Lounge.",
  },
  {
    id: "Bronze",
    label: "Bronze",
    minCoins: 3_000,
    extraDailySpins: 2,
    description: "2 daily spins + access to special coin promos.",
  },
  {
    id: "Silver",
    label: "Silver",
    minCoins: 8_000,
    extraDailySpins: 3,
    description: "3 daily spins + 50% off platform redeem fees.",
  },
  {
    id: "Gold",
    label: "Gold",
    minCoins: 20_000,
    extraDailySpins: 4,
    description: "4 daily spins + 100% platform redeem fee coverage.",
  },
  {
    id: "Platinum",
    label: "Platinum",
    minCoins: 50_000,
    extraDailySpins: 5,
    description: "5 daily spins + 100% fees covered + 5% match on deposits over $50.",
  },
  {
    id: "Diamond",
    label: "Diamond",
    minCoins: 120_000,
    extraDailySpins: 6,
    description: "6 daily spins + 100% fees covered + 10% match on deposits over $50.",
  },
  {
    id: "Olympus",
    label: "Olympus",
    minCoins: 300_000,
    extraDailySpins: 7,
    description: "7 daily spins + 100% fees + 15% deposit match + monthly free play bonus.",
  },
];

const SORTED_TIERS = [...TIER_CONFIG].sort((a, b) => a.minCoins - b.minCoins);

export function getTierForCoins(coins: number): Tier {
  if (!Number.isFinite(coins) || coins < 0) coins = 0;
  let current: Tier = "Standard";
  for (const cfg of SORTED_TIERS) {
    if (coins >= cfg.minCoins) {
      current = cfg.id;
    } else {
      break;
    }
  }
  return current;
}

export function getTierLabel(tier: Tier): string {
  const cfg = SORTED_TIERS.find((t) => t.id === tier);
  return cfg?.label ?? tier;
}

export function getExtraDailySpinsForCoins(coins: number): number {
  const tier = getTierForCoins(coins);
  return getExtraDailySpinsForTier(tier);
}

export function getExtraDailySpinsForTier(tier: Tier): number {
  const cfg = SORTED_TIERS.find((t) => t.id === tier);
  return cfg?.extraDailySpins ?? 1;
}

export function getTierProgress(coins: number): {
  current: Tier;
  next: Tier | null;
  currentIndex: number;
  percentToNext: number;
  neededForNext: number | null;
  currentMin: number;
  nextMin: number | null;
  description: string;
} {
  if (!Number.isFinite(coins) || coins < 0) coins = 0;

  let currentIndex = 0;
  for (let i = 0; i < SORTED_TIERS.length; i++) {
    if (coins >= SORTED_TIERS[i].minCoins) {
      currentIndex = i;
    } else {
      break;
    }
  }

  const currentCfg = SORTED_TIERS[currentIndex];
  const nextCfg = SORTED_TIERS[currentIndex + 1] ?? null;

  if (!nextCfg) {
    return {
      current: currentCfg.id,
      next: null,
      currentIndex,
      percentToNext: 100,
      neededForNext: null,
      currentMin: currentCfg.minCoins,
      nextMin: null,
      description: currentCfg.description,
    };
  }

  const range = nextCfg.minCoins - currentCfg.minCoins;
  const progress = coins - currentCfg.minCoins;
  const percentToNext = range <= 0 ? 0 : Math.max(0, Math.min(100, (progress / range) * 100));
  const neededForNext = coins >= nextCfg.minCoins ? 0 : nextCfg.minCoins - coins;

  return {
    current: currentCfg.id,
    next: nextCfg.id,
    currentIndex,
    percentToNext,
    neededForNext,
    currentMin: currentCfg.minCoins,
    nextMin: nextCfg.minCoins,
    description: currentCfg.description,
  };
}