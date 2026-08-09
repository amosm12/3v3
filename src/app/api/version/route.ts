import { NextResponse } from "next/server";

// Evaluated once per cold start of this serverless function instance — i.e.
// stable across requests within one deployment, and different after the
// next deploy (new code -> fresh module evaluation). Used purely as a
// cheap fingerprint for the "new version available" client-side check;
// doesn't need to be a real build id.
const BUILD_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export async function GET() {
  return NextResponse.json({ buildId: BUILD_ID });
}
