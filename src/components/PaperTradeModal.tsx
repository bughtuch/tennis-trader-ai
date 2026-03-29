"use client";

interface PaperTradeModalProps {
  side: "BACK" | "LAY";
  price: number;
  stake: number;
  playerName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function PaperTradeModal({
  side,
  price,
  stake,
  playerName,
  onConfirm,
  onCancel,
}: PaperTradeModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-purple-500/30 rounded-2xl p-6 max-w-sm mx-4 space-y-4">
        <div className="text-center space-y-2">
          <div className="text-3xl">👻</div>
          <h2 className="text-lg font-bold text-white">Paper Trade</h2>
          <p className="text-sm text-gray-400">
            Practice with real odds — no real money moves.
          </p>
        </div>

        <div className="bg-gray-800/50 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Player</span>
            <span className="text-white font-medium">{playerName}</span>
          </div>
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
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 transition-all"
          >
            Place Paper Trade
          </button>
        </div>

        <p className="text-[10px] text-gray-600 text-center">
          Paper trades track P&amp;L with real price movements
        </p>
      </div>
    </div>
  );
}
