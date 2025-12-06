import { storage } from "./storage";
import { hashPassword } from "./auth";

async function seed() {
  console.log("🌱 Seeding database...");
  
  try {
    const existingAdmin = await storage.getAdminByEmail("admin@company.com");
    
    if (!existingAdmin) {
      const passwordHash = await hashPassword("admin123");
      const admin = await storage.createAdmin({
        name: "System Administrator",
        email: "admin@company.com",
        passwordHash,
        role: "admin"
      });
      
      console.log("✅ Created default admin user:");
      console.log("   Email: admin@company.com");
      console.log("   Password: admin123");
      console.log("   ID:", admin.id);
    } else {
      console.log("ℹ️  Default admin already exists");
    }
    
    console.log("✅ Seed completed successfully");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    throw error;
  }
}

seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
