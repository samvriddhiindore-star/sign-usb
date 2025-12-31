
import fetch from "node-fetch";

async function reproduce() {
    const baseUrl = "http://localhost:3000";
    console.log("1. Authenticating...");

    let token = "";
    try {
        const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "admin@company.com", password: "admin123" })
        });

        if (!loginRes.ok) {
            console.log("Login failed", loginRes.status, await loginRes.text());
            return;
        }

        const body = await loginRes.json();
        token = body.token;
        console.log("Login successful.");
    } catch (e) {
        console.log("Login network error", e);
        return;
    }

    console.log("2. Fetching a system to test on...");
    let systemId = 0;
    try {
        const systemsRes = await fetch(`${baseUrl}/api/systems`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const systems = await systemsRes.json();
        if (systems.length > 0) {
            systemId = systems[0].machineId;
            console.log(`Found system ID: ${systemId}`);
        } else {
            console.log("No systems found to test.");
            return;
        }
    } catch (e) {
        console.log("Failed to fetch systems", e);
        return;
    }

    console.log(`3. Attempting to enable USB for system ${systemId}...`);
    try {
        const res = await fetch(`${baseUrl}/api/systems/${systemId}/usb`, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ enabled: true })
        });

        console.log(`PUT status: ${res.status}`);
        const text = await res.text();
        console.log("Response body:", text);
    } catch (e) {
        console.log("PUT request failed", e);
    }
}

reproduce().catch(console.error);
