
import fetch from "node-fetch";

async function verify() {
    const baseUrl = "http://localhost:3000";

    console.log("1. Authenticating...");
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
        const token = body.token;
        console.log("Login successful.");

        console.log("2. Testing GET /api/urls (List URLs)...");
        const urlsRes = await fetch(`${baseUrl}/api/urls`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`GET /api/urls status: ${urlsRes.status}`);
        if (!urlsRes.ok) console.log(await urlsRes.text());

        console.log("3. Testing DELETE /api/urls/bulk (Empty payload)...");
        const delRes = await fetch(`${baseUrl}/api/urls/bulk`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ ids: [] })
        });
        console.log(`DELETE /api/urls/bulk status: ${delRes.status}`);
        if (delRes.status === 500) console.log(await delRes.text());

    } catch (e) {
        console.log("Exception:", e);
    }
}

verify().catch(console.error);
