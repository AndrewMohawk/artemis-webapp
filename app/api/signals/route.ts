import signalData from "../../data/signals.json";

export async function GET() {
  return Response.json(
    {
      database: {
        id: "sigid-v74",
        name: "SigID Database",
        version: 74,
        source: "AresValley/Artemis-DB",
      },
      signals: signalData,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
