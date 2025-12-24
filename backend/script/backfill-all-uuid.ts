import { randomUUID } from "crypto";
import { db } from "../server/db";
import { 
  clientMaster, 
  clientUsbStatus, 
  deviceMaster, 
  urlMaster 
} from "../shared/schema";
import { eq, sql } from "drizzle-orm";

async function backfillAllUuids() {
  try {
    console.log("🚀 Starting UUID backfill for all tables...\n");
    
    let totalUpdated = 0;
    
    // ==================== CLIENT_MASTER ====================
    console.log("📋 Processing client_master table...");
    const systemsWithoutUuid = await db
      .select()
      .from(clientMaster)
      .where(
        sql`${clientMaster.machineUid} IS NULL OR ${clientMaster.machineUid} = ''`
      );
    
    console.log(`   Found ${systemsWithoutUuid.length} systems without UUID`);
    
    for (const system of systemsWithoutUuid) {
      const uuid = randomUUID();
      await db
        .update(clientMaster)
        .set({ machineUid: uuid })
        .where(eq(clientMaster.machineId, system.machineId));
      
      totalUpdated++;
      console.log(`   ✓ Updated system ${system.machineId} (${system.pcName}) with UUID: ${uuid}`);
    }
    
    // ==================== CLIENT_USB_STATUS ====================
    console.log("\n📋 Processing client_usb_status table...");
    const logsWithoutUuid = await db
      .select()
      .from(clientUsbStatus)
      .where(
        sql`${clientUsbStatus.logUid} IS NULL OR ${clientUsbStatus.logUid} = ''`
      );
    
    console.log(`   Found ${logsWithoutUuid.length} USB logs without UUID`);
    
    for (const log of logsWithoutUuid) {
      const uuid = randomUUID();
      await db
        .update(clientUsbStatus)
        .set({ logUid: uuid })
        .where(eq(clientUsbStatus.id, log.id));
      
      totalUpdated++;
      if (totalUpdated % 10 === 0) {
        console.log(`   ✓ Updated ${totalUpdated} records so far...`);
      }
    }
    
    if (logsWithoutUuid.length > 0) {
      console.log(`   ✓ Updated ${logsWithoutUuid.length} USB log records`);
    }
    
    // ==================== DEVICE_MASTER ====================
    console.log("\n📋 Processing device_master table...");
    // Select only the columns we need to avoid schema mismatch issues
    const devicesWithoutUuid = await db
      .select({
        id: deviceMaster.id,
        deviceUid: deviceMaster.deviceUid,
        deviceName: deviceMaster.deviceName
      })
      .from(deviceMaster)
      .where(
        sql`${deviceMaster.deviceUid} IS NULL OR ${deviceMaster.deviceUid} = ''`
      );
    
    console.log(`   Found ${devicesWithoutUuid.length} devices without UUID`);
    
    for (const device of devicesWithoutUuid) {
      const uuid = randomUUID();
      await db
        .update(deviceMaster)
        .set({ deviceUid: uuid })
        .where(eq(deviceMaster.id, device.id));
      
      totalUpdated++;
      console.log(`   ✓ Updated device ${device.id} (${device.deviceName || 'N/A'}) with UUID: ${uuid}`);
    }
    
    // ==================== URL_MASTER ====================
    console.log("\n📋 Processing url_master table...");
    const urlsWithoutUuid = await db
      .select()
      .from(urlMaster)
      .where(
        sql`${urlMaster.urlUid} IS NULL OR ${urlMaster.urlUid} = ''`
      );
    
    console.log(`   Found ${urlsWithoutUuid.length} URLs without UUID`);
    
    for (const url of urlsWithoutUuid) {
      const uuid = randomUUID();
      await db
        .update(urlMaster)
        .set({ urlUid: uuid })
        .where(eq(urlMaster.id, url.id));
      
      totalUpdated++;
      console.log(`   ✓ Updated URL ${url.id} (${url.url.substring(0, 50)}...) with UUID: ${uuid}`);
    }
    
    // ==================== VERIFICATION ====================
    console.log("\n🔍 Verifying all records have UUIDs...");
    
    const remainingSystems = await db
      .select()
      .from(clientMaster)
      .where(
        sql`${clientMaster.machineUid} IS NULL OR ${clientMaster.machineUid} = ''`
      );
    
    const remainingLogs = await db
      .select()
      .from(clientUsbStatus)
      .where(
        sql`${clientUsbStatus.logUid} IS NULL OR ${clientUsbStatus.logUid} = ''`
      );
    
    const remainingDevices = await db
      .select({
        id: deviceMaster.id,
        deviceUid: deviceMaster.deviceUid
      })
      .from(deviceMaster)
      .where(
        sql`${deviceMaster.deviceUid} IS NULL OR ${deviceMaster.deviceUid} = ''`
      );
    
    const remainingUrls = await db
      .select()
      .from(urlMaster)
      .where(
        sql`${urlMaster.urlUid} IS NULL OR ${urlMaster.urlUid} = ''`
      );
    
    const totalRemaining = remainingSystems.length + remainingLogs.length + remainingDevices.length + remainingUrls.length;
    
    console.log("\n" + "=".repeat(60));
    console.log("📊 SUMMARY");
    console.log("=".repeat(60));
    console.log(`✅ Total records updated: ${totalUpdated}`);
    console.log(`   - Systems: ${systemsWithoutUuid.length}`);
    console.log(`   - USB Logs: ${logsWithoutUuid.length}`);
    console.log(`   - Devices: ${devicesWithoutUuid.length}`);
    console.log(`   - URLs: ${urlsWithoutUuid.length}`);
    console.log("\n🔍 Verification:");
    console.log(`   - Systems without UUID: ${remainingSystems.length}`);
    console.log(`   - USB Logs without UUID: ${remainingLogs.length}`);
    console.log(`   - Devices without UUID: ${remainingDevices.length}`);
    console.log(`   - URLs without UUID: ${remainingUrls.length}`);
    
    if (totalRemaining === 0) {
      console.log("\n✅ SUCCESS: All records now have UUIDs!");
    } else {
      console.log(`\n⚠️  WARNING: ${totalRemaining} records still missing UUIDs`);
    }
    console.log("=".repeat(60));
    
  } catch (error: any) {
    console.error("\n❌ Error during UUID backfill:", error);
    console.error("Stack trace:", error.stack);
    throw error;
  } finally {
    process.exit(0);
  }
}

// Run the migration
backfillAllUuids();

