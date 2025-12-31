import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function addTimeOffsetColumn() {
  try {
    console.log("Adding time_offset column to client_master table...");

    // Check if column already exists
    const [columns] = await db.execute(sql`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'client_master' 
      AND COLUMN_NAME = 'time_offset'
    `);

    if ((columns as any[]).length > 0) {
      console.log("✓ time_offset column already exists");
      return;
    }

    // Add the time_offset column
    await db.execute(sql`
      ALTER TABLE client_master
      ADD COLUMN time_offset INT NULL
      COMMENT 'Time offset in milliseconds: server_time - client_time'
    `);

    console.log("✓ Successfully added time_offset column");
  } catch (error: any) {
    console.error("Error adding time_offset column:", error);
    throw error;
  }
}

// Run the migration
addTimeOffsetColumn()
  .then(() => {
    console.log("Migration completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });





