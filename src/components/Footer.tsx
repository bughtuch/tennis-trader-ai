import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-gray-800/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
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
            <p className="text-sm text-gray-500 mb-1">
              A Bug Hutch Ltd product.
            </p>
            <p className="text-sm text-gray-500">
              Powered by <span className="text-gray-400 font-medium">TOWN</span>.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-[10px] tracking-[0.2em] uppercase text-gray-500 font-medium mb-4">
              Product
            </h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <Link href="/trading" className="hover:text-white transition-colors">
                  Trading Ladder
                </Link>
              </li>
              <li>
                <Link href="/markets" className="hover:text-white transition-colors">
                  Markets
                </Link>
              </li>
              <li>
                <Link href="/trading" className="hover:text-white transition-colors">
                  AI Signals
                </Link>
              </li>
              <li>
                <Link href="/trading" className="hover:text-white transition-colors">
                  AI Guardian
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-[10px] tracking-[0.2em] uppercase text-gray-500 font-medium mb-4">
              Company
            </h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/risk" className="hover:text-white transition-colors">
                  Risk Disclosure
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-[10px] tracking-[0.2em] uppercase text-gray-500 font-medium mb-4">
              Legal
            </h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="hover:text-white transition-colors">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800/50 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-600">
            &copy; 2026 Bug Hutch Ltd. All rights reserved.
          </p>
          <p className="text-xs text-gray-700">
            Trading involves risk. Past performance is not indicative of future results.
          </p>
        </div>
      </div>
    </footer>
  );
}
