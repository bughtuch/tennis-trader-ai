import { NextResponse } from "next/server";

export async function GET() {
  const appKey = process.env.BETFAIR_APP_KEY;
  const redirectUri = process.env.BETFAIR_REDIRECT_URI;

  if (!appKey || !redirectUri) {
    return NextResponse.json(
      { error: "OAuth not configured" },
      { status: 500 }
    );
  }

  const url = new URL("https://identitysso.betfair.com/view/vendor-login");
  url.searchParams.set("client_id", appKey);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);

  return NextResponse.json({ url: url.toString() });
}
