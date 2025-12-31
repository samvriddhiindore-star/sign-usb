import mysql from "mysql2/promise";
import * as fs from "fs";
import * as path from "path";

// Load .env manually
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    const envContent = fs.readFileSync(envPath, "utf-8");
    const lines = envContent.split("\n");
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      
      const key = trimmed.substring(0, eqIndex).trim();
      let value = trimmed.substring(eqIndex + 1).trim();
      
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      value = value.replace(/\\"/g, '"');
      
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch (err) {
    console.error("Failed to load .env file:", err);
  }
}

loadEnv();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

async function addGuidColumns() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  
  try {
    console.log("Adding GUID columns to all tables...\n");
    
    const queries = [
      "ALTER TABLE `client_master` ADD COLUMN `machine_uid` VARCHAR(36) NULL AFTER `machine_id`",
      "ALTER TABLE `client_usb_status` ADD COLUMN `log_uid` VARCHAR(36) NULL AFTER `id`",
      "ALTER TABLE `device_master` ADD COLUMN `device_uid` VARCHAR(36) NULL AFTER `id`",
      "ALTER TABLE `url_master` ADD COLUMN `url_uid` VARCHAR(36) NULL AFTER `id`"
    ];
    
    for (const query of queries) {
      try {
        await connection.execute(query);
        console.log(`✅ ${query.split('`')[1]} - Column added successfully`);
      } catch (error: any) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`⚠️  ${query.split('`')[1]} - Column already exists, skipping`);
        } else {
          throw error;
        }
      }
    }
    
    console.log("\n✅ All GUID columns added successfully!");
    
  } catch (error: any) {
    console.error("❌ Error adding GUID columns:", error.message);
    throw error;
  } finally {
    await connection.end();
    process.exit(0);
  }
}

addGuidColumns();







