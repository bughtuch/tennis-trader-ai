import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  return NextResponse.redirect(
    "https://www.betfair.com/aboutUs/Betfair.Charges/"
  );
}
