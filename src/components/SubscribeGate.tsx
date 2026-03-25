"use client";

import Link from "next/link";
import { useAppStore } from "@/lib/store";

interface SubscribeGateProps {
  feature: string;
  description?: string;
  children: React.ReactNode;
}

export default function SubscribeGate({ feature, description, children }: SubscribeGateProps) {
  const { subscriptionStatus, subscriptionLoaded } = useAppStore();

  if (!subscriptionLoaded) {
    return (
      <div className="rounded-2xl bg-gray-900/50 border border-gray-800/50 p-6 animate-pulse">
        <div className="h-4 bg-gray-800 rounded w-1/3 mb-3" />
        <div className="h-3 bg-gray-800 rounded w-2/3" />
      </div>
    );
  }

  if (subscriptionStatus === "active") {
    return <>{children}</>;
  }

  return (
    <div className="rounded-2xl bg-gray-900/50 border border-gray-800/50 p-6 text-center space-y-3">
      <div className="w-10 h-10 mx-auto rounded-full bg-gray-800 flex items-center justify-center">
        <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-white">
        Subscribe to unlock {feature}
      </p>
      {description && (
        <p className="text-xs text-gray-500">{description}</p>
      )}
      <Link
        href="/settings?subscribe=true"
        className="inline-block px-5 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-all"
      >
        Subscribe — £37/month
      </Link>
    </div>
  );
}
