import Link from "next/link";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* ───────── Hero ───────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 animated-gradient-bg" />

        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "2s" }}
        />
        <div
          className="absolute top-1/2 right-1/3 w-64 h-64 bg-pink-500/8 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "4s" }}
        />

        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900/60 border border-gray-800/50 backdrop-blur-sm mb-8 fade-in-up">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-gray-300 font-[family-name:var(--font-dm)]">
              Live on Betfair Exchange
            </span>
          </div>

          {/* Headline */}
          <h1
            className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 fade-in-up font-[family-name:var(--font-jakarta)]"
            style={{ animationDelay: "0.1s" }}
          >
            Tennis Trading on
            <br />
            <span className="gradient-text">Any Device. Finally.</span>
          </h1>

          {/* Subtitle */}
          <p
            className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed fade-in-up font-[family-name:var(--font-dm)]"
            style={{ animationDelay: "0.2s" }}
          >
            The first AI-powered tennis trading platform for Mac, iPhone, iPad,
            and every browser. No downloads. No Windows. Just trade.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6 fade-in-up"
            style={{ animationDelay: "0.3s" }}
          >
            <Link
              href="/auth/signup"
              className="group relative w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl text-white font-semibold text-lg text-center transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:scale-[1.02]"
            >
              Start with Shadow Mode &mdash; Free
              <span className="ml-2 inline-block transition-transform group-hover:translate-x-1">
                &rarr;
              </span>
            </Link>
            <Link
              href="#features"
              className="w-full sm:w-auto px-8 py-4 rounded-xl text-gray-300 font-medium text-lg text-center border border-gray-800 hover:border-gray-700 hover:bg-gray-900/50 transition-all duration-300"
            >
              See Features
            </Link>
          </div>

          {/* No card required */}
          <p
            className="text-sm text-gray-500 mb-16 fade-in-up font-[family-name:var(--font-dm)]"
            style={{ animationDelay: "0.35s" }}
          >
            No credit card required. Practice with real odds, zero risk.
          </p>

          {/* Device Mockups */}
          <div
            className="flex items-end justify-center gap-4 sm:gap-6 fade-in-up"
            style={{ animationDelay: "0.4s" }}
          >
            {/* Phone */}
            <div className="w-16 sm:w-20 h-28 sm:h-36 bg-gray-900/80 border border-gray-700/50 rounded-xl flex flex-col items-center justify-center p-1.5 shadow-2xl">
              <div className="w-full h-full bg-gray-800/50 rounded-lg flex items-center justify-center">
                <div className="space-y-0.5">
                  <div className="w-6 sm:w-8 h-1 bg-green-500/40 rounded-full" />
                  <div className="w-6 sm:w-8 h-1 bg-red-500/40 rounded-full" />
                  <div className="w-6 sm:w-8 h-1 bg-blue-500/40 rounded-full" />
                  <div className="w-6 sm:w-8 h-1 bg-green-500/30 rounded-full" />
                </div>
              </div>
            </div>
            {/* Tablet */}
            <div className="w-32 sm:w-44 h-24 sm:h-32 bg-gray-900/80 border border-gray-700/50 rounded-xl flex flex-col items-center justify-center p-2 shadow-2xl">
              <div className="w-full h-full bg-gray-800/50 rounded-lg flex items-center justify-center gap-2">
                <div className="space-y-0.5 flex-1">
                  <div className="h-1 bg-green-500/40 rounded-full" />
                  <div className="h-1 bg-red-500/40 rounded-full" />
                  <div className="h-1 bg-blue-500/40 rounded-full" />
                  <div className="h-1 bg-green-500/30 rounded-full" />
                  <div className="h-1 bg-red-500/30 rounded-full" />
                </div>
                <div className="w-8 sm:w-12 h-full bg-gray-700/30 rounded flex items-center justify-center">
                  <div className="text-[6px] text-gray-500 font-[family-name:var(--font-jetbrains)]">
                    WOM
                  </div>
                </div>
              </div>
            </div>
            {/* Laptop */}
            <div className="w-48 sm:w-64 flex flex-col items-center">
              <div className="w-full h-28 sm:h-40 bg-gray-900/80 border border-gray-700/50 rounded-t-xl flex items-center justify-center p-2 shadow-2xl">
                <div className="w-full h-full bg-gray-800/50 rounded-lg flex items-center gap-2 p-2">
                  <div className="space-y-0.5 flex-1">
                    <div className="h-1.5 bg-green-500/40 rounded-full" />
                    <div className="h-1.5 bg-red-500/40 rounded-full" />
                    <div className="h-1.5 bg-blue-500/40 rounded-full" />
                    <div className="h-1.5 bg-green-500/30 rounded-full" />
                    <div className="h-1.5 bg-red-500/30 rounded-full" />
                    <div className="h-1.5 bg-amber-500/30 rounded-full" />
                  </div>
                  <div className="w-16 sm:w-24 h-full bg-gray-700/30 rounded flex flex-col items-center justify-center gap-1 p-1">
                    <div className="text-[7px] text-gray-500 font-[family-name:var(--font-jetbrains)]">
                      LADDER
                    </div>
                    <div className="w-full space-y-0.5">
                      <div className="flex gap-0.5">
                        <div className="flex-1 h-1 bg-blue-500/30 rounded-full" />
                        <div className="flex-1 h-1 bg-pink-500/30 rounded-full" />
                      </div>
                      <div className="flex gap-0.5">
                        <div className="flex-1 h-1 bg-blue-500/20 rounded-full" />
                        <div className="flex-1 h-1 bg-pink-500/20 rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="w-[110%] h-2 bg-gray-800/80 rounded-b-lg border-x border-b border-gray-700/30" />
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 fade-in-up" style={{ animationDelay: "1s" }}>
          <div className="w-6 h-10 rounded-full border-2 border-gray-700 flex items-start justify-center p-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" />
          </div>
        </div>
      </section>

      {/* ───────── Platform Section ───────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-b border-gray-800/50">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[10px] tracking-[0.2em] uppercase text-blue-400 font-medium mb-3 font-[family-name:var(--font-jetbrains)]">
            CROSS-PLATFORM
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 font-[family-name:var(--font-jakarta)]">
            Works everywhere your competitors don&apos;t
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto mb-12 font-[family-name:var(--font-dm)]">
            Every other tennis trading app requires Windows. We work on everything.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            {[
              { name: "Mac", icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" },
              { name: "Windows", icon: "M3 12V5.5l8-1.1V12H3zm0 .5V19l8 1.1V12.5H3zm8.5-7.7L21 3.5V12h-9.5V4.8zm0 7.7V20l9.5 1.5V12.5h-9.5z" },
              { name: "iPhone", icon: "M7 2h10a2 2 0 012 2v16a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2zm3 18h4" },
              { name: "iPad", icon: "M6 2h12a2 2 0 012 2v16a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2zm6 17h.01" },
              { name: "Android", icon: "M7 2h10a2 2 0 012 2v16a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2zm5 18h.01M9 2v1m6-1v1" },
              { name: "Chrome", icon: "M12 2a10 10 0 100 20 10 10 0 000-20zm0 6a4 4 0 110 8 4 4 0 010-8z" },
              { name: "Safari", icon: "M12 2a10 10 0 100 20 10 10 0 000-20zm0 5l2 5-5 2-2-5 5-2z" },
            ].map((device) => (
              <div
                key={device.name}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-12 h-12 rounded-xl bg-gray-900/50 border border-gray-800/50 flex items-center justify-center group-hover:border-blue-500/30 transition-colors">
                  <svg
                    className="w-6 h-6 text-gray-400 group-hover:text-blue-400 transition-colors"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d={device.icon} />
                  </svg>
                </div>
                <span className="text-xs text-gray-500 font-[family-name:var(--font-dm)]">
                  {device.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Shadow Mode ───────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-purple-500/5 rounded-full blur-3xl" />

        <div className="max-w-5xl mx-auto relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left - Copy */}
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase text-purple-400 font-medium mb-3 font-[family-name:var(--font-jetbrains)]">
                SHADOW MODE
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 font-[family-name:var(--font-jakarta)]">
                Learn before you earn
              </h2>
              <p className="text-gray-400 mb-6 leading-relaxed font-[family-name:var(--font-dm)]">
                Practice with real live odds &mdash; no money moves. Track your hypothetical
                P&amp;L across every trade. See exactly what you would have made or lost,
                without risking a penny.
              </p>
              <p className="text-gray-400 mb-8 leading-relaxed font-[family-name:var(--font-dm)]">
                After 10 shadow trades, you&apos;ll know if tennis trading is for you. No risk.
              </p>
              <Link
                href="/auth/signup"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl text-white font-semibold transition-all duration-300 hover:shadow-[0_0_30px_rgba(139,92,246,0.3)] hover:scale-[1.02]"
              >
                Start Shadow Trading &mdash; Free
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>

            {/* Right - Mock Shadow Trade Card */}
            <div className="bg-gray-900/70 border border-gray-800/50 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                  <span className="text-sm text-purple-400 font-semibold font-[family-name:var(--font-jetbrains)]">SHADOW MODE</span>
                </div>
                <span className="text-xs text-gray-500 font-[family-name:var(--font-dm)]">No real money</span>
              </div>
              {/* Mock trades */}
              {[
                { match: "Sinner vs Djokovic", entry: "1.85", exit: "1.62", pnl: "+£12.40", win: true },
                { match: "Alcaraz vs Medvedev", entry: "2.10", exit: "2.34", pnl: "-£5.20", win: false },
                { match: "Rune vs Tsitsipas", entry: "3.40", exit: "2.90", pnl: "+£8.80", win: true },
              ].map((trade) => (
                <div key={trade.match} className="flex items-center justify-between py-2 border-t border-gray-800/30">
                  <div>
                    <div className="text-sm text-gray-300 font-[family-name:var(--font-dm)]">{trade.match}</div>
                    <div className="text-xs text-gray-500 font-[family-name:var(--font-jetbrains)]">
                      {trade.entry} &rarr; {trade.exit}
                    </div>
                  </div>
                  <span className={`text-sm font-semibold font-[family-name:var(--font-jetbrains)] ${trade.win ? "text-green-400" : "text-red-400"}`}>
                    {trade.pnl}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-gray-700/50">
                <span className="text-sm text-gray-400 font-[family-name:var(--font-dm)]">Session P&amp;L</span>
                <span className="text-lg font-bold text-green-400 font-[family-name:var(--font-jetbrains)]">+£16.00</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── AI Features 3x2 Grid ───────── */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[10px] tracking-[0.2em] uppercase text-blue-400 font-medium mb-3 font-[family-name:var(--font-jetbrains)]">
              SIX AI-POWERED TOOLS
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 font-[family-name:var(--font-jakarta)]">
              Everything you need to trade smarter
            </h2>
            <p className="text-gray-400 max-w-lg mx-auto font-[family-name:var(--font-dm)]">
              Six intelligent tools working together to find, execute, and protect your edge on every match.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              }
              color="green"
              title="AI Guardian"
              description="4 intelligent exit strategies. Never guess when to close a position. Exit now, break even, partial hedge, or hold — with AI-calculated P&L for each."
            />

            <FeatureCard
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"
                />
              }
              color="gold"
              title="AI Coach"
              description="A personal trading mentor reviewing every trade. Specific to YOUR decisions — not generic advice. Learn from every win and loss."
            />

            <FeatureCard
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                />
              }
              color="blue"
              title="AI Signals"
              description="Real-time edge detection. Pre-match, in-play, and market mispricing alerts. Momentum detection, pattern recognition, and confidence scoring."
            />

            <FeatureCard
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                />
              }
              color="purple"
              title="Pre-Match Briefing"
              description="AI-generated trading intelligence 30 minutes before every match. Surface stats, head-to-head, form, and market pricing analysis."
            />

            <FeatureCard
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
                />
              }
              color="pink"
              title="Trading DNA"
              description="After 50 trades, we know your patterns better than you do. Your personal trading fingerprint — best surfaces, optimal timing, hidden weaknesses."
            />

            <FeatureCard
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6"
                />
              }
              color="amber"
              title="Market Scanner"
              description="Scans every live match simultaneously. Alerts you to momentum shifts, volume spikes, and WOM flips — so you never miss an opportunity."
            />
          </div>
        </div>
      </section>

      {/* ───────── Streak Protection Showcase ───────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-amber-500/5 rounded-full blur-3xl" />

        <div className="max-w-5xl mx-auto relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left - Copy */}
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase text-amber-400 font-medium mb-3 font-[family-name:var(--font-jetbrains)]">
                BANKROLL PROTECTION
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 font-[family-name:var(--font-jakarta)]">
                We protect your bankroll
              </h2>
              <p className="text-gray-400 mb-4 leading-relaxed font-[family-name:var(--font-dm)]">
                The only trading app that stops you when you should stop. Because we care
                about your money, not just ours.
              </p>
              <p className="text-gray-400 mb-8 leading-relaxed font-[family-name:var(--font-dm)]">
                3 losses: warning. 5 losses: 10-minute cooldown. Because the best trade after
                a losing streak is no trade at all.
              </p>
              <div className="space-y-4">
                {[
                  { threshold: "3 losses", action: "Amber alert — consider a break", color: "text-amber-400" },
                  { threshold: "5 losses", action: "Trading paused for 10 minutes", color: "text-red-400" },
                  { threshold: "Configurable", action: "Set your own threshold in Settings", color: "text-blue-400" },
                ].map((item) => (
                  <div key={item.threshold} className="flex items-start gap-3">
                    <div className={`text-xs font-semibold font-[family-name:var(--font-jetbrains)] ${item.color} mt-0.5 min-w-[90px]`}>
                      {item.threshold}
                    </div>
                    <span className="text-sm text-gray-400 font-[family-name:var(--font-dm)]">{item.action}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right - Mock UI */}
            <div className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-amber-400 font-semibold text-sm">STREAK ALERT</span>
                </div>
                <p className="text-amber-400/80 text-sm font-[family-name:var(--font-dm)]">
                  3 losses in a row. Traders who pause here recover faster. Consider a break.
                </p>
              </div>

              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
                <h3 className="text-white font-bold text-lg mb-2 font-[family-name:var(--font-jakarta)]">TRADING PAUSED</h3>
                <p className="text-red-400/80 text-sm mb-4 font-[family-name:var(--font-dm)]">
                  5 consecutive losses. Trading disabled for 10 minutes.
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 rounded-lg">
                  <span className="text-red-400 font-[family-name:var(--font-jetbrains)] text-sm font-bold">7:42</span>
                  <span className="text-red-400/60 text-xs">remaining</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Comparison Table ───────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[10px] tracking-[0.2em] uppercase text-blue-400 font-medium mb-3 font-[family-name:var(--font-jetbrains)]">
              WHY SWITCH
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 font-[family-name:var(--font-jakarta)]">
              Why traders are switching
            </h2>
            <p className="text-gray-400 max-w-lg mx-auto font-[family-name:var(--font-dm)]">
              The tools you&apos;re used to were built a decade ago. Tennis Trader AI was built for how you trade today.
            </p>
          </div>

          <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-[family-name:var(--font-dm)]">
                <thead>
                  <tr className="border-b border-gray-800/50">
                    <th className="text-left px-6 py-4 text-gray-500 font-medium text-xs tracking-wider uppercase">Feature</th>
                    <th className="text-center px-4 py-4 text-white font-semibold">
                      <span className="gradient-text">Tennis Trader AI</span>
                    </th>
                    <th className="text-center px-4 py-4 text-gray-500 font-medium">Bet Angel</th>
                    <th className="text-center px-4 py-4 text-gray-500 font-medium">Geeks Toy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/30">
                  <ComparisonRow feature="Works on Mac" us={true} angel={false} geeks={false} />
                  <ComparisonRow feature="Works on iPhone/iPad" us={true} angel={false} geeks={false} />
                  <ComparisonRow feature="No download required" us={true} angel={false} geeks={false} />
                  <ComparisonRow feature="AI trading signals" us={true} angel={false} geeks={false} />
                  <ComparisonRow feature="AI exit strategies" us={true} angel={false} geeks={false} />
                  <ComparisonRow feature="Shadow mode (paper trading)" us={true} angel={false} geeks={false} />
                  <ComparisonRow feature="Trading DNA analytics" us={true} angel={false} geeks={false} />
                  <ComparisonRow feature="Streak protection" us={true} angel={false} geeks={false} />
                  <ComparisonRow feature="Post-trade AI coaching" us={true} angel={false} geeks={false} />
                  <ComparisonRow feature="Market scanner alerts" us={true} angel={false} geeks={false} />
                  <ComparisonRow feature="Pre-match AI briefings" us={true} angel={false} geeks={false} />
                  <ComparisonRow feature="Price" us="£37/mo" angel="£150/yr" geeks="£20/mo" />
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Pricing ───────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[10px] tracking-[0.2em] uppercase text-blue-400 font-medium mb-3 font-[family-name:var(--font-jetbrains)]">
              SIMPLE PRICING
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 font-[family-name:var(--font-jakarta)]">
              One plan. Everything included.
            </h2>
            <p className="text-gray-400 max-w-lg mx-auto font-[family-name:var(--font-dm)]">
              Start free with Shadow Mode. Subscribe when you&apos;re ready to go live.
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <div className="relative bg-gray-900/50 border border-gray-800/50 rounded-2xl p-8 hover:border-blue-500/20 transition-all duration-500">
              {/* Founding member badge */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <div className="px-4 py-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full text-xs font-semibold text-white">
                  Founding Member Offer
                </div>
              </div>

              <div className="text-center mt-4 mb-8">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <span className="text-2xl text-gray-500 line-through font-[family-name:var(--font-jetbrains)]">
                    &pound;47
                  </span>
                  <span className="text-5xl font-bold text-white font-[family-name:var(--font-jetbrains)]">&pound;37</span>
                  <span className="text-gray-400 font-[family-name:var(--font-dm)]">/month</span>
                </div>
                <p className="text-sm text-gray-500 font-[family-name:var(--font-dm)]">
                  Lock in founding member pricing forever
                </p>
              </div>

              <div className="space-y-3 mb-8">
                {[
                  "AI-powered trade signals",
                  "Professional trading ladder",
                  "Real-time Betfair data",
                  "AI Guardian (4 exit strategies)",
                  "Market Scanner alerts",
                  "Trading DNA analysis",
                  "AI Coach post-trade review",
                  "Pre-match AI briefings",
                  "Shadow mode (paper trading)",
                  "Streak Protection",
                  "Works on Mac, iPhone, iPad",
                  "Priority support",
                ].map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-3 h-3 text-green-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                    </div>
                    <span className="text-sm text-gray-300 font-[family-name:var(--font-dm)]">{feature}</span>
                  </div>
                ))}
              </div>

              <Link
                href="/auth/signup"
                className="block w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl text-white font-semibold text-center transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:scale-[1.02]"
              >
                Start with Shadow Mode &mdash; Free
              </Link>

              <p className="text-center text-xs text-gray-600 mt-4 font-[family-name:var(--font-dm)]">
                Shadow Mode is free forever. Subscribe when you&apos;re ready for live trading.
              </p>

              {/* Affiliate teaser */}
              <div className="mt-6 pt-6 border-t border-gray-800/50 text-center">
                <p className="text-xs text-gray-500 font-[family-name:var(--font-dm)]">
                  30% affiliate commission &mdash; earn &pound;11.10/month per referral
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Affiliate Section ───────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 border border-gray-800/50 rounded-2xl p-8 sm:p-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <p className="text-[10px] tracking-[0.2em] uppercase text-green-400 font-medium mb-3 font-[family-name:var(--font-jetbrains)]">
                  AFFILIATE PROGRAMME
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 font-[family-name:var(--font-jakarta)]">
                  Earn while you trade
                </h2>
                <p className="text-gray-400 mb-6 leading-relaxed font-[family-name:var(--font-dm)]">
                  Refer a trader, earn 30% recurring. That&apos;s &pound;11.10 every month per active referral.
                </p>
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl text-white font-semibold transition-all duration-300 hover:shadow-[0_0_30px_rgba(34,197,94,0.3)] hover:scale-[1.02]"
                >
                  Join free to get your referral link
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-400 font-[family-name:var(--font-jetbrains)] mb-1">30%</div>
                  <div className="text-xs text-gray-500 font-[family-name:var(--font-dm)]">Recurring commission</div>
                </div>
                <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-400 font-[family-name:var(--font-jetbrains)] mb-1">&pound;11.10</div>
                  <div className="text-xs text-gray-500 font-[family-name:var(--font-dm)]">Per referral / month</div>
                </div>
                <div className="col-span-2 bg-gray-800/30 border border-gray-700/30 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-400 font-[family-name:var(--font-jetbrains)] mb-1">10 referrals = &pound;111/mo</div>
                  <div className="text-xs text-gray-500 font-[family-name:var(--font-dm)]">Passive income while you trade</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Final CTA ───────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 font-[family-name:var(--font-jakarta)]">
            Ready to trade tennis on your terms?
          </h2>
          <p className="text-gray-400 max-w-lg mx-auto mb-8 font-[family-name:var(--font-dm)]">
            Start with Shadow Mode for free. Practice with real odds, zero risk. Subscribe when you&apos;re ready.
          </p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl text-white font-semibold text-lg transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:scale-[1.02]"
          >
            Start with Shadow Mode &mdash; Free
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
              />
            </svg>
          </Link>
        </div>
      </section>

      {/* ───────── Footer ───────── */}
      <Footer />
    </main>
  );
}

/* ───────── Helper Components ───────── */

const colorMap: Record<string, { border: string; bg: string; text: string; shadow: string }> = {
  blue: { border: "hover:border-blue-500/30", bg: "bg-blue-500/10 group-hover:bg-blue-500/20", text: "text-blue-400", shadow: "hover:shadow-[0_0_30px_rgba(59,130,246,0.08)]" },
  purple: { border: "hover:border-purple-500/30", bg: "bg-purple-500/10 group-hover:bg-purple-500/20", text: "text-purple-400", shadow: "hover:shadow-[0_0_30px_rgba(139,92,246,0.08)]" },
  green: { border: "hover:border-green-500/30", bg: "bg-green-500/10 group-hover:bg-green-500/20", text: "text-green-400", shadow: "hover:shadow-[0_0_30px_rgba(34,197,94,0.08)]" },
  amber: { border: "hover:border-amber-500/30", bg: "bg-amber-500/10 group-hover:bg-amber-500/20", text: "text-amber-400", shadow: "hover:shadow-[0_0_30px_rgba(245,158,11,0.08)]" },
  pink: { border: "hover:border-pink-500/30", bg: "bg-pink-500/10 group-hover:bg-pink-500/20", text: "text-pink-400", shadow: "hover:shadow-[0_0_30px_rgba(236,72,153,0.08)]" },
  gold: { border: "hover:border-yellow-500/30", bg: "bg-yellow-500/10 group-hover:bg-yellow-500/20", text: "text-yellow-400", shadow: "hover:shadow-[0_0_30px_rgba(234,179,8,0.08)]" },
};

function FeatureCard({ icon, color, title, description }: { icon: React.ReactNode; color: string; title: string; description: string }) {
  const c = colorMap[color] ?? colorMap.blue;
  return (
    <div className={`group relative bg-gray-900/50 border border-gray-800/50 rounded-2xl p-8 ${c.border} transition-all duration-500 ${c.shadow}`}>
      <div className={`w-12 h-12 rounded-xl ${c.bg} flex items-center justify-center mb-6 transition-colors`}>
        <svg className={`w-6 h-6 ${c.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          {icon}
        </svg>
      </div>
      <h3 className="text-xl font-semibold mb-3 font-[family-name:var(--font-jakarta)]">{title}</h3>
      <p className="text-gray-400 leading-relaxed font-[family-name:var(--font-dm)]">{description}</p>
    </div>
  );
}

function ComparisonRow({ feature, us, angel, geeks }: { feature: string; us: boolean | string; angel: boolean | string; geeks: boolean | string }) {
  const renderCell = (val: boolean | string) => {
    if (val === true) return <span className="text-green-400">&#10003;</span>;
    if (val === false) return <span className="text-gray-700">&mdash;</span>;
    return <span className="text-gray-300 text-xs font-[family-name:var(--font-jetbrains)]">{val}</span>;
  };
  return (
    <tr className="hover:bg-gray-800/20 transition-colors">
      <td className="px-6 py-3 text-gray-300 font-medium font-[family-name:var(--font-dm)]">{feature}</td>
      <td className="text-center px-4 py-3 font-semibold">{renderCell(us)}</td>
      <td className="text-center px-4 py-3">{renderCell(angel)}</td>
      <td className="text-center px-4 py-3">{renderCell(geeks)}</td>
    </tr>
  );
}
