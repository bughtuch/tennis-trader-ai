import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  const appKey = "fCsY8wIPysRCihHi";
  const username = "totalis";
  const password = "Poppiegirl13@";

  try {
    const res = await fetch("https://identitysso.betfair.com/api/login", {
      method: "POST",
      headers: {
        "X-Application": appKey,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: new URLSearchParams({ username, password }).toString(),
      redirect: "follow",
    });

    const text = await res.text();
    console.log("[Vendor Login] Status:", res.status, "Body:", text.substring(0, 200));

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json({ success: false, error: "Non-JSON response", raw: text.substring(0, 500) }, { status: 502 });
    }

    if (data.status === "SUCCESS" && data.token) {
      return NextResponse.json({ success: true, token: data.token });
    }

    return NextResponse.json({ success: false, error: data.error || "Login failed", raw: text.substring(0, 500) }, { status: 401 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Network error" }, { status: 502 });
  }
}
