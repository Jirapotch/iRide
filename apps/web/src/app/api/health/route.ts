export async function GET() {
  return Response.json(
    {
      status: "ok",
      service: "iride-personal-garage-v1",
      databaseConfigured: Boolean(
        process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
      ),
      driveConfigured: Boolean(
        process.env.GOOGLE_DRIVE_REFRESH_TOKEN &&
        process.env.GOOGLE_DRIVE_CLIENT_ID &&
        process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      ),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
