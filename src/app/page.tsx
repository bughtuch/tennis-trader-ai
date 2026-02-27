import Link from "next/link";

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

        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900/60 border border-gray-800/50 backdrop-blur-sm mb-8 fade-in-up"
          >
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-gray-300">
              Live on Betfair Exchange
            </span>
          </div>

          {/* Headline */}
          <h1
            className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 fade-in-up"
            style={{ animationDelay: "0.1s" }}
          >
            Trade Tennis with
            <br />
            <span className="gradient-text">AI Precision</span>
          </h1>

          {/* Subtitle */}
          <p
            className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed fade-in-up"
            style={{ animationDelay: "0.2s" }}
          >
            Professional-grade trading ladder, real-time AI signals, and
            intelligent position management. Built for serious tennis traders.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 fade-in-up"
            style={{ animationDelay: "0.3s" }}
          >
            <Link
              href="/trading"
              className="group relative px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl text-white font-semibold text-lg transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:scale-[1.02]"
            >
              Start Trading
              <span className="ml-2 inline-block transition-transform group-hover:translate-x-1">
                →
              </span>
            </Link>
            <Link
              href="#features"
              className="px-8 py-4 rounded-xl text-gray-300 font-medium text-lg border border-gray-800 hover:border-gray-700 hover:bg-gray-900/50 transition-all duration-300"
            >
              See How It Works
            </Link>
          </div>

          {/* Social Proof */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-8 text-sm text-gray-500 fade-in-up"
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
              <span>
                Trusted by{" "}
                <strong className="text-gray-300">500+</strong> tennis traders
              </span>
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
              <span className="ml-1">4.9/5 rating</span>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Features ───────── */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[10px] tracking-[0.2em] uppercase text-blue-400 font-medium mb-3">
              POWERFUL FEATURES
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Everything you need to trade smarter
            </h2>
            <p className="text-gray-400 max-w-lg mx-auto">
              Three pillars of intelligent trading, working together to give you
              an edge on every match.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* AI Signals */}
            <div className="group relative bg-gray-900/50 border border-gray-800/50 rounded-2xl p-8 hover:border-blue-500/30 transition-all duration-500 hover:shadow-[0_0_30px_rgba(59,130,246,0.08)]">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:bg-blue-500/20 transition-colors">
                <svg
                  className="w-6 h-6 text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">AI Signals</h3>
              <p className="text-gray-400 leading-relaxed">
                Real-time trade signals powered by machine learning. Momentum
                detection, pattern recognition, and confidence scoring on every
                recommendation.
              </p>
            </div>

            {/* Live Ladder */}
            <div className="group relative bg-gray-900/50 border border-gray-800/50 rounded-2xl p-8 hover:border-purple-500/30 transition-all duration-500 hover:shadow-[0_0_30px_rgba(139,92,246,0.08)]">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-6 group-hover:bg-purple-500/20 transition-colors">
                <svg
                  className="w-6 h-6 text-purple-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Live Ladder</h3>
              <p className="text-gray-400 leading-relaxed">
                Professional trading ladder with real-time depth. Click-to-trade
                execution, weight of money indicators, and instant position
                management.
              </p>
            </div>

            {/* AI Guardian */}
            <div className="group relative bg-gray-900/50 border border-gray-800/50 rounded-2xl p-8 hover:border-green-500/30 transition-all duration-500 hover:shadow-[0_0_30px_rgba(34,197,94,0.08)]">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-6 group-hover:bg-green-500/20 transition-colors">
                <svg
                  className="w-6 h-6 text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">AI Guardian</h3>
              <p className="text-gray-400 leading-relaxed">
                Intelligent risk management that monitors your positions. Auto
                stop-loss, exposure alerts, and session limits to protect your
                bankroll.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Stats Bar ───────── */}
      <section className="py-16 px-4 border-y border-gray-800/50">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: "£2.4M+", label: "Volume Traded" },
            { value: "94%", label: "Uptime SLA" },
            { value: "<50ms", label: "Execution Speed" },
            { value: "500+", label: "Active Traders" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl sm:text-3xl font-bold gradient-text mb-1">
                {stat.value}
              </div>
              <div className="text-[10px] tracking-[0.2em] uppercase text-gray-500">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── Pricing ───────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[10px] tracking-[0.2em] uppercase text-blue-400 font-medium mb-3">
              SIMPLE PRICING
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              One plan. Everything included.
            </h2>
            <p className="text-gray-400 max-w-lg mx-auto">
              No tiers, no hidden fees. Get full access to every feature from
              day one.
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
                  <span className="text-2xl text-gray-500 line-through">
                    £47
                  </span>
                  <span className="text-5xl font-bold text-white">£37</span>
                  <span className="text-gray-400">/month</span>
                </div>
                <p className="text-sm text-gray-500">
                  Lock in founding member pricing forever
                </p>
              </div>

              <div className="space-y-3 mb-8">
                {[
                  "AI-powered trade signals",
                  "Professional trading ladder",
                  "Real-time Betfair data",
                  "AI Guardian risk management",
                  "Position & P/L tracking",
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
                    <span className="text-sm text-gray-300">{feature}</span>
                  </div>
                ))}
              </div>

              <Link
                href="/trading"
                className="block w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl text-white font-semibold text-center transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:scale-[1.02]"
              >
                Get Started Now
              </Link>

              <p className="text-center text-xs text-gray-600 mt-4">
                7-day free trial. Cancel anytime.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Final CTA ───────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Ready to elevate your trading?
          </h2>
          <p className="text-gray-400 max-w-lg mx-auto mb-8">
            Join hundreds of traders using AI to find edges in tennis markets.
          </p>
          <Link
            href="/trading"
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
      <footer className="border-t border-gray-800/50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                  <svg
                    className="w-3.5 h-3.5 text-white"
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
                <span className="font-bold text-white">Tennis Trader AI</span>
              </div>
              <p className="text-sm text-gray-500">
                AI-powered tennis trading for Betfair Exchange.
              </p>
            </div>

            <div>
              <h4 className="text-[10px] tracking-[0.2em] uppercase text-gray-500 font-medium mb-4">
                Product
              </h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <Link
                    href="/trading"
                    className="hover:text-white transition-colors"
                  >
                    Trading Ladder
                  </Link>
                </li>
                <li>
                  <Link
                    href="#features"
                    className="hover:text-white transition-colors"
                  >
                    AI Signals
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-white transition-colors"
                  >
                    AI Guardian
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-[10px] tracking-[0.2em] uppercase text-gray-500 font-medium mb-4">
                Company
              </h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <Link
                    href="#"
                    className="hover:text-white transition-colors"
                  >
                    About
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-white transition-colors"
                  >
                    Blog
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-white transition-colors"
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-[10px] tracking-[0.2em] uppercase text-gray-500 font-medium mb-4">
                Legal
              </h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <Link
                    href="#"
                    className="hover:text-white transition-colors"
                  >
                    Terms
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-white transition-colors"
                  >
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-white transition-colors"
                  >
                    Disclaimer
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800/50 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-600">
              © 2026 Tennis Trader AI. All rights reserved.
            </p>
            <p className="text-xs text-gray-700">
              Trading involves risk. Past performance is not indicative of
              future results.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
