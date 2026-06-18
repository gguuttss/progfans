import { NextResponse } from "next/server";
import { getSearchSuggestions } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const results = await getSearchSuggestions(q);
  return NextResponse.json(results);
}
