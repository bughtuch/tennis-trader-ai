import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";

  const html = `<!DOCTYPE html>
<html>
<head><title>Connecting...</title></head>
<body>
<p>Saving Betfair session...</p>
<script>
  try {
    var token = ${JSON.stringify(token)};
    if (token) {
      localStorage.setItem('betfair_token', token);
      localStorage.setItem('betfair_connected_at', new Date().toISOString());
      localStorage.setItem('betfair_username', 'Connected via OAuth');
    }
  } catch(e) {}
  window.location.href = '/settings?betfair=connected';
</script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}
