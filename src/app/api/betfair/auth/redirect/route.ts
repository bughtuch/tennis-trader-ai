import { NextResponse } from "next/server";

export async function GET() {
  console.log('BETFAIR_APP_KEY exists:', !!process.env.BETFAIR_APP_KEY);
  console.log('BETFAIR_REDIRECT_URI exists:', !!process.env.BETFAIR_REDIRECT_URI);
  console.log('All env keys:', Object.keys(process.env).filter(k => k.includes('BETFAIR')));

  const appKey = process.env.BETFAIR_APP_KEY;
  const redirectUri = process.env.BETFAIR_REDIRECT_URI;

  if (!appKey || !redirectUri) {
    return new NextResponse(
      "<html><body style='background:#030712;color:#f87171;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0'>" +
        "<div style='text-align:center'><h1>Betfair OAuth not configured</h1><p>Server environment variables are missing.</p>" +
        "<a href='/settings' style='color:#60a5fa'>Back to Settings</a></div></body></html>",
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }

  const url = new URL("https://identitysso.betfair.com/view/vendor-login");
  url.searchParams.set("client_id", appKey);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);

  return NextResponse.redirect(url.toString());
}
