import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { username, password } = body;

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

    const formBody = new URLSearchParams({ username, password }).toString();

    let res: Response;
    try {
      res = await fetch("https://identitysso.betfair.com/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Application": appKey,
          "Accept": "application/json",
        },
        body: formBody,
      });
    } catch (fetchErr) {
      return NextResponse.json(
        {
          success: false,
          error: `Network error contacting Betfair: ${fetchErr instanceof Error ? fetchErr.message : "unknown"}`,
        },
        { status: 502 }
      );
    }

    const responseText = await res.text();

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: `Betfair returned non-JSON (HTTP ${res.status})`,
        },
        { status: 502 }
      );
    }

    if (data.status !== "SUCCESS" || !data.token) {
      return NextResponse.json(
        {
          success: false,
          error: data.error ?? `Authentication failed (${data.status})`,
        },
        { status: 401 }
      );
    }

    // Save Betfair session to the user's Supabase profile (non-critical)
    try {
      const { createServerClient } = await import("@/lib/supabase-server");
      const supabase = await createServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({
            betfair_connected: true,
            betfair_session_token: data.token,
          })
          .eq("id", user.id);
      }
    } catch (dbErr) {
      console.error(`[Betfair Auth] Profile update failed:`, dbErr);
    }

    const response = NextResponse.json({
      success: true,
      sessionToken: data.token,
    });

    response.cookies.set("betfair_session", data.token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 8 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error(`[Betfair Auth] Unhandled error:`, error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
