import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Username and password are required" },
        { status: 400 }
      );
    }

    const appKey = process.env.BETFAIR_APP_KEY;
    if (!appKey) {
      return NextResponse.json(
        { success: false, error: "BETFAIR_APP_KEY is not configured" },
        { status: 500 }
      );
    }

    // Call Betfair login API
    const loginRes = await fetch("https://identitysso.betfair.com/api/login", {
      method: "POST",
      headers: {
        "X-Application": appKey,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: new URLSearchParams({ username, password }),
    });

    const loginData = await loginRes.json();

    if (loginData.status !== "SUCCESS" || !loginData.token) {
      return NextResponse.json(
        { success: false, error: loginData.error ?? "Login failed — check your credentials" },
        { status: 401 }
      );
    }

    const sessionToken = loginData.token;

    // Save to Supabase profile
    try {
      const { createServerClient } = await import("@/lib/supabase-server");
      const supabase = await createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({
            betfair_connected: true,
            betfair_session_token: sessionToken,
            betfair_connected_at: new Date().toISOString(),
            betfair_username: username,
          })
          .eq("id", user.id);
      }
    } catch {
      // Non-critical — token is still valid
    }

    // Set session cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set("betfair_session", sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60, // 8 hours
    });

    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
