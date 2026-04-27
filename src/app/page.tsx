"use client";

import { useEffect } from "react";
import Link from "next/link";
import Footer from "@/components/Footer";

export default function Home() {
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
      window.location.href = "/auth/update-password" + window.location.hash;
    }
  }, []);

  return (
    <main className="min-h-screen">
      {/* ───────── HERO ───────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 animated-gradient-bg" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/8 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-blue-500/8 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-purple-500/6 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "4s" }} />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:64px_64px]" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900/60 border border-gray-800/50 backdrop-blur-sm mb-10 fade-in-up">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-gray-300">Live on Betfair Exchange</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-7xl font-bold tracking-tight mb-6 fade-in-up" style={{ animationDelay: "0.1s" }}>
            The first AI trading system
            <br />
            <span className="gradient-text">for tennis.</span>
          </h1>

          <p className="text-lg sm:text-xl md:text-2xl text-gray-300 mb-3 fade-in-up" style={{ animationDelay: "0.2s" }}>
            Not just a ladder. A system that trades with you.
          </p>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-4 fade-in-up" style={{ animationDelay: "0.25s" }}>
            Trade faster. Exit smarter. Protect your bankroll automatically.
          </p>
          <p className="text-sm text-gray-500 max-w-xl mx-auto mb-10 fade-in-up" style={{ animationDelay: "0.3s" }}>
            Works on Mac, iPhone, iPad, Windows, Android &mdash; any browser. No downloads.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4 fade-in-up" style={{ animationDelay: "0.35s" }}>
            <Link
              href="/auth/signup"
              className="group w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl text-white font-semibold text-lg text-center transition-all duration-300 hover:shadow-[0_0_40px_rgba(34,197,94,0.35)] hover:scale-[1.02]"
            >
              Start Paper Trading &mdash; Free
              <span className="ml-2 inline-block transition-transform group-hover:translate-x-1">&rarr;</span>
            </Link>
            <a
              href="#the-shift"
              className="w-full sm:w-auto px-8 py-4 rounded-xl text-gray-300 font-medium text-lg text-center border border-gray-800 hover:border-gray-600 hover:bg-gray-900/50 transition-all duration-300"
            >
              See How It Works
            </a>
          </div>
          <p className="text-sm text-gray-600 fade-in-up" style={{ animationDelay: "0.4s" }}>
            No risk. No card. Real Betfair odds.
          </p>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 fade-in-up" style={{ animationDelay: "1s" }}>
          <div className="w-6 h-10 rounded-full border-2 border-gray-700 flex items-start justify-center p-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" />
          </div>
        </div>
      </section>

      {/* ───────── TRUST STRIP ───────── */}
      <section className="py-10 px-4 sm:px-6 border-b border-gray-800/50 bg-gray-950/50">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 mb-4">
            {["Mac", "Windows", "iPhone", "iPad", "Android", "Chrome", "Safari"].map((d) => (
              <span key={d} className="text-xs text-gray-500 font-medium tracking-wide uppercase">{d}</span>
            ))}
          </div>
          <p className="text-xs text-gray-600">
            Live on Betfair Exchange &bull; Betfair Certified &bull; No downloads. No Windows setup.
          </p>
        </div>
      </section>

      {/* ───────── THE SHIFT ───────── */}
      <section id="the-shift" className="py-16 sm:py-28 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-8 leading-tight">
            Most trading tools help you place bets.
            <br />
            <span className="text-gray-500">They don&apos;t help you trade well.</span>
          </h2>
          <p className="text-lg text-gray-400 mb-4 leading-relaxed max-w-2xl mx-auto">
            That&apos;s why most traders lose. They stay in too long. Chase losses. Panic exit. Overtrade after a win.
          </p>
          <p className="text-xl text-white font-semibold">
            Tennis Trader AI fixes all four.
          </p>
        </div>
      </section>

      {/* ───────── FOUR ENGINES ───────── */}
      <section className="py-14 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[10px] tracking-[0.3em] uppercase text-gray-500 font-medium mb-3">THE SYSTEM</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              A complete trading system &mdash; not just tools
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* EDGE ENGINE */}
            <div className="group relative bg-gray-900/60 backdrop-blur-sm rounded-2xl p-8 border border-green-500/10 hover:border-green-500/30 transition-all duration-500 hover:shadow-[0_0_40px_rgba(34,197,94,0.06)]">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/[0.03] to-transparent rounded-2xl" />
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-6">
                  <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                  </svg>
                </div>
                <p className="text-[10px] tracking-[0.2em] uppercase text-green-400 font-medium mb-2">EDGE ENGINE</p>
                <h3 className="text-xl font-bold mb-3 text-white">Find trades you would never see yourself.</h3>
                <ul className="space-y-2">
                  {["AI Signals (pre-match + in-play)", "Market Scanner (all matches, live)", "Strategy detection", "Match selection ranking"].map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-gray-400">
                      <div className="w-1 h-1 rounded-full bg-green-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* EXECUTION ENGINE */}
            <div className="group relative bg-gray-900/60 backdrop-blur-sm rounded-2xl p-8 border border-blue-500/10 hover:border-blue-500/30 transition-all duration-500 hover:shadow-[0_0_40px_rgba(59,130,246,0.06)]">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.03] to-transparent rounded-2xl" />
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-6">
                  <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                </div>
                <p className="text-[10px] tracking-[0.2em] uppercase text-blue-400 font-medium mb-2">EXECUTION ENGINE</p>
                <h3 className="text-xl font-bold mb-3 text-white">Act faster than the market can move.</h3>
                <ul className="space-y-2">
                  {["Professional 17-row trading ladder", "One-tap green up + optimised greening", "Scale-out exits (25% / 40% / 50% / 75%)", "Keyboard shortcuts + WOM"].map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-gray-400">
                      <div className="w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* PROTECTION ENGINE */}
            <div className="group relative bg-gray-900/60 backdrop-blur-sm rounded-2xl p-8 border border-red-500/10 hover:border-red-500/30 transition-all duration-500 hover:shadow-[0_0_40px_rgba(239,68,68,0.06)]">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/[0.03] to-transparent rounded-2xl" />
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mb-6">
                  <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <p className="text-[10px] tracking-[0.2em] uppercase text-red-400 font-medium mb-2">PROTECTION ENGINE</p>
                <h3 className="text-xl font-bold mb-3 text-white">Stops the trades that blow accounts.</h3>
                <ul className="space-y-2">
                  {["AI Guardian (4 exit strategies)", "Streak protection (auto cooldown)", "Daily loss limits", "Risk/reward analysis"].map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-gray-400">
                      <div className="w-1 h-1 rounded-full bg-red-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-sm text-red-400/80 font-medium italic">
                  &ldquo;Most apps let you lose. We don&apos;t.&rdquo;
                </p>
              </div>
            </div>

            {/* LEARNING ENGINE */}
            <div className="group relative bg-gray-900/60 backdrop-blur-sm rounded-2xl p-8 border border-purple-500/10 hover:border-purple-500/30 transition-all duration-500 hover:shadow-[0_0_40px_rgba(139,92,246,0.06)]">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.03] to-transparent rounded-2xl" />
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-6">
                  <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                  </svg>
                </div>
                <p className="text-[10px] tracking-[0.2em] uppercase text-purple-400 font-medium mb-2">LEARNING ENGINE</p>
                <h3 className="text-xl font-bold mb-3 text-white">Gets smarter every time you trade.</h3>
                <ul className="space-y-2">
                  {["AI Coach (post-trade review)", "Trading DNA (after 50 trades)", "Profit graph + performance tracking", "Pattern detection (strengths + mistakes)"].map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-gray-400">
                      <div className="w-1 h-1 rounded-full bg-purple-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── PLATFORM ───────── */}
      <section className="py-14 sm:py-24 px-4 sm:px-6 lg:px-8 border-y border-gray-800/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Every other tool was built for Windows.
            <br />
            <span className="text-gray-500">We weren&apos;t.</span>
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-8 md:gap-12 my-8 sm:my-12">
            {[
              { name: "Mac", path: "M4 4h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm4 16h8m-4-2v2" },
              { name: "iPhone", path: "M8 2h8a2 2 0 012 2v16a2 2 0 01-2 2H8a2 2 0 01-2-2V4a2 2 0 012-2zm4 18h.01" },
              { name: "iPad", path: "M6 2h12a2 2 0 012 2v16a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2zm6 17h.01" },
              { name: "Windows", path: "M3 5.5l8-1.1v7.6H3V5.5zm0 7v6.5l8 1.1v-7.6H3zm9-8.2L21 3v9h-9V4.3zm0 8.2V21l9 1.5v-9.5h-9z" },
              { name: "Android", path: "M7 2h10a2 2 0 012 2v16a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2zm5 18h.01" },
              { name: "Browser", path: "M12 2a10 10 0 100 20 10 10 0 000-20zm0 6a4 4 0 110 8 4 4 0 010-8z" },
            ].map((d) => (
              <div key={d.name} className="flex flex-col items-center gap-2.5">
                <div className="w-14 h-14 rounded-2xl bg-gray-900/60 border border-gray-800/50 flex items-center justify-center">
                  <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={d.path} />
                  </svg>
                </div>
                <span className="text-xs text-gray-500">{d.name}</span>
              </div>
            ))}
          </div>
          <p className="text-lg text-gray-400">No installs. No setup. No friction.</p>
        </div>
      </section>

      {/* ───────── PAPER TRADING ───────── */}
      <section className="py-16 sm:py-28 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-green-500/[0.04] rounded-full blur-3xl" />
        <div className="max-w-3xl mx-auto text-center relative">
          <p className="text-[10px] tracking-[0.3em] uppercase text-green-400 font-medium mb-4">PAPER TRADING</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">
            Test your edge before risking money.
          </h2>
          <p className="text-lg text-gray-400 mb-4 leading-relaxed max-w-2xl mx-auto">
            Trade real markets. Real odds. Track every paper trade. Know your edge before you risk a penny.
          </p>
          <p className="text-gray-500 mb-10">
            Most traders know within 10 trades if they have an edge.
          </p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl text-white font-semibold text-lg transition-all duration-300 hover:shadow-[0_0_40px_rgba(34,197,94,0.35)] hover:scale-[1.02]"
          >
            Start Paper Trading &mdash; Free
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ───────── BANKROLL PROTECTION ───────── */}
      <section className="py-14 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[10px] tracking-[0.3em] uppercase text-red-400 font-medium mb-4">BANKROLL PROTECTION</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-10">
            You can&apos;t tilt-trade here.
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-10">
            {[
              { text: "3 losses", sub: "warning", color: "border-amber-500/30 bg-amber-500/5", accent: "text-amber-400" },
              { text: "5 losses", sub: "trading paused", color: "border-red-500/30 bg-red-500/5", accent: "text-red-400" },
              { text: "Custom", sub: "thresholds", color: "border-blue-500/30 bg-blue-500/5", accent: "text-blue-400" },
            ].map((item) => (
              <div key={item.text} className={`flex-1 w-full sm:w-auto rounded-xl border ${item.color} px-6 py-5 text-center`}>
                <div className={`text-2xl font-bold ${item.accent} mb-1`}>{item.text}</div>
                <div className="text-sm text-gray-500">{item.sub}</div>
              </div>
            ))}
          </div>
          <p className="text-gray-400 text-lg">
            Because the best trade after a losing streak is no trade at all.
          </p>
        </div>
      </section>

      {/* ───────── COMPARISON TABLE ───────── */}
      <section className="py-14 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Why traders are switching
            </h2>
            <p className="text-gray-400 max-w-lg mx-auto">
              The old tools were built for another era. This one wasn&apos;t.
            </p>
          </div>

          <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800/50">
                    <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-gray-500 font-medium text-[10px] sm:text-xs tracking-wider uppercase">Feature</th>
                    <th className="text-center px-2 sm:px-4 py-3 sm:py-4 text-white font-semibold text-xs sm:text-sm"><span className="gradient-text">Tennis Trader AI</span></th>
                    <th className="text-center px-2 sm:px-4 py-3 sm:py-4 text-gray-500 font-medium text-xs sm:text-sm">Bet Angel</th>
                    <th className="text-center px-2 sm:px-4 py-3 sm:py-4 text-gray-500 font-medium text-xs sm:text-sm">Geeks Toy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/30">
                  {[
                    { f: "Works on Mac", us: true, a: false, g: false },
                    { f: "Works on iPhone/iPad", us: true, a: false, g: false },
                    { f: "No download required", us: true, a: false, g: false },
                    { f: "AI trading signals", us: true, a: false, g: false },
                    { f: "AI exit strategies", us: true, a: false, g: false },
                    { f: "Paper trading", us: true, a: false, g: false },
                    { f: "Trading DNA", us: true, a: false, g: false },
                    { f: "Streak protection", us: true, a: false, g: false },
                    { f: "Post-trade AI coaching", us: true, a: false, g: false },
                    { f: "Price", us: "£37/mo", a: "£150/yr", g: "£20/mo" },
                  ].map((row) => (
                    <tr key={row.f} className="hover:bg-gray-800/20 transition-colors">
                      <td className="px-3 sm:px-6 py-2.5 sm:py-3 text-gray-300 font-medium text-xs sm:text-sm">{row.f}</td>
                      <td className="text-center px-2 sm:px-4 py-2.5 sm:py-3 font-semibold">{row.us === true ? <span className="text-green-400">&#10003;</span> : typeof row.us === "string" ? <span className="text-gray-300 text-xs font-mono">{row.us}</span> : <span className="text-gray-700">&mdash;</span>}</td>
                      <td className="text-center px-2 sm:px-4 py-2.5 sm:py-3">{row.a === true ? <span className="text-green-400">&#10003;</span> : typeof row.a === "string" ? <span className="text-gray-300 text-xs font-mono">{row.a}</span> : <span className="text-gray-700">&mdash;</span>}</td>
                      <td className="text-center px-2 sm:px-4 py-2.5 sm:py-3">{row.g === true ? <span className="text-green-400">&#10003;</span> : typeof row.g === "string" ? <span className="text-gray-300 text-xs font-mono">{row.g}</span> : <span className="text-gray-700">&mdash;</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── PRICING ───────── */}
      <section className="py-14 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <div className="relative bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-2xl p-8 hover:border-green-500/20 transition-all duration-500">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <div className="px-4 py-1 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full text-xs font-semibold text-white">
                Founding Member
              </div>
            </div>

            <div className="text-center mt-4 mb-8">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-5xl font-bold text-white font-mono">&pound;37</span>
                <span className="text-gray-400">/month</span>
              </div>
              <p className="text-sm text-gray-500">Lock in founding member pricing forever</p>
            </div>

            <div className="space-y-3 mb-8">
              {[
                "Live trading on Betfair Exchange",
                "AI Signals (pre-match + in-play)",
                "AI Guardian (4 exit strategies)",
                "Full trading system + ladder",
                "Real Betfair execution",
                "Trading DNA + AI Coach",
              ].map((f) => (
                <div key={f} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <span className="text-sm text-gray-300">{f}</span>
                </div>
              ))}
            </div>

            <Link
              href="/settings"
              className="block w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl text-white font-semibold text-center text-lg transition-all duration-300 hover:shadow-[0_0_40px_rgba(34,197,94,0.35)] hover:scale-[1.02]"
            >
              Go Live &mdash; &pound;37/month
            </Link>

            <p className="text-center text-xs text-gray-600 mt-4">
              Not ready? <Link href="/auth/signup" className="text-green-400 hover:text-green-300 transition-colors">Start paper trading free</Link> &mdash; no card required.
            </p>
          </div>
        </div>
      </section>

      {/* ───────── AFFILIATE ───────── */}
      <section className="py-14 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 border border-gray-800/50 rounded-2xl p-8 sm:p-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <p className="text-[10px] tracking-[0.3em] uppercase text-green-400 font-medium mb-3">AFFILIATE PROGRAMME</p>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                  Earn while you trade
                </h2>
                <p className="text-gray-400 mb-3 text-lg">
                  30% recurring commission. &pound;11.10 per referral per month.
                </p>
                <p className="text-gray-400 mb-6">
                  10 referrals = &pound;111/month passive income.
                </p>
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl text-white font-semibold transition-all duration-300 hover:shadow-[0_0_30px_rgba(34,197,94,0.3)] hover:scale-[1.02]"
                >
                  Get your referral link
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-400 font-mono mb-1">30%</div>
                  <div className="text-xs text-gray-500">Recurring commission</div>
                </div>
                <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-400 font-mono mb-1">&pound;11.10</div>
                  <div className="text-xs text-gray-500">Per referral / month</div>
                </div>
                <div className="col-span-2 bg-gray-800/30 border border-gray-700/30 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-400 font-mono mb-1">10 referrals = &pound;111/mo</div>
                  <div className="text-xs text-gray-500">Passive income while you trade</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── FINAL CTA ───────── */}
      <section className="py-16 sm:py-28 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Ready to trade properly?
          </h2>
          <p className="text-lg text-gray-400 max-w-lg mx-auto mb-10">
            Start with paper trading. Upgrade when you see the edge.
          </p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl text-white font-semibold text-lg transition-all duration-300 hover:shadow-[0_0_40px_rgba(34,197,94,0.35)] hover:scale-[1.02]"
          >
            Start Paper Trading &mdash; Free
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ───────── FOOTER ───────── */}
      <Footer />
    </main>
  );
}
