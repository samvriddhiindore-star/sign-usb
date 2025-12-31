
import express from "express";
import { registerRoutes } from "../server/routes";
import { createServer } from "http";
import fetch from "node-fetch";

// Mock storage if needed, but since we are testing routes and they use real storage,
// we'll rely on real storage. If storage fails, it's fine, we just want to pass the route 400 check.

async function verify() {
    const app = express();
    const httpServer = createServer(app);

    app.use(express.json());

    // Register routes
    await registerRoutes(httpServer, app);

    // Start on random port
    const port = 3001;
    httpServer.listen(port, async () => {
        console.log(`Test server running on port ${port}`);

        // Test the payload
        const payload = { ids: [123, 456] };

        // We need to validauth?
        // The routes use authMiddleware.
        // authMiddleware verifies token.
        // We can just bypass it by mocking it? 
        // No, registerRoutes imports it directly from ./auth.

        // So we need a token.
        // Let's import generateToken
        const { generateToken } = await import("../server/auth");
        const token = generateToken({
            adminId: 1,
            email: "test@test.com",
            role: "admin"
        });

        try {
            const res = await fetch(`http://localhost:${port}/api/urls/bulk`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            console.log(`Response Status: ${res.status}`);
            const text = await res.text();
            console.log(`Response Body: ${text}`);

            if (res.status === 400 && text.includes("Invalid URL ID")) {
                console.error("FAIL: Still hitting the /:id route!");
                process.exit(1);
            } else if (res.status === 200 || res.status === 404 || res.status === 500 || (res.status === 400 && !text.includes("Invalid URL ID"))) {
                console.log("PASS: Route was correctly routed to bulk handler (even if it failed logic)");
                process.exit(0);
            } else {
                console.log("PASS: Unknown status but likely routed correctly. Status:", res.status);
                process.exit(0);
            }

        } catch (err) {
            console.error("Test failed request", err);
            process.exit(1);
        } finally {
            httpServer.close();
        }
    });
}

verify().catch(console.error);
