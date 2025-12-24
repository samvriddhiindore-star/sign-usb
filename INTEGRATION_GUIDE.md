# SIGN - USB - Windows Service Integration Guide

## 🎉 Backend Complete!

Your complete USB Control System backend is now live and running with:
- ✅ PostgreSQL database (machines, policies, usb_logs, admins)
- ✅ REST API for admin panel
- ✅ Real-time Socket.IO hub for Windows Service agents
- ✅ Authentication & authorization
- ✅ Full CRUD operations

---

## 📋 Quick Start

### 1. Admin Panel Access

**Login Credentials:**
- **URL**: Your Replit app URL (e.g., `https://your-app.replit.dev`)
- **Email**: `admin@company.com`
- **Password**: `admin123`

**Features Available:**
- Dashboard with fleet overview
- Machines list with policy controls
- Individual machine detail pages
- USB event logs
- Real-time status updates

---

## 🔌 Connecting Your Windows Service

### Connection Details

Your Windows Service needs to connect to the **Socket.IO Hub** at:

```
URL: wss://your-replit-app.replit.dev/agent-hub
Path: /agent-hub
Protocol: Socket.IO (compatible with SignalR pattern)
```

### Important Notes

**⚠️ Protocol Compatibility:**
Your Windows Service uses **SignalR Client**, but this backend uses **Socket.IO** (Node.js standard). They're similar but not directly compatible.

**Options to Connect:**

**Option 1: Adapt Windows Service** (Recommended)
Modify your Windows Service to use Socket.IO client instead of SignalR:
```bash
# In your .NET project
dotnet add package SocketIOClient
```

**Option 2: Use HTTP REST API**
Your Windows Service can use REST endpoints instead of real-time:
- POST `/api/agent/register` - Register agent
- POST `/api/agent/heartbeat` - Send heartbeats
- POST `/api/agent/usb-event` - Log USB events

**Option 3: Upgrade Backend to SignalR Server**
Install `@microsoft/signalr` server package (ASP.NET-compatible), but this requires additional setup.

---

## 📡 Socket.IO Events Reference

### Agent → Server (Emit)

#### 1. Register
```javascript
socket.emit("Register", {
  agentId: "MACHINE-001",
  hostname: "DESKTOP-ABC123",
  osVersion: "Windows 11 Pro 23H2",
  agentVersion: "1.2.1",
  ipAddress: "192.168.1.100" // Optional
});
```

**Response:**
```javascript
socket.on("Registered", (data) => {
  // data = { success: true, machineId: 1, message: "..." }
});
```

#### 2. Heartbeat
```javascript
socket.emit("Heartbeat", {
  agentId: "MACHINE-001",
  uptime: 3600,
  cpuUsage: 25.5,  // Optional
  memoryUsage: 60  // Optional
});
```

**Response:**
```javascript
socket.on("HeartbeatAck", (data) => {
  // data = { received: true, timestamp: "..." }
});
```

#### 3. USB Event
```javascript
socket.emit("UsbEvent", {
  agentId: "MACHINE-001",
  deviceId: "USB\\VID_0781&PID_5581",
  vendor: "SanDisk",
  product: "Ultra Flair",
  eventType: "connected",  // "connected" | "disconnected" | "blocked"
  status: "blocked"        // "allowed" | "blocked"
});
```

#### 4. Get Status
```javascript
socket.emit("GetStatus", {
  agentId: "MACHINE-001"
});
```

**Response:**
```javascript
socket.on("StatusResponse", (data) => {
  // data = { machine: {...}, policy: {...}, timestamp: "..." }
});
```

### Server → Agent (Listen)

#### EnableUsb
```javascript
socket.on("EnableUsb", (data) => {
  // Server requests to enable USB
  // Your agent should: Set USBSTOR\Start = 3
});
```

#### DisableUsb
```javascript
socket.on("DisableUsb", (data) => {
  // Server requests to disable USB
  // Your agent should: Set USBSTOR\Start = 4
});
```

---

## 🧪 Testing the Integration

### Test With Browser Console

1. Open your Replit app
2. Open DevTools Console (F12)
3. Run this test:

```javascript
const io = window.io || await import('https://cdn.socket.io/4.5.4/socket.io.esm.min.js').then(m => m.io);

const socket = io('/agent-hub');

socket.on('connect', () => {
  console.log('✅ Connected!');
  
  socket.emit('Register', {
    agentId: 'TEST-MACHINE-001',
    hostname: 'TEST-LAPTOP',
    osVersion: 'Windows 11',
    agentVersion: '1.0.0'
  });
});

socket.on('Registered', (data) => {
  console.log('✅ Registered:', data);
});

socket.on('EnableUsb', () => console.log('🔓 Command: EnableUsb'));
socket.on('DisableUsb', () => console.log('🔒 Command: DisableUsb'));
```

### Check Admin Panel

1. Login at `/login`
2. Go to "Machines" page
3. You should see your test machine appear
4. Toggle the "Lock USB" switch
5. Watch console for `EnableUsb` / `DisableUsb` events

---

## 🗂️ Database Schema

### Tables Created

**admins**
- id, name, email, passwordHash, role, createdAt

**machines**
- id, agentId (unique), hostname, osVersion, agentVersion
- lastSeenAt, status, ipAddress, createdAt

**policies**
- id, machineId (FK), lockAllUsb, temporarilyUnlockedUntil
- updatedAt, createdAt

**usb_logs**
- id, machineId (FK), deviceId, vendor, product
- eventType, status, createdAt

---

## 🔐 API Endpoints

### Public

**POST** `/api/admin/login`
```json
{
  "email": "admin@company.com",
  "password": "admin123"
}
```
Returns: `{ admin: {...}, token: "..." }`

### Protected (Require `Authorization: Bearer <token>`)

**GET** `/api/machines` - List all machines
**GET** `/api/machines/:id` - Get machine details
**PUT** `/api/machines/:id/policy` - Update machine policy
```json
{
  "lockAllUsb": true,
  "temporarilyUnlockedUntil": "2025-01-01T12:00:00Z" // or null
}
```

**GET** `/api/machines/:id/logs` - Get logs for a machine
**GET** `/api/logs` - Get all logs
**GET** `/health` - Health check (public)

---

## 🚀 Next Steps

### 1. Create More Admins
```bash
curl -X POST https://your-app.replit.dev/api/admin/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@company.com",
    "password": "secure123"
  }'
```

### 2. Test Machine Registration

Use the browser console test above, or connect a real Windows Service.

### 3. Monitor Logs

Check server logs in the Replit console for:
- Agent connections
- Policy updates
- USB events
- Errors

---

## 🛠️ Adapting Your Windows Service

### Sample C# Socket.IO Client

```csharp
using SocketIOClient;

var client = new SocketIO("https://your-app.replit.dev", new SocketIOOptions 
{
    Path = "/agent-hub"
});

client.On("Registered", response => {
    Console.WriteLine("Registered: " + response);
});

client.On("EnableUsb", response => {
    // Enable USB logic here
});

client.On("DisableUsb", response => {
    // Disable USB logic here
});

await client.ConnectAsync();

await client.EmitAsync("Register", new {
    agentId = "MACHINE-001",
    hostname = Environment.MachineName,
    osVersion = "Windows 11",
    agentVersion = "1.2.0"
});
```

Install: `dotnet add package SocketIOClient`

---

## 📞 Support

**Backend is running at:** Your Replit app URL
**Database:** PostgreSQL (auto-managed by Replit)
**Real-time Hub:** Socket.IO at `/agent-hub`

**To restart backend:**
Click "Stop" then "Run" in Replit console

**To reseed admin:**
```bash
tsx server/seed.ts
```

**To check database:**
Use Replit's Database tab

---

## ✅ What's Working

- ✅ Full-stack application (Frontend + Backend + Database)
- ✅ Real-time agent communication
- ✅ Admin authentication
- ✅ Policy management
- ✅ USB event logging
- ✅ Auto-reconnection handling
- ✅ Machine status tracking

**Ready to connect your Windows Service! 🎉**
