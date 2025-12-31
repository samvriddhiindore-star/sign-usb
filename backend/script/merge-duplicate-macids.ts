import * as dotenv from "dotenv";
dotenv.config();

import { storage } from "../server/storage";

/**
 * Script to merge duplicate MAC IDs in the database
 * This will find all duplicate MAC IDs and merge them automatically
 */
async function mergeDuplicateMacIds() {
  try {
    console.log("🚀 Starting duplicate MAC ID merge process...\n");

    // Get all duplicate MAC IDs
    console.log("📋 Checking for duplicate MAC IDs...");
    const duplicates = await storage.getDuplicateMacIds();
    
    if (duplicates.length === 0) {
      console.log("✅ No duplicate MAC IDs found in the database!");
      return;
    }

    console.log(`\n📊 Found ${duplicates.length} duplicate MAC ID group(s)\n`);

    // Show summary before merging
    console.log("=".repeat(80));
    console.log("DUPLICATE MAC ID SUMMARY:");
    console.log("=".repeat(80));
    duplicates.forEach((dup, index) => {
      console.log(`\n${index + 1}. MAC ID: "${dup.macId}"`);
      console.log(`   Count: ${dup.count} systems`);
      console.log(`   Systems:`);
      dup.systems.forEach((system, idx) => {
        console.log(`     ${idx + 1}. ID: ${system.machineId} | Name: "${system.pcName}" | Last Connected: ${system.lastConnected ? system.lastConnected.toISOString() : 'Never'}`);
      });
    });
    console.log("\n" + "=".repeat(80));

    // Ask for confirmation (in a real scenario, you might want to add a prompt)
    console.log("\n⚠️  This will merge duplicate systems. The merge will:");
    console.log("   - Keep the system with the most recent lastConnected timestamp");
    console.log("   - Transfer all devices, USB logs, and notifications to the kept system");
    console.log("   - Delete the duplicate systems");
    console.log("   - Create notifications about the merge\n");

    // Process each duplicate group
    let totalMerged = 0;
    let totalGroups = 0;

    for (const duplicate of duplicates) {
      try {
        const normalizedMacId = duplicate.macId.trim().toUpperCase();
        const systems = duplicate.systems;
        
        if (systems.length < 2) {
          console.log(`⏭️  Skipping MAC ID "${normalizedMacId}" - only 1 system (not a duplicate)`);
          continue;
        }

        totalGroups++;
        console.log(`\n🔄 Processing MAC ID: "${normalizedMacId}" (${systems.length} systems)`);

        // Determine which system to keep:
        // 1. Prefer system with most recent lastConnected
        // 2. If no lastConnected, prefer system with systemUserId assigned
        // 3. Otherwise, keep the one with the lowest machineId (oldest)
        let keepSystem = systems[0];
        let keepIndex = 0;
        
        for (let i = 0; i < systems.length; i++) {
          const system = systems[i];
          const keepLastConnected = keepSystem.lastConnected?.getTime() || 0;
          const systemLastConnected = system.lastConnected?.getTime() || 0;
          
          // Prefer system with more recent lastConnected
          if (systemLastConnected > keepLastConnected) {
            keepSystem = system;
            keepIndex = i;
          } else if (systemLastConnected === keepLastConnected) {
            // If same lastConnected, prefer system with systemUserId
            if (system.systemUserId && !keepSystem.systemUserId) {
              keepSystem = system;
              keepIndex = i;
            } else if (system.systemUserId && keepSystem.systemUserId) {
              // If both have systemUserId, prefer lower machineId (older)
              if (system.machineId < keepSystem.machineId) {
                keepSystem = system;
                keepIndex = i;
              }
            } else {
              // If neither has systemUserId, prefer lower machineId (older)
              if (system.machineId < keepSystem.machineId) {
                keepSystem = system;
                keepIndex = i;
              }
            }
          }
        }
        
        // Get systems to merge (all except the one to keep)
        const mergeSystems = systems.filter((_, index) => index !== keepIndex);
        const mergeMachineIds = mergeSystems.map(s => s.machineId);
        
        console.log(`   ✓ Keeping system: ID ${keepSystem.machineId} ("${keepSystem.pcName}")`);
        console.log(`   ✓ Merging ${mergeMachineIds.length} system(s): ${mergeMachineIds.join(', ')}`);
        
        // Automatically merge duplicates
        const mergeResult = await storage.mergeDuplicateMacId(normalizedMacId, keepSystem.machineId, mergeMachineIds);
        
        if (!mergeResult.success || mergeResult.merged === 0) {
          console.error(`   ❌ Merge failed for MAC ID "${normalizedMacId}":`, mergeResult.message);
          continue;
        }
        
        // Create notification about the automatic merge
        const mergedPcNames = mergeSystems.map(s => s.pcName).join(', ');
        try {
          await storage.createNotification({
            machineId: keepSystem.machineId,
            notificationType: 'duplicate_macid_merged',
            title: 'Duplicate MAC ID Automatically Merged',
            message: `Found ${systems.length} systems with the same MAC ID (${normalizedMacId}). Automatically merged ${mergeResult.merged} system(s) (${mergedPcNames}) into system "${keepSystem.pcName}" (ID: ${keepSystem.machineId}).`,
            oldValue: mergedPcNames,
            newValue: keepSystem.pcName,
            macId: normalizedMacId,
            isRead: 0
          });
          console.log(`   ✓ Notification created`);
        } catch (notifError: any) {
          console.warn(`   ⚠️  Failed to create notification (merge was successful):`, notifError.message);
        }
        
        console.log(`   ✅ Successfully merged ${mergeResult.merged} system(s) for MAC ID "${normalizedMacId}"`);
        totalMerged += mergeResult.merged;
      } catch (error: any) {
        console.error(`   ❌ Error merging duplicates for MAC ID "${duplicate.macId}":`, error.message);
        // Continue with next duplicate group
      }
    }
    
    console.log("\n" + "=".repeat(80));
    if (totalMerged > 0) {
      console.log(`✅ Merge completed successfully!`);
      console.log(`   - Processed ${totalGroups} duplicate group(s)`);
      console.log(`   - Merged ${totalMerged} duplicate system(s)`);
    } else {
      console.log(`ℹ️  No systems were merged.`);
    }
    console.log("=".repeat(80) + "\n");

  } catch (error: any) {
    console.error("❌ Error during merge process:", error);
    throw error;
  }
}

// Run the merge
mergeDuplicateMacIds()
  .then(() => {
    console.log("✓ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("✗ Script failed:", error);
    process.exit(1);
  });



