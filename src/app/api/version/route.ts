import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  return NextResponse.json({
    currentVersion: "1.0.0",
    earliestVersion: "1.0.0",
    latestVersion: "1.0.0",
    disabledVersions: [],
    updateUrl: "https://tennistraderai.com",
    status: "active",
  });
}
