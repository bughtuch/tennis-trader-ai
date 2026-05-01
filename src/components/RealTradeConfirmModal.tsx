"use client";

interface RealTradeConfirmModalProps {
  side: "BACK" | "LAY";
  price: number;
  stake: number;
  runner?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

export default function RealTradeConfirmModal({
  side,
  price,
  stake,
  runner,
  onConfirm,
  onCancel,
}: RealTradeConfirmModalProps) {
  const liability = side === "LAY" ? r2((price - 1) * stake) : r2(stake);
  const potentialProfit = side === "BACK" ? r2(stake * (price - 1)) : r2(stake);
  const potentialLoss = side === "BACK" ? r2(stake) : r2(stake * (price - 1));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700/50 rounded-2xl p-6 max-w-sm mx-4 space-y-4">
        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold text-white">Confirm Trade</h2>
          <p className="text-[11px] text-gray-500">Safe Mode — review before placing</p>
        </div>

        <div className="bg-gray-800/50 rounded-xl p-3 space-y-2">
          {runner && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Runner</span>
              <span className="text-white font-medium">{runner}</span>
            </div>
          )}
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
            <span className="text-gray-400">Odds</span>
            <span className="text-white font-mono font-semibold">{price.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Stake</span>
            <span className="text-white font-mono font-semibold">£{stake.toFixed(2)}</span>
          </div>
          <div className="border-t border-gray-700/50 my-1" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Liability</span>
            <span className="text-amber-400 font-mono font-semibold">£{liability.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">If wins</span>
            <span className="text-green-400 font-mono font-semibold">
              {side === "BACK" ? "+" : "-"}£{potentialProfit.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">If loses</span>
            <span className="text-red-400 font-mono font-semibold">
              {side === "BACK" ? "-" : "+"}£{potentialLoss.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-400 bg-gray-800/50 border border-gray-700/50 hover:bg-gray-800 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all ${
              side === "LAY"
                ? "bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-500 hover:to-pink-400"
                : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"
            }`}
          >
            Confirm {side}
          </button>
        </div>
      </div>
    </div>
  );
}
