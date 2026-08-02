import signalData from "../../data/signals.json";
import catalog from "../../data/catalog.json";

export async function GET() {
  return Response.json(
    {
      database: {
        id: "sigid",
        name: "SigID Database",
        ...catalog,
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
