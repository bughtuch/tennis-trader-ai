import Link from "next/link";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-white mb-3">{title}</h2>
      <div className="space-y-3 text-sm text-gray-300 leading-relaxed">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <main className="min-h-screen pt-14 bg-[#030712]">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: 27 February 2026</p>

        {/* Key disclaimer */}
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 mb-10">
          <p className="text-sm text-amber-300 font-medium leading-relaxed">
            Tennis Trader AI provides tools and analysis only. We do not provide financial advice.
            All trading decisions are your own responsibility.
          </p>
        </div>

        <Section title="1. Acceptance of Terms">
          <p>
            By accessing or using Tennis Trader AI (&quot;the Service&quot;), you agree to be bound by these
            Terms of Service. If you do not agree to these terms, do not use the Service.
          </p>
          <p>
            You must be at least 18 years old to use the Service. By using Tennis Trader AI, you
            represent and warrant that you are of legal age to form a binding contract and meet all
            eligibility requirements.
          </p>
        </Section>

        <Section title="2. Description of Service">
          <p>
            Tennis Trader AI is a software platform that provides tools for trading on Betfair Exchange,
            including real-time market data display, trading ladder interface, AI-powered match analysis,
            and position management tools.
          </p>
          <p>
            The Service is a tool to assist your decision-making. It does not execute trades on your
            behalf without your explicit instruction, and it does not guarantee any particular outcome.
          </p>
        </Section>

        <Section title="3. Account Registration">
          <p>
            To use certain features of the Service, you must create an account and provide accurate,
            complete information. You are responsible for maintaining the confidentiality of your
            account credentials.
          </p>
          <p>
            You are responsible for all activities that occur under your account. You must notify us
            immediately of any unauthorised use of your account.
          </p>
        </Section>

        <Section title="4. Trading Risks">
          <p>
            Trading on Betfair Exchange involves significant financial risk. You may lose some or all of
            your deposited funds. Past performance of AI signals or any analysis provided by the Service
            is not indicative of future results.
          </p>
          <p>
            You acknowledge that you understand the risks involved in exchange trading and that you are
            solely responsible for any trading decisions you make. Tennis Trader AI is not a financial
            adviser and does not provide personalised financial advice.
          </p>
        </Section>

        <Section title="5. Betfair Integration">
          <p>
            The Service integrates with Betfair Exchange via their official API. You must have a valid
            Betfair account to use live trading features. Your use of Betfair is subject to
            Betfair&apos;s own terms and conditions.
          </p>
          <p>
            Tennis Trader AI is an independent product and is not affiliated with, endorsed by, or
            sponsored by Betfair or Flutter Entertainment plc.
          </p>
        </Section>

        <Section title="6. Subscription & Billing">
          <p>
            Access to Tennis Trader AI requires a paid subscription. Subscription fees are billed
            monthly in advance. All fees are in British Pounds (GBP) unless otherwise stated.
          </p>
          <p>
            You may cancel your subscription at any time. Cancellation takes effect at the end of the
            current billing period. We do not offer refunds for partial months.
          </p>
          <p>
            We reserve the right to change subscription pricing with 30 days&apos; notice. Founding
            member pricing is locked in for the duration of continuous membership.
          </p>
        </Section>

        <Section title="7. Limitation of Liability">
          <p>
            To the maximum extent permitted by law, Tennis Trader AI and its operators shall not be
            liable for any indirect, incidental, special, consequential, or punitive damages, including
            but not limited to loss of profits, data, or trading losses.
          </p>
          <p>
            Our total liability to you for any claims arising from your use of the Service shall not
            exceed the amount you paid for the Service in the 12 months preceding the claim.
          </p>
        </Section>

        <Section title="8. Termination">
          <p>
            We may terminate or suspend your account at any time for violation of these terms, abusive
            behaviour, or at our sole discretion with reasonable notice.
          </p>
          <p>
            Upon termination, your right to use the Service ceases immediately. We will not be liable
            for any losses or damages resulting from termination of your account.
          </p>
        </Section>

        <Section title="9. Changes to Terms">
          <p>
            We reserve the right to modify these terms at any time. Material changes will be
            communicated via email or through the Service. Your continued use of the Service after
            changes constitutes acceptance of the updated terms.
          </p>
        </Section>

        <div className="mt-16 pt-8 border-t border-gray-800/50 text-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
