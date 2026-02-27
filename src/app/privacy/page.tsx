import Link from "next/link";
import Footer from "@/components/Footer";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-white mb-3">{title}</h2>
      <div className="space-y-3 text-sm text-gray-300 leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen pt-14 bg-[#030712]">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: 27 February 2026</p>

        <p className="text-sm text-gray-300 leading-relaxed mb-10">
          At Tennis Trader AI, we take your privacy seriously. This policy explains what information we
          collect, how we use it, and your rights regarding your personal data.
        </p>

        <Section title="1. Information We Collect">
          <p><span className="text-white font-medium">Account information:</span> When you register, we collect your name, email address, and password.</p>
          <p><span className="text-white font-medium">Payment information:</span> Subscription payments are processed by Stripe. We do not store your full card details.</p>
          <p><span className="text-white font-medium">Usage data:</span> We collect anonymised data about how you use the Service, including pages visited, features used, and session duration.</p>
          <p><span className="text-white font-medium">Trading data:</span> When you use live trading features, we process market data and trade instructions to provide the Service.</p>
        </Section>

        <Section title="2. How We Use Your Information">
          <p>We use your information to:</p>
          <ul className="list-disc list-inside space-y-1.5 text-gray-300 ml-1">
            <li>Provide and maintain the Service</li>
            <li>Process your subscription payments</li>
            <li>Send important service updates and notifications</li>
            <li>Improve the Service through anonymised usage analysis</li>
            <li>Provide customer support</li>
            <li>Generate AI-powered trading signals and analysis</li>
          </ul>
        </Section>

        <Section title="3. Betfair Credentials">
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
            <p className="text-blue-300 font-medium mb-2">Your Betfair credentials are handled with the highest security:</p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-300 ml-1">
              <li>Your Betfair password is never stored on our servers</li>
              <li>Authentication tokens are stored as secure, httpOnly cookies</li>
              <li>Session tokens expire automatically after 8 hours</li>
              <li>Your Betfair credentials are never shared with any third party</li>
              <li>All communication with Betfair APIs uses encrypted HTTPS connections</li>
            </ul>
          </div>
        </Section>

        <Section title="4. Data Retention">
          <p>
            We retain your account information for as long as your account is active. If you cancel
            your subscription, we retain your data for 30 days to allow for re-activation, after
            which it is permanently deleted.
          </p>
          <p>
            Anonymised usage data may be retained indefinitely for service improvement purposes.
            Trading history is retained for 90 days after account closure.
          </p>
        </Section>

        <Section title="5. Cookies">
          <p>
            We use cookies to maintain your session, remember your preferences, and improve the
            Service. Essential cookies (such as the Betfair session cookie) are required for the
            Service to function. See our{" "}
            <Link href="/cookies" className="text-blue-400 hover:text-blue-300 transition-colors">
              Cookie Policy
            </Link>{" "}
            for full details.
          </p>
        </Section>

        <Section title="6. Third-Party Services">
          <p>We share data with the following third-party services as necessary to provide the Service:</p>
          <ul className="list-disc list-inside space-y-1.5 text-gray-300 ml-1">
            <li><span className="text-white font-medium">Betfair Exchange:</span> Market data and trade execution via their official API</li>
            <li><span className="text-white font-medium">Stripe:</span> Payment processing for subscriptions</li>
            <li><span className="text-white font-medium">Anthropic:</span> AI-powered match analysis and trading signals (no personal data is sent)</li>
          </ul>
          <p>
            Each third party operates under their own privacy policy. We only share the minimum data
            necessary for each service to function.
          </p>
        </Section>

        <Section title="7. Your Rights">
          <p>Under applicable data protection laws, you have the right to:</p>
          <ul className="list-disc list-inside space-y-1.5 text-gray-300 ml-1">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Object to processing of your data</li>
            <li>Request data portability</li>
            <li>Withdraw consent at any time</li>
          </ul>
          <p>
            To exercise any of these rights, contact us at{" "}
            <a href="mailto:support@tennistraderai.com" className="text-blue-400 hover:text-blue-300 transition-colors">
              support@tennistraderai.com
            </a>.
          </p>
        </Section>

        <Section title="8. Contact">
          <p>
            If you have any questions about this Privacy Policy, please contact us at{" "}
            <a href="mailto:support@tennistraderai.com" className="text-blue-400 hover:text-blue-300 transition-colors">
              support@tennistraderai.com
            </a>.
          </p>
        </Section>

      </div>
      <Footer />
    </main>
  );
}
