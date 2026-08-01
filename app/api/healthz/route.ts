export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      status: "ok",
      service: "artemis-rf-reference",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
