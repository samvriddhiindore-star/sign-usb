import type { Express } from "express";
import type { Server as HTTPServer } from "http";
import { storage } from "./storage";
import { setupSignalRHub, sendCommandToAgent } from "./signalr-hub";
import { generateToken, hashPassword, comparePassword, authMiddleware } from "./auth";
import { z } from "zod";
import type { Server as SocketIOServer } from "socket.io";

let io: SocketIOServer;

export async function registerRoutes(
  httpServer: HTTPServer,
  app: Express
): Promise<HTTPServer> {
  
  io = setupSignalRHub(httpServer);

  // Admin Authentication
  app.post("/api/admin/register", async (req, res) => {
    try {
      const schema = z.object({
        name: z.string(),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.string().optional()
      });
      
      const data = schema.parse(req.body);
      
      const existing = await storage.getAdminByEmail(data.email);
      if (existing) {
        return res.status(400).json({ error: "Email already exists" });
      }
      
      const passwordHash = await hashPassword(data.password);
      const admin = await storage.createAdmin({
        name: data.name,
        email: data.email,
        passwordHash,
        role: data.role || "admin"
      });
      
      const token = generateToken({
        adminId: admin.id,
        email: admin.email,
        role: admin.role
      });
      
      res.json({ 
        admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
        token 
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/admin/login", async (req, res) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        password: z.string()
      });
      
      const data = schema.parse(req.body);
      
      const admin = await storage.getAdminByEmail(data.email);
      if (!admin) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      const valid = await comparePassword(data.password, admin.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      const token = generateToken({
        adminId: admin.id,
        email: admin.email,
        role: admin.role
      });
      
      res.json({ 
        admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
        token 
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // User Management (Protected Routes)
  app.get("/api/users", authMiddleware, async (req, res) => {
    try {
      const users = await storage.getAdmins();
      res.json(users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt.toISOString()
      })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/users/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
      
      const user = await storage.getAdmin(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString()
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/users", authMiddleware, async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(["admin", "user"]).optional()
      });
      
      const data = schema.parse(req.body);
      
      const existing = await storage.getAdminByEmail(data.email);
      if (existing) {
        return res.status(400).json({ error: "Email already exists" });
      }
      
      const passwordHash = await hashPassword(data.password);
      const user = await storage.createAdmin({
        name: data.name,
        email: data.email,
        passwordHash,
        role: data.role || "user"
      });
      
      res.status(201).json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString()
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/users/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
      
      const schema = z.object({
        name: z.string().min(2).optional(),
        email: z.string().email().optional(),
        role: z.enum(["admin", "user"]).optional()
      });
      
      const data = schema.parse(req.body);
      
      const user = await storage.getAdmin(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (data.email && data.email !== user.email) {
        const existing = await storage.getAdminByEmail(data.email);
        if (existing) {
          return res.status(400).json({ error: "Email already exists" });
        }
      }
      
      const updated = await storage.updateAdmin(id, {
        name: data.name || user.name,
        email: data.email || user.email,
        role: data.role || user.role
      });
      
      if (!updated) {
        return res.status(500).json({ error: "Failed to update user" });
      }
      
      res.json({
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        createdAt: updated.createdAt.toISOString()
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/users/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
      
      const user = await storage.getAdmin(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const success = await storage.deleteAdmin(id);
      if (!success) {
        return res.status(500).json({ error: "Failed to delete user" });
      }
      
      res.json({ success: true, message: "User deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Machine Management (Protected Routes)
  app.get("/api/machines", authMiddleware, async (req, res) => {
    try {
      const machines = await storage.getMachines();
      
      const formatted = machines.map(m => ({
        id: m.id.toString(),
        hostname: m.hostname,
        osVersion: m.osVersion,
        agentVersion: m.agentVersion,
        lastSeenAt: m.lastSeenAt.toISOString(),
        status: m.status,
        policy: m.policy ? {
          lockAllUsb: m.policy.lockAllUsb,
          temporarilyUnlockedUntil: m.policy.temporarilyUnlockedUntil?.toISOString() || null
        } : null
      }));
      
      res.json(formatted);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/machines/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid machine ID" });
      }
      
      const machine = await storage.getMachine(id);
      if (!machine) {
        return res.status(404).json({ error: "Machine not found" });
      }
      
      res.json({
        id: machine.id.toString(),
        hostname: machine.hostname,
        osVersion: machine.osVersion,
        agentVersion: machine.agentVersion,
        lastSeenAt: machine.lastSeenAt.toISOString(),
        status: machine.status,
        agentId: machine.agentId,
        ipAddress: machine.ipAddress,
        policy: machine.policy ? {
          lockAllUsb: machine.policy.lockAllUsb,
          temporarilyUnlockedUntil: machine.policy.temporarilyUnlockedUntil?.toISOString() || null
        } : null
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Request current status from agent and return to dashboard
  app.get("/api/machines/:id/status", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid machine ID" });
      }

      const machine = await storage.getMachine(id);
      if (!machine) {
        return res.status(404).json({ error: "Machine not found" });
      }

      // Send a GetStatus command and wait for the agent's response (ack)
      const result = await sendCommandToAgent(machine.agentId, io, "GetStatus", {}, { waitForAck: true, timeoutMs: 5000 });

      if (!result || (result && (result as any).success === false && (result as any).queued)) {
        return res.status(503).json({ error: "Agent not connected or no response", queued: (result as any).queued ?? false });
      }

      return res.json({ success: true, status: result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/machines/:id/policy", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid machine ID" });
      }
      
      const schema = z.object({
        lockAllUsb: z.boolean().optional(),
        temporarilyUnlockedUntil: z.string().nullable().optional()
      });
      
      const data = schema.parse(req.body);
      
      const machine = await storage.getMachine(id);
      if (!machine) {
        return res.status(404).json({ error: "Machine not found" });
      }
      
      const updates: any = {};
      if (typeof data.lockAllUsb !== 'undefined') {
        updates.lockAllUsb = data.lockAllUsb;
      }
      if (typeof data.temporarilyUnlockedUntil !== 'undefined') {
        updates.temporarilyUnlockedUntil = data.temporarilyUnlockedUntil ? new Date(data.temporarilyUnlockedUntil) : null;
      }
      
      const policy = await storage.updatePolicy(id, updates);
      
      if (policy) {
        const command = policy.lockAllUsb ? "DisableUsb" : "EnableUsb";
        sendCommandToAgent(machine.agentId, io, command, { policyId: policy.id });
      }
      
      res.json({ 
        success: true,
        policy: policy ? {
          lockAllUsb: policy.lockAllUsb,
          temporarilyUnlockedUntil: policy.temporarilyUnlockedUntil?.toISOString() || null
        } : null
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // USB Logs
  app.get("/api/machines/:id/logs", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid machine ID" });
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await storage.getLogs(id, limit);
      
      res.json(logs.map(log => ({
        id: log.id.toString(),
        machineId: log.machineId.toString(),
        deviceId: log.deviceId,
        vendor: log.vendor,
        product: log.product,
        eventType: log.eventType,
        status: log.status,
        createdAt: log.createdAt.toISOString()
      })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/logs", authMiddleware, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await storage.getAllLogs(limit);
      
      res.json(logs.map(log => ({
        id: log.id.toString(),
        machineId: log.machineId.toString(),
        deviceId: log.deviceId,
        vendor: log.vendor,
        product: log.product,
        eventType: log.eventType,
        status: log.status,
        createdAt: log.createdAt.toISOString()
      })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Health Check (Public)
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  return httpServer;
}
