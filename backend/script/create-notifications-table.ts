import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function createNotificationsTable() {
  try {
    console.log("Creating system_notifications table...");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS system_notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        notification_uid VARCHAR(36) NULL,
        machine_id INT NULL,
        notification_type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message VARCHAR(500) NULL,
        old_value VARCHAR(255) NULL,
        new_value VARCHAR(255) NULL,
        mac_id VARCHAR(255) NULL,
        is_read TINYINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (machine_id) REFERENCES client_master(machine_id) ON DELETE CASCADE,
        INDEX idx_machine_id (machine_id),
        INDEX idx_is_read (is_read),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log("✓ Successfully created system_notifications table");
  } catch (error: any) {
    console.error("Error creating notifications table:", error);
    throw error;
  }
}

// Run the migration
createNotificationsTable()
  .then(() => {
    console.log("Migration completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });





