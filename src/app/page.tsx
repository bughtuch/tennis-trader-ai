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
            Trade Tennis with
            <br />
            <span className="gradient-text">AI Precision</span>
          </h1>

          {/* Subtitle */}
          <p
            className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed fade-in-up font-[family-name:var(--font-dm)]"
            style={{ animationDelay: "0.2s" }}
          >
            Professional-grade trading ladder, real-time AI signals, and
            intelligent risk management. The platform serious tennis traders
            have been waiting for.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 fade-in-up"
            style={{ animationDelay: "0.3s" }}
          >
            <Link
              href="/auth/signup"
              className="group relative w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl text-white font-semibold text-lg text-center transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:scale-[1.02]"
            >
              Start Trading Free
              <span className="ml-2 inline-block transition-transform group-hover:translate-x-1">
                &rarr;
              </span>
            </Link>
            <Link
              href="#features"
              className="w-full sm:w-auto px-8 py-4 rounded-xl text-gray-300 font-medium text-lg text-center border border-gray-800 hover:border-gray-700 hover:bg-gray-900/50 transition-all duration-300"
            >
              See How It Works
            </Link>
          </div>

          {/* Social Proof */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-8 text-sm text-gray-500 fade-in-up font-[family-name:var(--font-dm)]"
            style={{ animationDelay: "0.4s" }}
          >
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {["JD", "MK", "TS", "AL", "RW"].map((initials) => (
                  <div
                    key={initials}
                    className="w-7 h-7 rounded-full bg-gray-800 border-2 border-[#030712] flex items-center justify-center text-[10px] text-gray-400 font-medium"
                  >
                    {initials}
                  </div>
                ))}
              </div>
              <span>Founding members from Bet Angel, Geeks Toy &amp; TraderLine switching now</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-gray-800" />
            <div className="flex items-center gap-1.5">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  className="w-4 h-4 text-yellow-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
              <span className="ml-1">Built for pros</span>
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

      {/* ───────── Features 3x2 Grid ───────── */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[10px] tracking-[0.2em] uppercase text-blue-400 font-medium mb-3 font-[family-name:var(--font-jetbrains)]">
              SIX PILLARS OF EDGE
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 font-[family-name:var(--font-jakarta)]">
              Everything you need to trade smarter
            </h2>
            <p className="text-gray-400 max-w-lg mx-auto font-[family-name:var(--font-dm)]">
              Six intelligent tools working together to find, execute, and protect your edge on every match.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* AI Signals */}
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
              description="Real-time trade signals powered by Claude AI. Momentum detection, pattern recognition, and confidence scoring on every recommendation."
            />

            {/* Live Ladder */}
            <FeatureCard
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                />
              }
              color="purple"
              title="Live Ladder"
              description="Professional trading ladder with real-time depth. Click-to-trade execution, weight of money indicators, and instant position management."
            />

            {/* AI Guardian */}
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
              description="Intelligent risk management that monitors your positions. Auto stop-loss, exposure alerts, and session limits to protect your bankroll."
            />

            {/* Market Scanner */}
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
              description="Monitors every live tennis market in real-time. Momentum shifts, weight-of-money flips, and volume spikes — delivered as instant alerts."
            />

            {/* Trading DNA */}
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
              description="Your personal pattern fingerprint. AI analyses your trade history to reveal your best surfaces, timing, and hidden weaknesses."
            />

            {/* AI Coach */}
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
              description="Post-trade review after every closed position. One-line coaching insights that teach you to spot patterns and avoid mistakes."
            />
          </div>
        </div>
      </section>

      {/* ───────── Stats Bar ───────── */}
      <section className="py-16 px-4 border-y border-gray-800/50">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: "Live", label: "Betfair Data" },
            { value: "99.9%", label: "Uptime" },
            { value: "<50ms", label: "Execution Speed" },
            { value: "6", label: "AI-Powered Tools" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl sm:text-3xl font-bold gradient-text mb-1 font-[family-name:var(--font-jetbrains)]">
                {stat.value}
              </div>
              <div className="text-[10px] tracking-[0.2em] uppercase text-gray-500 font-[family-name:var(--font-dm)]">
                {stat.label}
              </div>
            </div>
          ))}
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
              How we compare
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
                    <th className="text-center px-4 py-4 text-gray-500 font-medium hidden sm:table-cell">Manual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/30">
                  <ComparisonRow feature="AI Trade Signals" us={true} angel={false} geeks={false} manual={false} />
                  <ComparisonRow feature="Post-Trade AI Coach" us={true} angel={false} geeks={false} manual={false} />
                  <ComparisonRow feature="Trading DNA Analysis" us={true} angel={false} geeks={false} manual={false} />
                  <ComparisonRow feature="Streak Protection" us={true} angel={false} geeks={false} manual={false} />
                  <ComparisonRow feature="Market Scanner" us={true} angel="basic" geeks="basic" manual={false} />
                  <ComparisonRow feature="Live Trading Ladder" us={true} angel={true} geeks={true} manual={false} />
                  <ComparisonRow feature="One-Click Green Up" us={true} angel={true} geeks={true} manual={false} />
                  <ComparisonRow feature="Pre-Match AI Briefing" us={true} angel={false} geeks={false} manual={false} />
                  <ComparisonRow feature="Shadow Mode (Paper)" us={true} angel={false} geeks={false} manual={false} />
                  <ComparisonRow feature="Tennis-Specific" us={true} angel={false} geeks={false} manual={false} />
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Streak Protection Showcase ───────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Subtle glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-amber-500/5 rounded-full blur-3xl" />

        <div className="max-w-5xl mx-auto relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left - Copy */}
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase text-amber-400 font-medium mb-3 font-[family-name:var(--font-jetbrains)]">
                SMART RISK MANAGEMENT
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 font-[family-name:var(--font-jakarta)]">
                Streak Protection stops you<br />before tilt takes over
              </h2>
              <p className="text-gray-400 mb-8 leading-relaxed font-[family-name:var(--font-dm)]">
                Three losses in a row? You get an amber warning. Five losses? Trading is
                automatically paused for 10 minutes. Because the best trade after a losing
                streak is no trade at all.
              </p>
              <div className="space-y-4">
                {[
                  { threshold: "3 losses", action: "Amber alert banner — consider a break", color: "text-amber-400" },
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
              {/* Amber banner mock */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-amber-400 font-semibold text-sm">STREAK ALERT</span>
                </div>
                <p className="text-amber-400/80 text-sm font-[family-name:var(--font-dm)]">
                  3 losses in a row. Traders who pause here recover faster. Consider a break.
                </p>
              </div>

              {/* Red cooldown mock */}
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
                <div className="text-3xl mb-3">&#x1F6D1;</div>
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
              No tiers, no hidden fees. Every AI feature, every tool, from day one.
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
                  "AI Guardian risk management",
                  "Market Scanner alerts",
                  "Trading DNA analysis",
                  "AI Coach post-trade review",
                  "Shadow mode (paper trading)",
                  "Streak Protection",
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
                Start 7-Day Free Trial
              </Link>

              <p className="text-center text-xs text-gray-600 mt-4 font-[family-name:var(--font-dm)]">
                7-day free trial. Cancel anytime. No card required to start.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Testimonial Placeholders ───────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[10px] tracking-[0.2em] uppercase text-blue-400 font-medium mb-3 font-[family-name:var(--font-jetbrains)]">
              FROM THE COMMUNITY
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 font-[family-name:var(--font-jakarta)]">
              What traders are saying
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                quote: "The AI signals caught a momentum shift I would have missed. Turned what would have been a loss into a profitable green-up.",
                name: "James D.",
                role: "Tennis Trader, 4 years",
              },
              {
                quote: "Streak Protection saved me at least &pound;200 last week. I was on tilt and the 10-minute cooldown forced me to step back.",
                name: "Mike K.",
                role: "Former Bet Angel user",
              },
              {
                quote: "The Trading DNA feature showed me I was consistently losing on clay courts. Changed my approach and my win rate jumped.",
                name: "Sarah L.",
                role: "Part-time trader",
              },
            ].map((testimonial) => (
              <div
                key={testimonial.name}
                className="bg-gray-900/50 border border-gray-800/50 rounded-2xl p-6 hover:border-gray-700/50 transition-all duration-300"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-gray-300 text-sm leading-relaxed mb-6 font-[family-name:var(--font-dm)]" dangerouslySetInnerHTML={{ __html: testimonial.quote }} />
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-xs text-gray-400 font-semibold border border-gray-700/50">
                    {testimonial.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <div className="text-sm text-white font-medium">{testimonial.name}</div>
                    <div className="text-xs text-gray-500 font-[family-name:var(--font-dm)]">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Final CTA ───────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 font-[family-name:var(--font-jakarta)]">
            Ready to elevate your trading?
          </h2>
          <p className="text-gray-400 max-w-lg mx-auto mb-8 font-[family-name:var(--font-dm)]">
            Join our founding members using AI to find edges in live tennis markets.
          </p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl text-white font-semibold text-lg transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:scale-[1.02]"
          >
            Start Trading Free
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

function ComparisonRow({ feature, us, angel, geeks, manual }: { feature: string; us: boolean | string; angel: boolean | string; geeks: boolean | string; manual: boolean | string }) {
  const renderCell = (val: boolean | string) => {
    if (val === true) return <span className="text-green-400">&#10003;</span>;
    if (val === false) return <span className="text-gray-700">&mdash;</span>;
    return <span className="text-yellow-400 text-xs">{val}</span>;
  };
  return (
    <tr className="hover:bg-gray-800/20 transition-colors">
      <td className="px-6 py-3 text-gray-300 font-medium font-[family-name:var(--font-dm)]">{feature}</td>
      <td className="text-center px-4 py-3 font-semibold">{renderCell(us)}</td>
      <td className="text-center px-4 py-3">{renderCell(angel)}</td>
      <td className="text-center px-4 py-3">{renderCell(geeks)}</td>
      <td className="text-center px-4 py-3 hidden sm:table-cell">{renderCell(manual)}</td>
    </tr>
  );
}
