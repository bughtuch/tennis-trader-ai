import Link from "next/link";
import Footer from "@/components/Footer";

export default function AboutPage() {
  return (
    <main className="min-h-screen pt-14 bg-[#030712]">
      {/* ───────── Hero ───────── */}
      <section className="relative py-14 sm:py-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

        <div className="relative max-w-3xl mx-auto text-center">
          <p className="text-[10px] tracking-[0.2em] uppercase text-blue-400 font-medium mb-4 font-[family-name:var(--font-jetbrains)]">
            ABOUT US
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-6 font-[family-name:var(--font-jakarta)]">
            Built by a trader,<br />
            <span className="gradient-text">for traders</span>
          </h1>
          <p className="text-lg text-gray-400 leading-relaxed font-[family-name:var(--font-dm)]">
            Tennis Trader AI was born out of frustration. The tools available to
            tennis traders were stuck in the past &mdash; so we built the platform
            we wished existed.
          </p>
        </div>
      </section>

      {/* ───────── The Problem ───────── */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold mb-4 font-[family-name:var(--font-jakarta)]">The Problem</h2>
          </div>
          <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl p-5 sm:p-8 md:p-12">
            <p className="text-gray-400 leading-relaxed mb-4 font-[family-name:var(--font-dm)]">
              Every tennis trading tool on the market felt like it was designed in 2010.
              Windows-only desktop apps that crash on a Mac. No mobile support. Clunky interfaces
              that haven&apos;t changed in years. And zero intelligence &mdash; just raw numbers
              with no context.
            </p>
            <p className="text-gray-400 leading-relaxed mb-4 font-[family-name:var(--font-dm)]">
              If you wanted to trade tennis on Betfair, you had to accept these limitations.
              You needed a specific laptop, sitting at a specific desk, running specific software
              that looked like it belonged in a different era.
            </p>
            <p className="text-gray-400 leading-relaxed font-[family-name:var(--font-dm)]">
              We knew there had to be a better way.
            </p>
          </div>
        </div>
      </section>

      {/* ───────── The Solution ───────── */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold mb-4 font-[family-name:var(--font-jakarta)]">The Solution</h2>
            <p className="text-gray-400 max-w-lg mx-auto font-[family-name:var(--font-dm)]">
              A modern tennis trading platform that works the way you do.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Works Everywhere",
                description: "Browser-based. Mac, Windows, tablet, phone. Trade from anywhere with an internet connection — no installs, no downloads, no compatibility issues.",
                color: "text-blue-400",
              },
              {
                title: "AI Finds the Edges",
                description: "Powered by state-of-the-art AI that analyses matches in real time, spots patterns humans miss, and delivers actionable signals — not just raw data.",
                color: "text-green-400",
              },
              {
                title: "Responsible Trading",
                description: "Built-in risk management, streak protection, daily loss limits, and AI Guardian. We want you to trade smarter, not just more.",
                color: "text-purple-400",
              },
            ].map((item) => (
              <div key={item.title} className="bg-gray-900/50 border border-gray-800/50 rounded-2xl p-6">
                <h3 className={`text-lg font-semibold mb-2 ${item.color} font-[family-name:var(--font-jakarta)]`}>{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed font-[family-name:var(--font-dm)]">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── The Company ───────── */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold mb-4 font-[family-name:var(--font-jakarta)]">The Company</h2>
          </div>
          <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl p-5 sm:p-8 md:p-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              <div>
                <div className="text-[10px] tracking-[0.2em] uppercase text-gray-500 mb-2 font-[family-name:var(--font-jetbrains)]">Company</div>
                <p className="text-white font-semibold">Bug Hutch Ltd</p>
              </div>
              <div>
                <div className="text-[10px] tracking-[0.2em] uppercase text-gray-500 mb-2 font-[family-name:var(--font-jetbrains)]">Registered</div>
                <p className="text-white font-semibold">England &amp; Wales</p>
              </div>
              <div>
                <div className="text-[10px] tracking-[0.2em] uppercase text-gray-500 mb-2 font-[family-name:var(--font-jetbrains)]">Product</div>
                <p className="text-white font-semibold">Tennis Trader AI</p>
              </div>
            </div>
            <div className="border-t border-gray-800/50 mt-8 pt-8">
              <p className="text-gray-400 leading-relaxed font-[family-name:var(--font-dm)]">
                Bug Hutch Ltd is a UK-based technology company focused on building
                intelligent trading tools. Tennis Trader AI is our flagship product,
                combining real-time Betfair Exchange data with state-of-the-art AI
                to create the most advanced tennis trading platform available.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── CTA ───────── */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4 font-[family-name:var(--font-jakarta)]">
            Ready to trade smarter?
          </h2>
          <p className="text-gray-400 mb-8 font-[family-name:var(--font-dm)]">
            Join traders who&apos;ve moved on from outdated desktop apps. Modern tools, real-time AI, responsible trading.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/signup"
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl text-white font-semibold text-lg text-center transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:scale-[1.02]"
            >
              Start Trading Free
            </Link>
            <Link
              href="/contact"
              className="w-full sm:w-auto px-8 py-4 rounded-xl text-gray-300 font-medium text-lg text-center border border-gray-800 hover:border-gray-700 hover:bg-gray-900/50 transition-all duration-300"
            >
              Get in Touch
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
