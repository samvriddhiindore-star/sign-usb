
import { storage } from "../server/storage";
import { db } from "../server/db";
import { urlMaster } from "../shared/schema";
import { eq } from "drizzle-orm";

async function testBulkDelete() {
    console.log("Starting bulk delete test...");

    // 1. Create test URLs
    const testUrls = ["http://test-delete-1.com", "http://test-delete-2.com"];
    console.log("Creating test URLs:", testUrls);

    const createdIds: number[] = [];

    for (const url of testUrls) {
        const result = await storage.createUrl({ url, remark: "allowed" });
        createdIds.push(result.id);
    }

    console.log("Created URLs with IDs:", createdIds);

    // 2. Verify they exist
    for (const id of createdIds) {
        const exists = await storage.getUrl(id);
        if (!exists) {
            console.error(`Error: URL with ID ${id} should exist but doesn't.`);
            process.exit(1);
        }
    }
    console.log("Verified URLs exist.");

    // 3. Perform Bulk Delete
    console.log("Deleting URLs...", createdIds);
    const deleteResult = await storage.deleteBulkUrls(createdIds);
    console.log("Delete result:", deleteResult);

    // 4. Verify they are gone
    for (const id of createdIds) {
        const exists = await storage.getUrl(id);
        if (exists) {
            console.error(`Error: URL with ID ${id} should be deleted but still exists.`);
            // Clean up manually if test failed
            await db.delete(urlMaster).where(eq(urlMaster.id, id));
        } else {
            console.log(`Success: URL with ID ${id} was deleted.`);
        }
    }

    console.log("Test completed.");
    process.exit(0);
}

testBulkDelete().catch(err => {
    console.error("Test failed with error:", err);
    process.exit(1);
});
