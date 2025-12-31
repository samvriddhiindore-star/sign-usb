
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrate() {
    console.log("Running migration: Adding client_status_updated_at to client_master...");
    try {
        await db.execute(sql`
            ALTER TABLE client_master 
            ADD COLUMN client_status_updated_at DATETIME NULL;
        `);
        console.log("Migration successful: Column added.");
    } catch (error: any) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log("Migration skipped: Column already exists.");
        } else {
            console.error("Migration failed:", error);
            process.exit(1);
        }
    }
    process.exit(0);
}

migrate().catch(console.error);
