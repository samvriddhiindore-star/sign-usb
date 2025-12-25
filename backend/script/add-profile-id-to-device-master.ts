/**
 * Migration script to add profileId column to device_master table
 * This enforces one device can only be assigned to one profile at a time
 * 
 * Run with: npx tsx backend/script/add-profile-id-to-device-master.ts
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function addProfileIdToDeviceMaster() {
  try {
    console.log("Adding profile_id column to device_master table...");
    
    // Step 1: Add profile_id column first
    await db.execute(sql`
      ALTER TABLE device_master 
      ADD COLUMN profile_id INT NULL
    `);
    
    console.log("✓ Successfully added profile_id column");
    
    // Step 2: Add foreign key constraint
    await db.execute(sql`
      ALTER TABLE device_master 
      ADD CONSTRAINT fk_device_master_profile 
        FOREIGN KEY (profile_id) 
        REFERENCES profile_master(profile_id) 
        ON DELETE SET NULL
    `);
    
    console.log("✓ Foreign key constraint created");
    console.log("✓ Migration completed successfully");
    
    process.exit(0);
  } catch (error: any) {
    if (error.message?.includes("Duplicate column name") || error.sqlMessage?.includes("Duplicate column name")) {
      console.log("✓ Column profile_id already exists, skipping...");
      process.exit(0);
    } else if (error.message?.includes("Duplicate key name") || error.sqlMessage?.includes("Duplicate key name")) {
      console.log("✓ Foreign key constraint already exists, skipping...");
      process.exit(0);
    } else {
      console.error("Error adding profile_id column:", error.message || error);
      console.error("SQL Error:", error.sqlMessage || "N/A");
      process.exit(1);
    }
  }
}

addProfileIdToDeviceMaster();

