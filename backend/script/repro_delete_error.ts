
import { generateToken } from "../server/auth";
import { storage } from "../server/storage";
import fetch from "node-fetch"; // Assuming node-fetch is available or using native fetch in Node 18+

const BASE_URL = "http://localhost:3000";

async function run() {
    console.log("Setting up test user...");
    // 1. Ensure we have an admin and get a token
    let admin = await storage.getAdminByEmail("test_debug@example.com");
    if (!admin) {
        // Create dummy admin for testing
        // import { hashPassword } from "../server/auth"; // Need to mock or import
        // For simplicity, let's just create a token for a non-existent user if authMiddleware only checks token signature,
        // but authMiddleware likely checks DB.

        // Actually, let's use an existing admin if possible or create one properly.
        // We can't import hashPassword easily if it depends on bcrypt which might be native.
        // Let's rely on storage.createAdmin if we can.

        // BETTER: Just generate a token with a random ID, and catch the error if user not found.
        // But authMiddleware usually verifies user existence.

        // Let's try to get ANY admin.
        const admins = await storage.getAdmins();
        if (admins.length > 0) {
            admin = admins[0];
        } else {
            console.log("No admins found, creating one...");
            // This might fail if we don't handle password hashing, but let's try.
            // We can just skip actual login and generate token if we have the secret.
        }
    }

    if (!admin) {
        console.error("Could not find or create admin for testing.");
        // Try creating a fake one just for the token, maybe the middleware doesn't check DB?
        // Checking routes.ts: authMiddleware -> req.user = decoded.
        // It usually doesn't hit DB unless it's a strict middleware.
        // Let's assume standard JWT verification.
    }

    // Fallback ID
    const adminId = admin ? admin.id : 99999;
    const adminEmail = admin ? admin.email : "test@test.com";
    const adminRole = admin ? admin.role : "admin";

    const token = generateToken({
        adminId,
        email: adminEmail,
        role: adminRole
    });

    console.log(`Generated token for admin ${adminId}`);

    // 2. Perform the DELETE request
    // Case A: Valid body
    // We need valid URL IDs to delete, but for 400 vs 200/404 check, any number is fine. 
    // If IDs don't exist, storage might return "deleted: 0" or throw.
    // The previous test script confirmed correct behavior for non-existent IDs (success=true, deleted=0).

    const payload = { ids: [12345, 67890] };

    console.log("Sending DELETE request to /api/urls/bulk with payload:", JSON.stringify(payload));

    try {
        const res = await fetch(`${BASE_URL}/api/urls/bulk`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const status = res.status;
        const text = await res.text();

        console.log(`Response Status: ${status}`);
        console.log(`Response Body: ${text}`);

        if (status === 400) {
            console.error("reproduction confirmed: 400 Bad Request");
        } else {
            console.log("Request matched expected behavior (not 400).");
        }

    } catch (err) {
        console.error("Request failed:", err);
    }

    process.exit(0);
}

run().catch(console.error);
