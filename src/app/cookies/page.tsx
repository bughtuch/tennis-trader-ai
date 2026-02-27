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

function CookieRow({ name, purpose, duration, type }: { name: string; purpose: string; duration: string; type: string }) {
  return (
    <div className="bg-gray-800/30 rounded-xl p-3.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-mono text-white">{name}</span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          type === "Essential" ? "bg-blue-500/10 text-blue-400" :
          type === "Analytics" ? "bg-purple-500/10 text-purple-400" :
          "bg-gray-500/10 text-gray-400"
        }`}>
          {type}
        </span>
      </div>
      <p className="text-xs text-gray-400">{purpose}</p>
      <div className="text-[11px] text-gray-500">Duration: {duration}</div>
    </div>
  );
}

export default function CookiesPage() {
  return (
    <main className="min-h-screen pt-14 bg-[#030712]">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-white mb-2">Cookie Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: 27 February 2026</p>

        <p className="text-sm text-gray-300 leading-relaxed mb-10">
          This Cookie Policy explains how Tennis Trader AI uses cookies and similar technologies
          when you use our Service. By using Tennis Trader AI, you consent to the use of cookies
          as described in this policy.
        </p>

        <Section title="1. What Are Cookies?">
          <p>
            Cookies are small text files stored on your device when you visit a website. They help
            the website remember your preferences and provide a better user experience. Some cookies
            are essential for the Service to function, while others help us improve it.
          </p>
        </Section>

        <Section title="2. Cookies We Use">
          <h3 className="text-sm font-semibold text-white mt-4 mb-3">Essential Cookies</h3>
          <p className="mb-3">
            These cookies are necessary for the Service to function and cannot be disabled.
          </p>
          <div className="space-y-2 mb-6">
            <CookieRow
              name="betfair_session"
              purpose="Stores your Betfair authentication token for live trading. This is a secure, httpOnly cookie that cannot be accessed by JavaScript."
              duration="8 hours"
              type="Essential"
            />
            <CookieRow
              name="session_id"
              purpose="Maintains your Tennis Trader AI login session."
              duration="30 days"
              type="Essential"
            />
          </div>

          <h3 className="text-sm font-semibold text-white mt-4 mb-3">Analytics Cookies</h3>
          <p className="mb-3">
            These cookies help us understand how you use the Service so we can improve it.
          </p>
          <div className="space-y-2 mb-6">
            <CookieRow
              name="_analytics"
              purpose="Tracks anonymised usage patterns including pages visited, features used, and session duration. No personal data is collected."
              duration="1 year"
              type="Analytics"
            />
          </div>

          <h3 className="text-sm font-semibold text-white mt-4 mb-3">Preference Cookies</h3>
          <p className="mb-3">
            These cookies remember your choices and settings to provide a personalised experience.
          </p>
          <div className="space-y-2">
            <CookieRow
              name="theme_prefs"
              purpose="Remembers your display preferences such as default stake size, ladder settings, and panel layout."
              duration="1 year"
              type="Preferences"
            />
            <CookieRow
              name="cookie_consent"
              purpose="Records your cookie consent preferences."
              duration="1 year"
              type="Preferences"
            />
          </div>
        </Section>

        <Section title="3. How to Manage Cookies">
          <p>
            You can manage cookies through your browser settings. Most browsers allow you to block or
            delete cookies. However, please note that blocking essential cookies will prevent the
            Service from functioning correctly.
          </p>
          <p>To manage cookies in your browser:</p>
          <ul className="list-disc list-inside space-y-1.5 text-gray-300 ml-1">
            <li><span className="text-white font-medium">Chrome:</span> Settings &gt; Privacy and Security &gt; Cookies</li>
            <li><span className="text-white font-medium">Firefox:</span> Settings &gt; Privacy &amp; Security &gt; Cookies</li>
            <li><span className="text-white font-medium">Safari:</span> Preferences &gt; Privacy &gt; Manage Website Data</li>
            <li><span className="text-white font-medium">Edge:</span> Settings &gt; Cookies and Site Permissions</li>
          </ul>
        </Section>

        <Section title="4. Changes to This Policy">
          <p>
            We may update this Cookie Policy from time to time. Any changes will be posted on this
            page with an updated revision date. Your continued use of the Service after changes
            constitutes acceptance of the updated policy.
          </p>
        </Section>

        <Section title="5. Contact">
          <p>
            If you have questions about our use of cookies, please contact us at{" "}
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
