import Link from "next/link";
import Footer from "@/components/Footer";

export default function AboutPage() {
  return (
    <main className="min-h-screen pt-14 bg-[#030712]">
      {/* ───────── Hero ───────── */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

        <div className="relative max-w-3xl mx-auto text-center">
          <p className="text-[10px] tracking-[0.2em] uppercase text-blue-400 font-medium mb-4 font-[family-name:var(--font-jetbrains)]">
            ABOUT US
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6 font-[family-name:var(--font-jakarta)]">
            Built by traders,<br />
            <span className="gradient-text">for traders</span>
          </h1>
          <p className="text-lg text-gray-400 leading-relaxed font-[family-name:var(--font-dm)]">
            Tennis Trader AI exists because we got tired of using decade-old tools
            in a world where AI can give you a genuine edge. We built the platform
            we wished existed.
          </p>
        </div>
      </section>

      {/* ───────── Mission ───────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <div>
              <h2 className="text-2xl font-bold mb-4 font-[family-name:var(--font-jakarta)]">Our Mission</h2>
              <p className="text-gray-400 leading-relaxed mb-4 font-[family-name:var(--font-dm)]">
                To give every tennis trader access to the same AI-powered tools and
                risk management that institutional trading desks take for granted.
              </p>
              <p className="text-gray-400 leading-relaxed font-[family-name:var(--font-dm)]">
                We believe that smarter tools create better traders. Not tools that
                trade for you &mdash; tools that make <em>you</em> sharper, more disciplined,
                and more profitable.
              </p>
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-4 font-[family-name:var(--font-jakarta)]">Why Tennis?</h2>
              <p className="text-gray-400 leading-relaxed mb-4 font-[family-name:var(--font-dm)]">
                Tennis is the purest trading sport on Betfair. Two players, binary
                outcomes, constant momentum shifts, and deep liquidity. It&apos;s a market
                that rewards skill, pattern recognition, and discipline.
              </p>
              <p className="text-gray-400 leading-relaxed font-[family-name:var(--font-dm)]">
                Yet most traders still use general-purpose tools designed for horse
                racing. Tennis Trader AI is the first platform built exclusively
                for the sport.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── The Company ───────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold mb-4 font-[family-name:var(--font-jakarta)]">The Company</h2>
          </div>
          <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl p-8 md:p-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <div className="text-[10px] tracking-[0.2em] uppercase text-gray-500 mb-2 font-[family-name:var(--font-jetbrains)]">Company</div>
                <p className="text-white font-semibold">Bug Hutch Ltd</p>
              </div>
              <div>
                <div className="text-[10px] tracking-[0.2em] uppercase text-gray-500 mb-2 font-[family-name:var(--font-jetbrains)]">Product</div>
                <p className="text-white font-semibold">Tennis Trader AI</p>
              </div>
              <div>
                <div className="text-[10px] tracking-[0.2em] uppercase text-gray-500 mb-2 font-[family-name:var(--font-jetbrains)]">Powered By</div>
                <p className="text-white font-semibold">TOWN</p>
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

      {/* ───────── Technology ───────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold mb-4 font-[family-name:var(--font-jakarta)]">Our Technology</h2>
            <p className="text-gray-400 max-w-lg mx-auto font-[family-name:var(--font-dm)]">
              We combine the best of modern web technology with cutting-edge AI
              to deliver a trading experience that&apos;s fast, intelligent, and reliable.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                title: "Claude AI",
                description: "Anthropic's Claude powers our AI signals, coaching, briefings, and DNA analysis. Purpose-built prompts for tennis trading context.",
                color: "text-blue-400",
              },
              {
                title: "Betfair Exchange API",
                description: "Direct integration with Betfair's JSON-RPC API for real-time market data, pricing depth, and trade execution.",
                color: "text-green-400",
              },
              {
                title: "Edge Computing",
                description: "All API routes run on edge infrastructure for sub-50ms response times worldwide. No cold starts, no lag.",
                color: "text-purple-400",
              },
              {
                title: "Real-Time Architecture",
                description: "Live polling, instant UI updates, and background market scanning keep you ahead of every price movement.",
                color: "text-amber-400",
              },
            ].map((tech) => (
              <div key={tech.title} className="bg-gray-900/50 border border-gray-800/50 rounded-2xl p-6">
                <h3 className={`text-lg font-semibold mb-2 ${tech.color} font-[family-name:var(--font-jakarta)]`}>{tech.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed font-[family-name:var(--font-dm)]">{tech.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Values ───────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold mb-4 font-[family-name:var(--font-jakarta)]">What We Believe</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Discipline Over Luck",
                description: "The best traders aren't the boldest — they're the most disciplined. Every feature we build reinforces good habits.",
              },
              {
                title: "Transparency First",
                description: "No black-box algorithms. You see every signal, every confidence score, every piece of reasoning. You make the final call.",
              },
              {
                title: "Risk Is Everything",
                description: "Protecting your bankroll matters more than any single trade. Streak Protection, AI Guardian, and daily limits are core — not add-ons.",
              },
            ].map((value) => (
              <div key={value.title} className="text-center">
                <h3 className="text-lg font-semibold text-white mb-3 font-[family-name:var(--font-jakarta)]">{value.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed font-[family-name:var(--font-dm)]">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── CTA ───────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4 font-[family-name:var(--font-jakarta)]">
            Ready to trade smarter?
          </h2>
          <p className="text-gray-400 mb-8 font-[family-name:var(--font-dm)]">
            Join our founding members and get lifetime access to every feature at our lowest price.
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
