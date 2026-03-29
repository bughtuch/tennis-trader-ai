"use client";

interface RealTradeConfirmModalProps {
  side: "BACK" | "LAY";
  price: number;
  stake: number;
  onConfirm: (dontAskAgain: boolean) => void;
  onCancel: () => void;
}

export default function RealTradeConfirmModal({
  side,
  price,
  stake,
  onConfirm,
  onCancel,
}: RealTradeConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-amber-500/30 rounded-2xl p-6 max-w-sm mx-4 space-y-4">
        <div className="text-center space-y-2">
          <div className="text-3xl">⚠️</div>
          <h2 className="text-lg font-bold text-white">Real Trade Confirmation</h2>
          <p className="text-sm text-amber-400/90">
            This places a REAL trade with real money on Betfair Exchange.
          </p>
        </div>

        <div className="bg-gray-800/50 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Side</span>
            <span
              className={`px-2 py-0.5 rounded text-xs font-semibold ${
                side === "BACK"
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-pink-500/20 text-pink-400"
              }`}
            >
              {side}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Price</span>
            <span className="text-white font-mono font-semibold">{price.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Stake</span>
            <span className="text-white font-mono font-semibold">£{stake.toFixed(0)}</span>
          </div>
          {side === "LAY" && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Liability</span>
              <span className="text-red-400 font-mono font-semibold">
                £{(stake * (price - 1)).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-400 bg-gray-800/50 border border-gray-700/50 hover:bg-gray-800 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(false)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all ${
              side === "LAY"
                ? "bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-500 hover:to-pink-400"
                : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"
            }`}
          >
            Confirm {side}
          </button>
        </div>

        <button
          onClick={() => onConfirm(true)}
          className="w-full text-[11px] text-gray-500 hover:text-gray-300 transition-colors py-1"
        >
          Confirm &amp; don&apos;t ask again
        </button>
      </div>
    </div>
  );
}
