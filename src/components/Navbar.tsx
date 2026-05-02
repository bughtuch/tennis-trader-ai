"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useAppStore } from "@/lib/store";
import type { User } from "@supabase/supabase-js";

/* ─── Inline keyframe for pulsing gold gradient ─── */
const goProStyle = `
@keyframes goldPulse {
  0%, 100% { box-shadow: 0 0 8px rgba(234, 179, 8, 0.3); }
  50% { box-shadow: 0 0 18px rgba(234, 179, 8, 0.5); }
}
`;

const commonLinks = {
  home: { href: "/dashboard", label: "Home" },
  markets: { href: "/markets", label: "Markets" },
  trading: { href: "/trading", label: "Trading" },
  paper: { href: "/paper", label: "Paper Trade" },
  dna: { href: "/trading-dna", label: "DNA" },
  settings: { href: "/settings", label: "Settings" },
};

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isConnected, restoreSession, subscriptionStatus, subscriptionLoaded, fetchSubscriptionStatus } = useAppStore();
  const sessionRestored = useRef(false);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Restore Betfair session on mount (once)
  useEffect(() => {
    if (!sessionRestored.current && user) {
      sessionRestored.current = true;
      restoreSession();
    }
  }, [user, restoreSession]);

  // Ensure subscription status is loaded (belt-and-suspenders)
  useEffect(() => {
    if (user && !subscriptionLoaded) {
      fetchSubscriptionStatus();
    }
  }, [user, subscriptionLoaded, fetchSubscriptionStatus]);

  // Keep-alive is handled by BetfairKeepAlive component — no duplicate here

  // Silent vendor session check on mount (debounced to 10 minutes)
  useEffect(() => {
    try {
      const last = sessionStorage.getItem("lastVendorCheck");
      if (last && Date.now() - Number(last) < 10 * 60 * 1000) return;
      sessionStorage.setItem("lastVendorCheck", String(Date.now()));
      fetch("/api/betfair/vendor-check").catch(() => {});
    } catch {
      // fail silently
    }
  }, []);

  // Betfair connection status from localStorage
  const [betfairLive, setBetfairLive] = useState(false);

  useEffect(() => {
    function checkToken() {
      try {
        const token = localStorage.getItem("betfair_token");
        if (!token) { setBetfairLive(false); return; }
        const connectedAt = localStorage.getItem("betfair_connected_at");
        if (connectedAt) {
          const expiresAt = new Date(connectedAt).getTime() + 8 * 60 * 60 * 1000;
          if (Date.now() > expiresAt) { setBetfairLive(false); return; }
        }
        setBetfairLive(true);
      } catch { setBetfairLive(false); }
    }
    checkToken();
    const id = setInterval(checkToken, 10_000);
    window.addEventListener("storage", checkToken);
    return () => { clearInterval(id); window.removeEventListener("storage", checkToken); };
  }, []);

  // Scanner alert badge count
  const [scannerAlertCount, setScannerAlertCount] = useState(0);

  useEffect(() => {
    function readCount() {
      try {
        const c = localStorage.getItem("scannerAlertCount");
        setScannerAlertCount(c ? Number(c) : 0);
      } catch { /* SSR guard */ }
    }
    readCount();
    window.addEventListener("scannerAlertUpdate", readCount);
    // Also poll every 30s in case event is missed
    const id = setInterval(readCount, 30_000);
    return () => {
      window.removeEventListener("scannerAlertUpdate", readCount);
      clearInterval(id);
    };
  }, []);

  const isSubscriber = subscriptionLoaded && subscriptionStatus === "active";
  const navLinks = isSubscriber
    ? [commonLinks.home, commonLinks.markets, commonLinks.trading, commonLinks.paper, commonLinks.dna, commonLinks.settings]
    : [commonLinks.home, commonLinks.markets, commonLinks.paper, commonLinks.dna, commonLinks.settings];

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800/50">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight text-white">
              Tennis Trader
            </span>
            <span className="text-xs font-medium text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
              AI
            </span>
          </Link>

          {/* Nav Links */}
          <div className="hidden sm:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? "text-white bg-white/5"
                    : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                }`}
              >
                {link.label}
                {link.href === "/markets" && scannerAlertCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center px-1 rounded-full bg-orange-500 text-[9px] font-bold text-white">
                    {scannerAlertCount > 9 ? "9+" : scannerAlertCount}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden p-2 -mr-1 text-gray-400 hover:text-white transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

          {/* Right Side */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              {betfairLive ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-400">Live</span>
                </>
              ) : (
                <Link href="/settings" className="flex items-center gap-2 hover:text-gray-300 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-gray-500" />
                  <span className="text-gray-500">Connect Betfair</span>
                </Link>
              )}
            </div>

            {user ? (
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline text-sm text-gray-400 max-w-[150px] truncate">
                  {user.email}
                </span>
                {subscriptionLoaded && subscriptionStatus !== "active" && (
                  <>
                    <style>{goProStyle}</style>
                    <Link
                      href="/settings#subscribe"
                      className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-yellow-900 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 rounded-lg transition-all hover:from-yellow-300 hover:to-amber-400"
                      style={{ animation: "goldPulse 2s ease-in-out infinite" }}
                    >
                      Go Pro — £37/mo
                    </Link>
                  </>
                )}
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 rounded-lg transition-colors"
                >
                  Log out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/auth/login"
                  className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  className="px-3 py-1.5 text-sm text-white bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg font-medium transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-gray-800/50 bg-gray-900/95 backdrop-blur-xl">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? "text-white bg-white/5"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-gray-800/50">
            {user ? (
              <div className="space-y-2">
                <div className="text-xs text-gray-500 truncate px-3">{user.email}</div>
                <button
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                  className="w-full px-3 py-2.5 text-sm text-gray-400 hover:text-white text-left rounded-lg hover:bg-white/5 transition-colors"
                >
                  Log out
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Link
                  href="/auth/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2.5 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2.5 text-sm text-center text-white bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg font-medium"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
