import { db } from "../server/db";
import { clientMaster } from "../shared/schema";

async function checkDuplicateMacIds() {
  try {
    console.log("Checking for duplicate MAC IDs...\n");

    // Get all systems
    const allSystems = await db.select().from(clientMaster);

    console.log(`Total systems in database: ${allSystems.length}\n`);

    // Group by MAC ID
    const macIdMap = new Map<string, typeof allSystems>();
    
    allSystems.forEach(system => {
      const macId = system.macId?.trim() || '';
      if (macId) {
        if (!macIdMap.has(macId)) {
          macIdMap.set(macId, []);
        }
        macIdMap.get(macId)!.push(system);
      }
    });

    console.log("All MAC IDs (sorted by count):");
    console.log("=".repeat(60));
    const sortedMacIds = Array.from(macIdMap.entries())
      .sort((a, b) => b[1].length - a[1].length);
    
    sortedMacIds.forEach(([macId, systems], index) => {
      console.log(`${index + 1}. MAC ID: "${macId}" | Count: ${systems.length}`);
    });
    console.log("=".repeat(60));
    console.log(`\nTotal unique MAC IDs: ${macIdMap.size}\n`);

    // Get duplicates only
    const duplicates = sortedMacIds.filter(([_, systems]) => systems.length > 1);

    console.log("\nDuplicate MAC IDs (count > 1):");
    console.log("=".repeat(60));
    
    if (duplicates.length === 0) {
      console.log("No duplicates found!");
    } else {
      duplicates.forEach(([macId, systems], index) => {
        console.log(`${index + 1}. MAC ID: "${macId}" | Count: ${systems.length}`);
      });
    }
    console.log("=".repeat(60));
    console.log(`\nTotal duplicate groups: ${duplicates.length}\n`);

    // For each duplicate, show the systems
    if (duplicates.length > 0) {
      console.log("\nDetailed duplicate information:");
      console.log("=".repeat(60));
      
      for (const [macId, systems] of duplicates) {
        console.log(`\nMAC ID: "${macId}" (${systems.length} systems)`);
        systems.forEach((system, idx) => {
          console.log(`  ${idx + 1}. Machine ID: ${system.machineId}`);
          console.log(`     PC Name: ${system.pcName}`);
          console.log(`     System User ID: ${system.systemUserId || 'None'}`);
          console.log(`     Last Connected: ${system.lastConnected ? system.lastConnected.toISOString() : 'Never'}`);
          console.log(`     Created At: ${system.createdAt ? system.createdAt.toISOString() : 'Unknown'}`);
        });
      }
    }

    // Check for case sensitivity issues
    console.log("\n\nChecking for case sensitivity issues...");
    console.log("=".repeat(60));
    
    const caseMap = new Map<string, string[]>();
    macIdMap.forEach((systems, macId) => {
      const upper = macId.toUpperCase();
      if (!caseMap.has(upper)) {
        caseMap.set(upper, []);
      }
      if (!caseMap.get(upper)!.includes(macId)) {
        caseMap.get(upper)!.push(macId);
      }
    });
    
    let caseIssues = 0;
    caseMap.forEach((variants, upper) => {
      if (variants.length > 1) {
        caseIssues++;
        console.log(`Case variants found for "${upper}":`);
        variants.forEach(v => console.log(`  - "${v}"`));
      }
    });
    
    if (caseIssues === 0) {
      console.log("No case sensitivity issues found.");
    } else {
      console.log(`\nFound ${caseIssues} MAC ID(s) with case variations.`);
    }

  } catch (error: any) {
    console.error("Error checking duplicate MAC IDs:", error);
    throw error;
  }
}

// Run the check
checkDuplicateMacIds()
  .then(() => {
    console.log("\n✓ Check completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("✗ Check failed:", error);
    process.exit(1);
  });
