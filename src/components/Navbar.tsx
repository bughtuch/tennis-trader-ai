"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useAppStore } from "@/lib/store";
import type { User } from "@supabase/supabase-js";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/markets", label: "Markets" },
  { href: "/trading", label: "Trading" },
  { href: "/trading-dna", label: "DNA" },
  { href: "/settings", label: "Settings" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const { isConnected, restoreSession } = useAppStore();
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  // Keep-alive interval (every 20 minutes) when connected
  const runKeepAlive = useCallback(async () => {
    try {
      const res = await fetch("/api/betfair/keep-alive", { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        useAppStore.getState().restoreSession();
      }
    } catch {
      // Network error — will retry next interval
    }
  }, []);

  useEffect(() => {
    if (isConnected) {
      keepAliveRef.current = setInterval(runKeepAlive, 20 * 60 * 1000);
    } else {
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current);
        keepAliveRef.current = null;
      }
    }
    return () => {
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current);
        keepAliveRef.current = null;
      }
    };
  }, [isConnected, runKeepAlive]);

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

          {/* Right Side */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs">
              {isConnected ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-400">Betfair</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 rounded-full bg-gray-500" />
                  <span className="text-gray-500">Offline</span>
                </>
              )}
            </div>

            {user ? (
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline text-sm text-gray-400 max-w-[150px] truncate">
                  {user.email}
                </span>
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
    </nav>
  );
}
