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

    const body = new URLSearchParams({ username, password }).toString();
    const url = "https://identitysso.betfair.com/api/login";

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Application": appKey,
      "Accept": "application/json",
      "Origin": "https://www.betfair.com",
    };

    console.log(`[Betfair Auth] Request URL: ${url}`);
    console.log(`[Betfair Auth] APP_KEY: ${appKey.slice(0, 4)}... (length: ${appKey.length})`);
    console.log(`[Betfair Auth] Headers:`, JSON.stringify({ ...headers, "X-Application": `${appKey.slice(0, 4)}...` }));
    console.log(`[Betfair Auth] Body: username=${username}&password=***`);

    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
    });

    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => { responseHeaders[k] = v; });

    const responseText = await res.text();

    console.log(`[Betfair Auth] Response status: ${res.status}`);
    console.log(`[Betfair Auth] Response headers:`, JSON.stringify(responseHeaders));
    console.log(`[Betfair Auth] Response body (first 500):`, responseText.slice(0, 500));

    // Try parsing as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: `Betfair returned non-JSON (HTTP ${res.status}). Check Vercel logs for details.`,
        },
        { status: 502 }
      );
    }

    if (data.status !== "SUCCESS" || !data.token) {
      return NextResponse.json(
        { success: false, error: data.error ?? `Authentication failed (${data.status})` },
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
