const SOURCE_URL = "https://www.aresvalley.com/poseidon_engine/data.json";

export async function GET() {
  try {
    const response = await fetch(SOURCE_URL, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return Response.json({ error: "Upstream report unavailable" }, { status: 502 });
    }
    const report = await response.json();
    return Response.json(report, {
      headers: {
        "Cache-Control": "public, max-age=180, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch {
    return Response.json({ error: "Space weather report unavailable" }, { status: 502 });
  }
}
