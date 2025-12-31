import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function addLastUpdatedColumn() {
    try {
        console.log("Adding last_updated column to client_master table...");

        // Check if column already exists
        const checkResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'client_master' 
      AND COLUMN_NAME = 'last_updated'
    `);

        const exists = Array.isArray(checkResult) && Array.isArray(checkResult[0])
            ? (checkResult[0] as any[])[0]?.count > 0
            : (checkResult as any[])[0]?.count > 0;

        if (exists) {
            console.log("✓ last_updated column already exists");
        } else {
            // Add the last_updated column with ON UPDATE CURRENT_TIMESTAMP
            await db.execute(sql`
        ALTER TABLE client_master
        ADD COLUMN last_updated DATETIME 
        DEFAULT CURRENT_TIMESTAMP 
        ON UPDATE CURRENT_TIMESTAMP
        AFTER client_status_updated_at
      `);

            console.log("✓ Successfully added last_updated column");

            // Initialize last_updated with current timestamp for existing rows
            await db.execute(sql`
        UPDATE client_master 
        SET last_updated = NOW() 
        WHERE last_updated IS NULL
      `);

            console.log("✓ Initialized last_updated for existing rows");
        }

        process.exit(0);
    } catch (error) {
        console.error("Error adding last_updated column:", error);
        process.exit(1);
    }
}

addLastUpdatedColumn();
