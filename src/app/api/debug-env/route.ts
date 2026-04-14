import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hasVendorSession: !!process.env.BETFAIR_VENDOR_SESSION,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV || null,
  });
}
