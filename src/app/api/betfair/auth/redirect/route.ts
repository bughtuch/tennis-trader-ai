import { NextResponse } from "next/server";

export async function GET() {
  const redirectUri = encodeURIComponent("https://tennistraderai.com/api/betfair/callback?");
  const url = `https://identitysso.betfair.com/view/vendor-login?client_id=157798&response_type=code&redirect_uri=${redirectUri}`;

  return NextResponse.redirect(url);
}
