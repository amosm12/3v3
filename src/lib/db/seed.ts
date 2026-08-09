import { config } from "dotenv";
import { sql } from "drizzle-orm";

// Import statements are hoisted, so "./index" (which reads DATABASE_URL at
// module load) must be loaded dynamically, after dotenv populates env vars.
config({ path: ".env.local" });

async function seed() {
  const { db } = await import("./index");
  const { tournament, courts } = await import("./schema");

  const [{ count: tournamentCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tournament);

  if (tournamentCount === 0) {
    await db.insert(tournament).values({
      name: "Bethlehem SDA 3v3",
      status: "setup",
    });
    console.log("Inserted Tournament row.");
  } else {
    console.log("Tournament row already exists, skipping.");
  }

  const [{ count: courtCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(courts);

  if (courtCount === 0) {
    await db.insert(courts).values(
      Array.from({ length: 5 }, (_, i) => ({ label: `Court ${i + 1}` })),
    );
    console.log("Inserted 5 Court rows.");
  } else {
    console.log("Court rows already exist, skipping.");
  }

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
