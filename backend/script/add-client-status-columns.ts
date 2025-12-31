import { db } from "../server/db";
import { sql } from "drizzle-orm";

/**
 * Migration script to add client_status and client_status_updated_at columns to client_master table
 * Note: client_status column may already exist, so we check before adding
 */
async function addClientStatusColumns() {
  try {
    console.log("🚀 Starting migration to add client_status columns...\n");

    // Check if client_status column exists
    const checkClientStatus = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'client_master'
      AND COLUMN_NAME = 'client_status'
    `);
    
    const clientStatusExists = (checkClientStatus as any[])[0]?.count > 0;

    if (!clientStatusExists) {
      console.log("📋 Adding client_status column...");
      await db.execute(sql`
        ALTER TABLE client_master
        ADD COLUMN client_status TINYINT DEFAULT 0 COMMENT '0 = normal, 1 = offline (temporary flag)'
        AFTER time_offset
      `);
      console.log("   ✓ client_status column added");
    } else {
      console.log("   ✓ client_status column already exists");
    }

    // Check if client_status_updated_at column exists
    const checkClientStatusUpdatedAt = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'client_master'
      AND COLUMN_NAME = 'client_status_updated_at'
    `);
    
    const clientStatusUpdatedAtExists = (checkClientStatusUpdatedAt as any[])[0]?.count > 0;

    if (!clientStatusUpdatedAtExists) {
      console.log("📋 Adding client_status_updated_at column...");
      await db.execute(sql`
        ALTER TABLE client_master
        ADD COLUMN client_status_updated_at DATETIME NULL COMMENT 'Timestamp when client_status was set to 1'
        AFTER client_status
      `);
      console.log("   ✓ client_status_updated_at column added");
    } else {
      console.log("   ✓ client_status_updated_at column already exists");
    }

    console.log("\n✅ Migration completed successfully!");
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

addClientStatusColumns();



