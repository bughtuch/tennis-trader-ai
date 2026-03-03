import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

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

    console.log(`[Betfair Auth] APP_KEY length: ${appKey.length}`);

    const body = new URLSearchParams({ username, password }).toString();

    const res = await fetch(
      "https://identitysso.betfair.com/api/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Application": appKey,
          "Accept": "application/json",
        },
        body,
      }
    );

    const contentType = res.headers.get("content-type") ?? "";

    if (!contentType.includes("json")) {
      const text = await res.text();
      console.error(`[Betfair Auth] Non-JSON response (${res.status}):`, text.slice(0, 500));
      return NextResponse.json(
        {
          success: false,
          error: `Betfair returned non-JSON response (HTTP ${res.status}). Check app key and credentials.`,
        },
        { status: 502 }
      );
    }

    const data = await res.json();

    if (data.status !== "SUCCESS" || !data.token) {
      return NextResponse.json(
        { success: false, error: data.error ?? "Authentication failed" },
        { status: 401 }
      );
    }

    // Save Betfair session to the user's Supabase profile
    try {
      const supabase = await createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({
            betfair_connected: true,
            betfair_session_token: data.token,
          })
          .eq("id", user.id);
      }
    } catch {
      // Profile update is non-critical — don't block the login
    }

    const response = NextResponse.json({
      success: true,
      sessionToken: data.token,
    });

    response.cookies.set("betfair_session", data.token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 8 * 60 * 60, // 8 hours
      path: "/",
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
