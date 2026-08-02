import catalog from "../../data/catalog.json";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      status: "ok",
      service: "artemis-rf-reference",
      catalogVersion: catalog.version,
      catalogTag: catalog.tag,
      catalogCommit: catalog.sourceCommit,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
