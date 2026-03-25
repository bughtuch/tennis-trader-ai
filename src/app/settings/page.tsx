"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { createClient } from "@/lib/supabase";

/* ─── Reusable styled components ─── */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-800/50">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs text-gray-400 mb-1.5">{children}</label>;
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  prefix,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  prefix?: string;
}) {
  if (prefix) {
    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">{prefix}</span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl pl-8 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
        />
      </div>
    );
  }
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all appearance-none"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-gray-900 text-white">
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Toggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
        enabled ? "bg-blue-500" : "bg-gray-700"
      }`}
    >
      <div
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

/* ─── Page ─── */

export default function SettingsPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen pt-14 bg-[#030712] flex items-center justify-center"><div className="text-gray-500 text-sm">Loading...</div></div>}>
      <SettingsPage />
    </Suspense>
  );
}

function SettingsPage() {
  /* Betfair connection — Supabase is source of truth */
  const { authError, setAuthError, logout, restoreSession } = useAppStore();
  const [loginLoading, setLoginLoading] = useState(false);
  const [betfairUsernameInput, setBetfairUsernameInput] = useState("");
  const [betfairPasswordInput, setBetfairPasswordInput] = useState("");

  /* Connection state read from Supabase profile (not Zustand) */
  const [betfairConnected, setBetfairConnected] = useState(false);
  const [betfairUsername, setBetfairUsername] = useState<string | null>(null);
  const [betfairExpiry, setBetfairExpiry] = useState<string | null>(null);

  /* Session expiry countdown */
  const [expiryText, setExpiryText] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!betfairExpiry) {
      setExpiryText(null);
      return;
    }
    function updateCountdown() {
      const ms = new Date(betfairExpiry!).getTime() - Date.now();
      if (ms <= 0) {
        setExpiryText("Session expired");
        setIsExpired(true);
        return;
      }
      setIsExpired(false);
      const hrs = Math.floor(ms / 3_600_000);
      const mins = Math.floor((ms % 3_600_000) / 60_000);
      setExpiryText(`${hrs}h ${mins}m remaining`);
    }
    updateCountdown();
    const timer = setInterval(updateCountdown, 30_000);
    return () => clearInterval(timer);
  }, [betfairExpiry]);

  /* Shadow mode */
  const [shadowMode, setShadowMode] = useState(true);

  /* Streak protection */
  const [streakProtection, setStreakProtection] = useState(true);
  const [streakThreshold, setStreakThresholdVal] = useState("3");

  /* Trading preferences */
  const [defaultStake, setDefaultStake] = useState("25");
  const [maxExposure, setMaxExposure] = useState("500");
  const [stopLoss, setStopLoss] = useState("50");
  const [autoGreenUp, setAutoGreenUp] = useState("0");
  const [aiGuardian, setAiGuardian] = useState(true);
  const [aiSignals, setAiSignals] = useState(true);

  /* Risk management */
  const [dailyLossLimit, setDailyLossLimit] = useState("100");
  const [maxSingleTrade, setMaxSingleTrade] = useState("100");
  const [sessionTimeLimit, setSessionTimeLimit] = useState("4hr");
  const [warningPercent, setWarningPercent] = useState(75);

  /* Subscription */
  const searchParams = useSearchParams();
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>("inactive");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const showSubscribePrompt = searchParams.get("subscribe") === "true";

  /* Save status */
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  /* Load profile from Supabase */
  const loadProfile = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (data) {
      setDefaultStake(String(data.default_stake ?? 25));
      setMaxExposure(String(data.max_exposure ?? 500));
      setStopLoss(String(data.stop_loss ?? 50));
      setAutoGreenUp(String(data.auto_green_up_target ?? 0));
      setAiGuardian(data.ai_guardian_enabled ?? true);
      setAiSignals(data.ai_signals_enabled ?? true);
      setDailyLossLimit(String(data.daily_loss_limit ?? 100));
      setMaxSingleTrade(String(data.max_single_trade ?? 100));
      setSubscriptionStatus(data.subscription_status ?? "inactive");
      setShadowMode(data.shadow_mode ?? true);
      setStreakProtection(data.streak_protection_enabled ?? true);
      setStreakThresholdVal(String(data.streak_threshold ?? 3));
      setProfileLoaded(true);

      // Betfair connection state from Supabase (source of truth)
      if (data.betfair_connected && data.betfair_session_token) {
        // Check if session is expired (>8 hours from connected_at)
        const connectedAt = data.betfair_connected_at
          ? new Date(data.betfair_connected_at).getTime()
          : 0;
        const sessionExpired = connectedAt > 0 && Date.now() > connectedAt + 8 * 3600000;

        if (sessionExpired) {
          setBetfairConnected(false);
          setBetfairUsername(data.betfair_username ?? null);
          setBetfairExpiry(null);
          setIsExpired(true);
          setExpiryText("Session expired — reconnect");
        } else {
          setBetfairConnected(true);
          setBetfairUsername(data.betfair_username ?? null);
          if (data.betfair_connected_at) {
            setBetfairExpiry(
              new Date(new Date(data.betfair_connected_at).getTime() + 8 * 3600000).toISOString()
            );
          }
        }
      } else {
        setBetfairConnected(false);
        setBetfairUsername(null);
        setBetfairExpiry(null);
      }
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  /* Stripe checkout redirect fallback — verify payment if session_id in URL */
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) return;

    async function verifyPayment(sid: string) {
      try {
        const res = await fetch("/api/stripe/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid }),
        });
        const data = await res.json();
        if (data.verified) {
          setSubscriptionStatus("active");
          setSaveMessage("Payment confirmed — subscription active!");
          setTimeout(() => setSaveMessage(null), 5000);
        }
      } catch {
        // Silent fail — webhook may still handle it
      }
      // Clean session_id from URL without reload
      window.history.replaceState({}, "", "/settings");
    }

    verifyPayment(sessionId);
  }, [searchParams]);

  /* Handle Betfair OAuth redirect results */
  useEffect(() => {
    const betfairStatus = searchParams.get("betfair");
    if (!betfairStatus) return;

    if (betfairStatus === "connected") {
      setSaveMessage("Betfair connected successfully!");
      setTimeout(() => setSaveMessage(null), 5000);
      restoreSession();
      loadProfile();
    } else if (betfairStatus === "error") {
      const message = searchParams.get("message") ?? "Connection failed";
      setAuthError(message);
    }
    // Clean URL
    window.history.replaceState({}, "", "/settings");
  }, [searchParams, restoreSession, loadProfile, setAuthError]);

  /* Save settings to Supabase */
  async function handleSaveSettings() {
    setSaving(true);
    setSaveMessage(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaveMessage("Not signed in");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        default_stake: Number(defaultStake),
        max_exposure: Number(maxExposure),
        stop_loss: Number(stopLoss),
        auto_green_up_target: Number(autoGreenUp),
        ai_guardian_enabled: aiGuardian,
        ai_signals_enabled: aiSignals,
        shadow_mode: shadowMode,
        streak_protection_enabled: streakProtection,
        streak_threshold: Number(streakThreshold),
      })
      .eq("id", user.id);

    setSaving(false);
    setSaveMessage(error ? error.message : "Settings saved");
    if (!error) setTimeout(() => setSaveMessage(null), 3000);
  }

  /* Save risk limits to Supabase */
  async function handleSaveRiskLimits() {
    setSaving(true);
    setSaveMessage(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaveMessage("Not signed in");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        daily_loss_limit: Number(dailyLossLimit),
        max_single_trade: Number(maxSingleTrade),
      })
      .eq("id", user.id);

    setSaving(false);
    setSaveMessage(error ? error.message : "Risk limits saved");
    if (!error) setTimeout(() => setSaveMessage(null), 3000);
  }

  async function handleSubscribe() {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setSaveMessage(data.error ?? "Failed to start checkout");
        setCheckoutLoading(false);
      }
    } catch {
      setSaveMessage("Network error starting checkout");
      setCheckoutLoading(false);
    }
  }

  async function handleRestorePurchase() {
    setRestoreLoading(true);
    setSaveMessage(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        setSaveMessage("Not signed in");
        setRestoreLoading(false);
        return;
      }
      const res = await fetch("/api/stripe/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      const data = await res.json();
      if (data.synced) {
        setSubscriptionStatus("active");
        setSaveMessage("Subscription restored successfully!");
        setTimeout(() => setSaveMessage(null), 5000);
      } else {
        setSaveMessage(data.reason ?? "No active subscription found");
        setTimeout(() => setSaveMessage(null), 5000);
      }
    } catch {
      setSaveMessage("Network error restoring purchase");
      setTimeout(() => setSaveMessage(null), 5000);
    }
    setRestoreLoading(false);
  }

  async function handleConnect() {
    if (!betfairUsernameInput || !betfairPasswordInput) {
      setAuthError("Please enter your Betfair username and password.");
      return;
    }
    setLoginLoading(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/betfair/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: betfairUsernameInput, password: betfairPasswordInput }),
      });
      const data = await res.json();
      if (data.success) {
        setBetfairUsernameInput("");
        setBetfairPasswordInput("");
        setSaveMessage("Betfair connected successfully!");
        setTimeout(() => setSaveMessage(null), 5000);
        restoreSession();
        loadProfile();
      } else {
        setAuthError(data.error ?? "Login failed");
      }
    } catch {
      setAuthError("Network error. Please try again.");
    }
    setLoginLoading(false);
  }

  async function handleDisconnect() {
    await logout();
    setBetfairConnected(false);
    setBetfairUsername(null);
    setBetfairExpiry(null);
  }

  return (
    <main className="min-h-screen pt-14 bg-[#030712] max-w-[100vw] overflow-x-hidden">
      {/* Header */}
      <div className="border-b border-gray-800/50 bg-gray-900/30">
        <div className="max-w-lg mx-auto px-4 py-6">
          <h1 className="text-xl font-bold text-white">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your account, subscription, and trading preferences</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Save feedback */}
        {saveMessage && (
          <div className={`px-4 py-3 rounded-xl text-sm font-medium ${
            saveMessage.includes("saved")
              ? "bg-green-500/10 border border-green-500/20 text-green-400"
              : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}>
            {saveMessage}
          </div>
        )}

        {/* Loading indicator */}
        {!profileLoaded && (
          <div className="text-center text-xs text-gray-500 py-2">Loading profile...</div>
        )}

        {/* ─── Section 1: Betfair Connection ─── */}
        <Card title="Betfair Account">
          {betfairConnected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-sm font-medium text-green-400">Connected</span>
                </div>
                <span className="text-xs text-gray-500 font-mono">Session active</span>
              </div>
              <div className="bg-gray-800/30 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Account</span>
                  <span className="text-white">{betfairUsername ?? "Connected"}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Session expires</span>
                  <span className={isExpired ? "text-red-400 font-medium" : "text-gray-300"}>
                    {expiryText ?? "Unknown"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">API status</span>
                  <span className="text-green-400">Healthy</span>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {isExpired ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-xs font-medium text-amber-400">Session expired — reconnect below</span>
                </div>
              ) : (
                <p className="text-xs text-gray-500">Connect your Betfair account to start trading. Enter your Betfair credentials below.</p>
              )}
              {authError && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  {authError}
                </div>
              )}
              <div className="space-y-2">
                <Label>Betfair Username</Label>
                <TextInput
                  value={betfairUsernameInput}
                  onChange={setBetfairUsernameInput}
                  placeholder="Your Betfair username"
                />
                <Label>Betfair Password</Label>
                <TextInput
                  value={betfairPasswordInput}
                  onChange={setBetfairPasswordInput}
                  placeholder="Your Betfair password"
                  type="password"
                />
              </div>
              <button
                onClick={handleConnect}
                disabled={loginLoading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {loginLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Connecting...
                  </span>
                ) : (
                  "Connect Betfair Account"
                )}
              </button>
            </div>
          )}
        </Card>

        {/* ─── Section 2: Subscription ─── */}
        {showSubscribePrompt && subscriptionStatus !== "active" && (
          <div className="px-4 py-3 rounded-xl text-sm font-medium bg-amber-500/10 border border-amber-500/20 text-amber-400">
            Subscribe to access Markets and Trading.
          </div>
        )}
        <Card title="Subscription">
          {subscriptionStatus === "active" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">Founding Member</div>
                  <div className="text-xs text-gray-500 mt-0.5">£37/month</div>
                </div>
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                  Active
                </span>
              </div>
              <div className="bg-gray-800/30 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Plan</span>
                  <span className="text-white">Founding Member</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Price</span>
                  <span className="text-white">£37/month <span className="text-gray-600 line-through ml-1">£47</span></span>
                </div>
              </div>
              <button className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-300 bg-gray-800/50 border border-gray-700/50 hover:bg-gray-800 hover:text-white transition-all">
                Manage Subscription
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">No active subscription</div>
                  <div className="text-xs text-gray-500 mt-0.5">Subscribe to unlock all features</div>
                </div>
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-gray-700/50 text-gray-400 border border-gray-600/30">
                  {subscriptionStatus === "cancelled" ? "Cancelled" : "Inactive"}
                </span>
              </div>
              <div className="bg-gray-800/30 rounded-xl p-4 text-center space-y-2">
                <div className="flex items-center justify-center gap-3 mb-1">
                  <span className="text-lg text-gray-500 line-through">£47</span>
                  <span className="text-3xl font-bold text-white">£37</span>
                  <span className="text-gray-400 text-sm">/month</span>
                </div>
                <p className="text-xs text-gray-500">Founding member pricing — locked in forever</p>
              </div>
              <div className="space-y-2 text-xs text-gray-400">
                {["AI-powered trade signals", "Professional trading ladder", "Real-time Betfair data", "AI Guardian risk management", "7-day free trial"].map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {f}
                  </div>
                ))}
              </div>
              <button
                onClick={handleSubscribe}
                disabled={checkoutLoading}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 transition-all hover:shadow-[0_0_30px_rgba(59,130,246,0.3)]"
              >
                {checkoutLoading ? "Redirecting to Stripe..." : "Subscribe — £37/month"}
              </button>
              <p className="text-center text-[11px] text-gray-600">7-day free trial. Cancel anytime.</p>
              <button
                onClick={handleRestorePurchase}
                disabled={restoreLoading}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-400 bg-gray-800/50 border border-gray-700/50 hover:bg-gray-800 hover:text-white disabled:opacity-50 transition-all"
              >
                {restoreLoading ? "Checking Stripe..." : "Restore Purchase"}
              </button>
            </div>
          )}
        </Card>

        {/* ─── Section 3: Trading Preferences ─── */}
        <Card title="Trading Settings">
          <div className="space-y-4">
            <div>
              <Label>Default Stake</Label>
              <Select
                value={defaultStake}
                onChange={setDefaultStake}
                options={[
                  { value: "5", label: "£5" },
                  { value: "10", label: "£10" },
                  { value: "25", label: "£25" },
                  { value: "50", label: "£50" },
                  { value: "100", label: "£100" },
                ]}
              />
            </div>
            <div>
              <Label>Max Exposure</Label>
              <TextInput value={maxExposure} onChange={setMaxExposure} prefix="£" />
            </div>
            <div>
              <Label>Stop Loss</Label>
              <TextInput value={stopLoss} onChange={setStopLoss} prefix="£" />
            </div>
            <div>
              <Label>Auto Green-Up Target <span className="text-gray-600">(£0 = off)</span></Label>
              <TextInput value={autoGreenUp} onChange={setAutoGreenUp} prefix="£" />
            </div>

            <div className="border-t border-gray-800/50 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-white">Shadow Mode</div>
                  <div className="text-xs text-gray-500">
                    {shadowMode
                      ? "Practice with real odds, no real money"
                      : "Live trading — real money at risk"}
                  </div>
                </div>
                <Toggle
                  enabled={shadowMode}
                  onToggle={() => {
                    if (shadowMode) {
                      // Turning OFF shadow mode — require active subscription
                      if (subscriptionStatus !== "active") {
                        setSaveMessage("Subscribe to enable live trading");
                        setTimeout(() => setSaveMessage(null), 3000);
                        return;
                      }
                    }
                    setShadowMode(!shadowMode);
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-white">Streak Protection</div>
                  <div className="text-xs text-gray-500">Warns after losing streaks, pauses trading after extended losses</div>
                </div>
                <Toggle enabled={streakProtection} onToggle={() => setStreakProtection(!streakProtection)} />
              </div>
              {streakProtection && (
                <div>
                  <Label>Streak Threshold</Label>
                  <Select
                    value={streakThreshold}
                    onChange={setStreakThresholdVal}
                    options={[
                      { value: "3", label: "3 consecutive losses" },
                      { value: "5", label: "5 consecutive losses" },
                      { value: "10", label: "10 consecutive losses" },
                    ]}
                  />
                  <div className="text-[10px] text-gray-600 mt-1">Number of consecutive losses before first warning</div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-white">AI Guardian</div>
                  <div className="text-xs text-gray-500">Automatic risk protection</div>
                </div>
                <Toggle enabled={aiGuardian} onToggle={() => setAiGuardian(!aiGuardian)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-white">AI Signals</div>
                  <div className="text-xs text-gray-500">Show trading recommendations</div>
                </div>
                <Toggle enabled={aiSignals} onToggle={() => setAiSignals(!aiSignals)} />
              </div>
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 transition-all"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </Card>

        {/* ─── Section 4: Risk Management ─── */}
        <Card title="Risk Limits">
          <div className="space-y-4">
            <div>
              <Label>Daily Loss Limit</Label>
              <TextInput value={dailyLossLimit} onChange={setDailyLossLimit} prefix="£" />
            </div>
            <div>
              <Label>Max Single Trade</Label>
              <TextInput value={maxSingleTrade} onChange={setMaxSingleTrade} prefix="£" />
            </div>
            <div>
              <Label>Session Time Limit</Label>
              <Select
                value={sessionTimeLimit}
                onChange={setSessionTimeLimit}
                options={[
                  { value: "1hr", label: "1 hour" },
                  { value: "2hr", label: "2 hours" },
                  { value: "4hr", label: "4 hours" },
                  { value: "none", label: "No limit" },
                ]}
              />
            </div>
            <div>
              <Label>Warning at {warningPercent}% of limit</Label>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 shrink-0">50%</span>
                <input
                  type="range"
                  min={50}
                  max={90}
                  step={5}
                  value={warningPercent}
                  onChange={(e) => setWarningPercent(Number(e.target.value))}
                  className="flex-1 h-1.5 rounded-full appearance-none bg-gray-700 accent-blue-500 cursor-pointer"
                />
                <span className="text-xs text-gray-500 shrink-0">90%</span>
              </div>
            </div>

            <button
              onClick={handleSaveRiskLimits}
              disabled={saving}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 transition-all"
            >
              {saving ? "Saving..." : "Save Risk Limits"}
            </button>
          </div>
        </Card>

        {/* Footer links */}
        <div className="text-center pb-8">
          <a
            href="/api/betfair/charges"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Betfair Charges
          </a>
        </div>
      </div>
    </main>
  );
}
