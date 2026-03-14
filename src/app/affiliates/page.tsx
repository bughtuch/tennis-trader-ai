import Link from "next/link";
import Footer from "@/components/Footer";

export default function AffiliatesPage() {
  return (
    <main className="min-h-screen pt-14 bg-[#030712]">
      {/* Hero */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 mb-8">
            <span className="text-sm font-medium text-green-400">
              30% Recurring Commission
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-6">
            Earn £11.10/month
            <br />
            <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
              per referral
            </span>
          </h1>
          <p className="text-lg text-gray-400 max-w-xl mx-auto mb-10 leading-relaxed">
            Refer tennis traders to our platform and earn 30% of their
            subscription — every month, for as long as they stay.
          </p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl text-white font-semibold text-lg transition-all duration-300 hover:shadow-[0_0_30px_rgba(34,197,94,0.3)] hover:scale-[1.02]"
          >
            Sign Up to Get Your Link
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

      {/* How it works */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-12">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Sign up",
                description:
                  "Create your account and get a unique referral link from your dashboard.",
              },
              {
                step: "2",
                title: "Share your link",
                description:
                  "Share with fellow tennis traders — social media, forums, your community.",
              },
              {
                step: "3",
                title: "Earn monthly",
                description:
                  "Earn 30% (£11.10) every month for each active subscriber you refer.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-gray-900/50 border border-gray-800/50 rounded-2xl p-6 text-center"
              >
                <div className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-green-400 font-bold">{item.step}</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Details */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-10">
            Programme details
          </h2>
          <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl p-6 space-y-4">
            {[
              { label: "Commission rate", value: "30% recurring" },
              { label: "Per referral", value: "£11.10/month (30% of £37)" },
              { label: "Cookie duration", value: "90 days" },
              { label: "Payout schedule", value: "Monthly via Stripe" },
              { label: "Minimum payout", value: "£25" },
              { label: "Recurring?", value: "Yes — for the lifetime of each referral" },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between py-2 border-b border-gray-800/30 last:border-0"
              >
                <span className="text-sm text-gray-400">{row.label}</span>
                <span className="text-sm font-medium text-white">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Earnings example */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white mb-8">
            Potential earnings
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { referrals: "5", monthly: "£55.50" },
              { referrals: "20", monthly: "£222" },
              { referrals: "50", monthly: "£555" },
            ].map((tier) => (
              <div
                key={tier.referrals}
                className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-5"
              >
                <div className="text-2xl font-bold text-green-400 mb-1">
                  {tier.monthly}
                </div>
                <div className="text-[10px] tracking-[0.15em] uppercase text-gray-500">
                  {tier.referrals} referrals/mo
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white mb-4">
            Ready to start earning?
          </h2>
          <p className="text-gray-400 mb-8">
            Sign up for a free account and get your referral link instantly.
          </p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl text-white font-semibold text-lg transition-all duration-300 hover:shadow-[0_0_30px_rgba(34,197,94,0.3)] hover:scale-[1.02]"
          >
            Get Your Referral Link
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
