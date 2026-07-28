import { createAutomaticBackup } from "../../lib/automatic-backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await createAutomaticBackup({ forceHistory: true });

    return Response.json({
      generatedAt: result.generatedAt,
      historyCreated: result.historyCreated,
      message: "Backup je uspešno napravljen.",
    });
  } catch (error) {
    console.error("Ručno kreiranje backupa nije uspelo:", error);

    return Response.json(
      {
        message: "Backup nije mogao da bude napravljen.",
      },
      { status: 500 },
    );
  }
}
