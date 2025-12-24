import { defineConfig } from "drizzle-kit";
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
  throw new Error("DATABASE_URL not set, ensure the database is provisioned");
}

// Parse DATABASE_URL and extract SSL config
const dbUrl = process.env.DATABASE_URL;
const url = new URL(dbUrl.replace(/^mysql:\/\//, "http://"));

export default defineConfig({
  out: "./backend/migrations",
  schema: "./backend/shared/schema.ts",
  dialect: "mysql",
  dbCredentials: {
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    ssl: {
      rejectUnauthorized: true
    }
  },
});
