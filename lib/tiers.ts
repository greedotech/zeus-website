// lib/tiers.ts

// NOTE: "Standard" is the base tier.
// The main ladder (Option 1) is:
// Standard → Bronze → Silver → Gold → Platinum → Diamond → Olympus

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
  minCoins: number;        // minimum Zeus Coins (or lifetime coins) to reach this tier
  extraDailySpins: number; // how many extra daily spins this tier gets
  description: string;     // short perks summary (for UI)
};

// 🧱 Option 1 tier ladder (you can tweak numbers later if needed)
export const TIER_CONFIG: TierConfig[] = [
  {
    id: "Standard",
    label: "Standard",
    minCoins: 0,
    extraDailySpins: 0,
    description: "Base tier. No extra perks yet, just standard promos.",
  },
  {
    id: "Bronze",
    label: "Bronze",
    minCoins: 10_000,
    extraDailySpins: 1,
    description: "1 extra daily spin. Standard platform fees.",
  },
  {
    id: "Silver",
    label: "Silver",
    minCoins: 50_000,
    extraDailySpins: 1,
    description: "50% off platform redeem fees.",
  },
  {
    id: "Gold",
    label: "Gold",
    minCoins: 200_000,
    extraDailySpins: 1,
    description: "5% match on qualifying deposits.",
  },
  {
    id: "Platinum",
    label: "Platinum",
    minCoins: 500_000,
    extraDailySpins: 2,
    description: "10% match on qualifying deposits + reduced fees.",
  },
  {
    id: "Diamond",
    label: "Diamond",
    minCoins: 1_000_000,
    extraDailySpins: 2,
    description: "100% platform redeem fee coverage on standard redeems.",
  },
  {
    id: "Olympus",
    label: "Olympus",
    minCoins: 2_000_000,
    extraDailySpins: 3,
    description: "Top VIP tier: max perks, fee coverage, and weekly free play.",
  },
];

// Make sure they stay sorted by minCoins (safety)
const SORTED_TIERS = [...TIER_CONFIG].sort(
  (a, b) => a.minCoins - b.minCoins
);

// 🔹 Get the Tier ID for a given coin amount
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

// 🔹 Human-readable label (right now label === id, but this keeps it flexible)
export function getTierLabel(tier: Tier): string {
  const cfg = SORTED_TIERS.find((t) => t.id === tier);
  return cfg?.label ?? tier;
}

// 🔹 How many extra daily spins a player gets at this coin level
export function getExtraDailySpinsForCoins(coins: number): number {
  const tier = getTierForCoins(coins);
  return getExtraDailySpinsForTier(tier);
}

export function getExtraDailySpinsForTier(tier: Tier): number {
  const cfg = SORTED_TIERS.find((t) => t.id === tier);
  return cfg?.extraDailySpins ?? 0;
}

// 🔹 Progress helper used by profile / bonus / host console
export function getTierProgress(coins: number): {
  current: Tier;
  next: Tier | null;
  currentIndex: number;
  percentToNext: number;     // 0–100
  neededForNext: number | null; // coins still needed (null if top tier)
  currentMin: number;
  nextMin: number | null;
  description: string;
} {
  if (!Number.isFinite(coins) || coins < 0) coins = 0;

  // Find current tier index
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
    // Top tier – no "next"
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
  const percentToNext =
    range <= 0 ? 0 : Math.max(0, Math.min(100, (progress / range) * 100));
  const neededForNext =
    coins >= nextCfg.minCoins ? 0 : nextCfg.minCoins - coins;

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