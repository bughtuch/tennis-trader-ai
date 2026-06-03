import { NextResponse } from "next/server";

export async function GET() {
  const hasPublicKey = !!process.env.NEXT_PUBLIC_REWARDFUL_API_KEY;
  const hasSecret = !!process.env.REWARDFUL_API_SECRET;

  return NextResponse.json({
    rewardful: {
      publicKeyConfigured: hasPublicKey,
      secretKeyConfigured: hasSecret,
      trackingScriptWillLoad: hasPublicKey,
    },
    instructions: {
      verifyTracking: "Open browser console -> type: window.Rewardful",
      verifyReferral:
        "Visit site via affiliate link -> console: window.Rewardful?.referral",
      verifyCookie: "Check cookies for 'rewardful_referral'",
      verifyCheckout:
        "Subscribe via affiliate link -> check Stripe session client_reference_id",
    },
  });
}
