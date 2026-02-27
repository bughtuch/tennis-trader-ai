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

    const body = new URLSearchParams({ username, password }).toString();

    const res = await fetch(
      "https://identitysso-cert.betfair.com/api/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Application": appKey,
        },
        body,
      }
    );

    const data = await res.json();

    if (data.status !== "SUCCESS" || !data.token) {
      return NextResponse.json(
        { success: false, error: data.error ?? "Authentication failed" },
        { status: 401 }
      );
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
