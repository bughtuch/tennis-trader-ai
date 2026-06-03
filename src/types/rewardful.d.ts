interface RewardfulInstance {
  referral: string | null;
  ready: boolean;
  convert: (options?: { email?: string }) => void;
}

interface Window {
  Rewardful?: RewardfulInstance;
  rewardful?: (...args: unknown[]) => void;
}
