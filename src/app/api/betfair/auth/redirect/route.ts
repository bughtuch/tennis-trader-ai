import { NextResponse } from "next/server";

export async function GET() {
  const appKey = "fCsY8wIPysRCih";
  const redirectUri = "https://tennistraderai.com/api/betfair/callback?";

  const url = new URL("https://identitysso.betfair.com/view/vendor-login");
  url.searchParams.set("client_id", appKey);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);

  return NextResponse.redirect(url.toString());
}
