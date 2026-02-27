"use client";

import { useState } from "react";

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

export default function SettingsPage() {
  /* Betfair connection */
  const [isConnected, setIsConnected] = useState(false);
  const [bfUsername, setBfUsername] = useState("");
  const [bfPassword, setBfPassword] = useState("");
  const [connecting, setConnecting] = useState(false);

  /* Trading preferences */
  const [defaultStake, setDefaultStake] = useState("25");
  const [maxExposure, setMaxExposure] = useState("500");
  const [stopLoss, setStopLoss] = useState("50");
  const [autoGreenUp, setAutoGreenUp] = useState("0");
  const [aiGuardian, setAiGuardian] = useState(true);
  const [aiSignals, setAiSignals] = useState(true);

  /* Risk management */
  const [dailyLossLimit, setDailyLossLimit] = useState("200");
  const [maxSingleTrade, setMaxSingleTrade] = useState("100");
  const [sessionTimeLimit, setSessionTimeLimit] = useState("4hr");
  const [warningPercent, setWarningPercent] = useState(75);

  function handleConnect() {
    if (!bfUsername || !bfPassword) return;
    setConnecting(true);
    setTimeout(() => {
      setIsConnected(true);
      setConnecting(false);
    }, 1500);
  }

  function handleDisconnect() {
    setIsConnected(false);
    setBfUsername("");
    setBfPassword("");
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
        {/* ─── Section 1: Betfair Connection ─── */}
        <Card title="Betfair Account">
          {isConnected ? (
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
                  <span className="text-gray-500">Username</span>
                  <span className="text-white">{bfUsername}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Session expires</span>
                  <span className="text-gray-300">8 hours</span>
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
              <p className="text-xs text-gray-500">Connect your Betfair account to start trading.</p>
              <div>
                <Label>Username</Label>
                <TextInput
                  value={bfUsername}
                  onChange={setBfUsername}
                  placeholder="Betfair username"
                />
              </div>
              <div>
                <Label>Password</Label>
                <TextInput
                  value={bfPassword}
                  onChange={setBfPassword}
                  placeholder="Betfair password"
                  type="password"
                />
              </div>
              <button
                onClick={handleConnect}
                disabled={connecting || !bfUsername || !bfPassword}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {connecting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Connecting...
                  </span>
                ) : (
                  "Connect to Betfair"
                )}
              </button>
            </div>
          )}
        </Card>

        {/* ─── Section 2: Subscription ─── */}
        <Card title="Subscription">
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
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Next billing</span>
                <span className="text-gray-300">27 March 2026</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Member since</span>
                <span className="text-gray-300">15 January 2026</span>
              </div>
            </div>
            <button className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-300 bg-gray-800/50 border border-gray-700/50 hover:bg-gray-800 hover:text-white transition-all">
              Manage Subscription
            </button>
          </div>
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

            <button className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-all">
              Save Settings
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

            <button className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-all">
              Save Risk Limits
            </button>
          </div>
        </Card>

        {/* Bottom spacer */}
        <div className="h-8" />
      </div>
    </main>
  );
}
