import { randomUUID } from "crypto";
import { db } from "../server/db";
import { profileMaster } from "../shared/schema";
import { eq, isNull, sql } from "drizzle-orm";

async function backfillProfileUuids() {
  try {
    console.log("Starting profile UUID backfill...");
    
    // Find all profiles without a profileUid
    const profilesWithoutUuid = await db
      .select()
      .from(profileMaster)
      .where(
        sql`${profileMaster.profileUid} IS NULL OR ${profileMaster.profileUid} = ''`
      );
    
    console.log(`Found ${profilesWithoutUuid.length} profiles without UUID`);
    
    if (profilesWithoutUuid.length === 0) {
      console.log("No profiles need UUID backfill. All done!");
      return;
    }
    
    // Generate and update UUIDs
    let updated = 0;
    for (const profile of profilesWithoutUuid) {
      const uuid = randomUUID();
      
      await db
        .update(profileMaster)
        .set({ profileUid: uuid })
        .where(eq(profileMaster.profileId, profile.profileId));
      
      updated++;
      console.log(`✓ Updated profile ${profile.profileId} (${profile.profileName}) with UUID: ${uuid}`);
    }
    
    console.log(`\n✅ Successfully backfilled UUIDs for ${updated} profiles!`);
    
    // Verify the update
    const remaining = await db
      .select()
      .from(profileMaster)
      .where(
        sql`${profileMaster.profileUid} IS NULL OR ${profileMaster.profileUid} = ''`
      );
    
    if (remaining.length === 0) {
      console.log("✅ Verification: All profiles now have UUIDs!");
    } else {
      console.log(`⚠️  Warning: ${remaining.length} profiles still missing UUIDs`);
    }
    
  } catch (error: any) {
    console.error("❌ Error during UUID backfill:", error);
    throw error;
  } finally {
    process.exit(0);
  }
}

// Run the migration
backfillProfileUuids();




