import { NextResponse } from "next/server";

// Server-side integration seam. The prototype currently uses a deterministic
// concept dictionary in the client; a future implementation can create/query
// embeddings here without ever exposing OPENAI_API_KEY to the browser.
export async function POST(request: Request) {
  const { query = "" } = await request.json() as { query?: string };
  return NextResponse.json({
    query: query.trim(),
    provider: process.env.OPENAI_API_KEY ? "openai-ready" : "local-concept-fallback",
    model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
  });
}
