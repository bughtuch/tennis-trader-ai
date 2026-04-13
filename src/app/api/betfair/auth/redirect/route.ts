import { NextResponse } from "next/server";

export async function GET() {
  const url = "https://identitysso.betfair.com/view/vendor-login?client_id=fCsY8wIPysRCihHi&response_type=code&redirect_uri=https://tennistraderai.com/api/betfair/callback?";

  return NextResponse.redirect(url);
}
