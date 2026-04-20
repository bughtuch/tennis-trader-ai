import { NextResponse } from "next/server";

export const runtime = "edge";

const APP_KEY = "fCsY8wIPysRCihHi";

export async function POST() {
  try {
    const res = await fetch("https://identitysso.betfair.com/api/login", {
      method: "POST",
      headers: {
        "X-Application": APP_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        username: "totalis",
        password: "Poppiegirl13@",
      }),
    });
    const data = await res.json();
    if (data.status !== "SUCCESS" || !data.token) {
      return NextResponse.json(
        { error: `Vendor login failed: ${data.error ?? data.status}` },
        { status: 502 }
      );
    }
    return NextResponse.json({ token: data.token });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Vendor login failed" },
      { status: 502 }
    );
  }
}
