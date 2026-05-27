import { NextResponse } from "next/server";
import { getAllFlowers } from "@/lib/flowers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const flowers = await getAllFlowers();
  return NextResponse.json(flowers);
}
