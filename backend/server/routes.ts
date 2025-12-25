import type { Express } from "express";
import type { Server as HTTPServer } from "http";
import { storage } from "./storage";
import { setupSocketIOHub, sendCommandToAgent } from "./signalr-hub";
import { generateToken, hashPassword, comparePassword, authMiddleware } from "./auth";
import { z } from "zod";
import type { Server as SocketIOServer } from "socket.io";

let io: SocketIOServer;

export async function registerRoutes(
  httpServer: HTTPServer,
  app: Express
): Promise<HTTPServer> {
  
  io = setupSocketIOHub(httpServer);

  // ==================== ADMIN AUTHENTICATION ====================
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
      
      // Check if user is active
      if (admin.status === 0) {
        return res.status(403).json({ error: "Account is deactivated. Please contact administrator." });
      }
      
      // Update last login timestamp
      await storage.updateAdminLastLogin(admin.id);
      
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

  // ==================== USER MANAGEMENT ====================
  app.get("/api/users", authMiddleware, async (req, res) => {
    try {
      const users = await storage.getAdmins();
      res.json(users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone || null,
        role: u.role,
        status: u.status,
        lastLogin: u.lastLogin?.toISOString() || null,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt?.toISOString() || null
      })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/users/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid user ID" });
      
      const user = await storage.getAdmin(id);
      if (!user) return res.status(404).json({ error: "User not found" });
      
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || null,
        role: user.role,
        status: user.status,
        lastLogin: user.lastLogin?.toISOString() || null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt?.toISOString() || null
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
        phone: z.string().optional(),
        role: z.enum(["admin", "manager", "user", "viewer"]).optional(),
        status: z.number().optional()
      });
      
      const data = schema.parse(req.body);
      
      const existing = await storage.getAdminByEmail(data.email);
      if (existing) return res.status(400).json({ error: "Email already exists" });
      
      const passwordHash = await hashPassword(data.password);
      const user = await storage.createAdmin({
        name: data.name,
        email: data.email,
        passwordHash,
        phone: data.phone || null,
        role: data.role || "user",
        status: data.status ?? 1
      });
      
      res.status(201).json({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || null,
        role: user.role,
        status: user.status,
        lastLogin: null,
        createdAt: user.createdAt.toISOString()
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/users/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid user ID" });
      
      const schema = z.object({
        name: z.string().min(2).optional(),
        email: z.string().email().optional(),
        phone: z.string().nullable().optional(),
        role: z.enum(["admin", "manager", "user", "viewer"]).optional()
      });
      
      const data = schema.parse(req.body);
      const user = await storage.getAdmin(id);
      if (!user) return res.status(404).json({ error: "User not found" });
      
      if (data.email && data.email !== user.email) {
        const existing = await storage.getAdminByEmail(data.email);
        if (existing) return res.status(400).json({ error: "Email already exists" });
      }
      
      const updates: any = {};
      if (data.name) updates.name = data.name;
      if (data.email) updates.email = data.email;
      if (data.phone !== undefined) updates.phone = data.phone;
      if (data.role) updates.role = data.role;
      
      const updated = await storage.updateAdmin(id, updates);
      
      if (!updated) return res.status(500).json({ error: "Failed to update user" });
      
      res.json({
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone || null,
        role: updated.role,
        status: updated.status,
        lastLogin: updated.lastLogin?.toISOString() || null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt?.toISOString() || null
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Toggle user status (activate/deactivate)
  app.put("/api/users/:id/status", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid user ID" });
      
      const schema = z.object({
        status: z.number().min(0).max(1)
      });
      
      const data = schema.parse(req.body);
      const user = await storage.getAdmin(id);
      if (!user) return res.status(404).json({ error: "User not found" });
      
      const updated = await storage.updateAdminStatus(id, data.status);
      if (!updated) return res.status(500).json({ error: "Failed to update user status" });
      
      res.json({
        success: true,
        id: updated.id,
        status: updated.status,
        message: data.status === 1 ? "User activated" : "User deactivated"
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Change user password
  app.put("/api/users/:id/password", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid user ID" });
      
      const schema = z.object({
        newPassword: z.string().min(6, "Password must be at least 6 characters")
      });
      
      const data = schema.parse(req.body);
      const user = await storage.getAdmin(id);
      if (!user) return res.status(404).json({ error: "User not found" });
      
      const passwordHash = await hashPassword(data.newPassword);
      const updated = await storage.updateAdminPassword(id, passwordHash);
      if (!updated) return res.status(500).json({ error: "Failed to update password" });
      
      res.json({ success: true, message: "Password updated successfully" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/users/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid user ID" });
      
      const user = await storage.getAdmin(id);
      if (!user) return res.status(404).json({ error: "User not found" });
      
      const success = await storage.deleteAdmin(id);
      if (!success) return res.status(500).json({ error: "Failed to delete user" });
      
      res.json({ success: true, message: "User deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== DASHBOARD STATS ====================
  app.get("/api/dashboard/stats", authMiddleware, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== SYSTEMS (CLIENT MASTER) ====================
  app.get("/api/systems", authMiddleware, async (req, res) => {
    try {
      const systems = await storage.getSystems();
      
      // Helper function to check if system is online (last_connected within 1 minute)
      const isSystemOnline = (machineOn: number | null, lastConnected: Date | null): boolean => {
        if (machineOn === 0) return false;
        if (!lastConnected) return false;
        
        const now = new Date();
        const lastConnectedTime = new Date(lastConnected);
        const diffInMs = now.getTime() - lastConnectedTime.getTime();
        const diffInMinutes = diffInMs / (1000 * 60);
        
        // If last connected is more than 1 minute ago, consider offline
        return diffInMinutes <= 1;
      };
      
      res.json(systems.map(s => {
        const isOnline = isSystemOnline(s.machineOn, s.lastConnected);
        
        // Debug logging for offline systems
        if (!isOnline && s.machineOn === 1) {
          const now = new Date();
          const lastConnectedTime = s.lastConnected ? new Date(s.lastConnected) : null;
          const diffInMs = lastConnectedTime ? now.getTime() - lastConnectedTime.getTime() : null;
          const diffInMinutes = diffInMs ? diffInMs / (1000 * 60) : null;
          console.log(`[DEBUG] System ${s.machineId} (${s.pcName}) marked offline:`, {
            machineOn: s.machineOn,
            lastConnected: s.lastConnected?.toISOString(),
            diffInMinutes: diffInMinutes?.toFixed(2),
            status: 'offline'
          });
        }
        
        return {
          machineId: s.machineId,
          machineUid: s.machineUid || null,
          pcName: s.pcName,
          macId: s.macId,
          usbStatus: s.usbStatus,
          machineOn: s.machineOn,
          lastConnected: s.lastConnected?.toISOString() || null,
          remark: s.remark,
          createdAt: s.createdAt?.toISOString() || null,
          status: isOnline ? 'online' : 'offline',
          profileId: s.profileId,
          profile: s.profile ? {
            profileId: s.profile.profileId,
            profileName: s.profile.profileName,
            usbPolicy: s.profile.usbPolicy
          } : null
        };
      }));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/systems/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid system ID" });
      
      const system = await storage.getSystem(id);
      if (!system) return res.status(404).json({ error: "System not found" });
      
      // Helper function to check if system is online (last_connected within 1 minute)
      const isSystemOnline = (machineOn: number | null, lastConnected: Date | null): boolean => {
        if (machineOn === 0) return false;
        if (!lastConnected) return false;
        
        const now = new Date();
        const lastConnectedTime = new Date(lastConnected);
        const diffInMs = now.getTime() - lastConnectedTime.getTime();
        const diffInMinutes = diffInMs / (1000 * 60);
        
        // If last connected is more than 1 minute ago, consider offline
        return diffInMinutes <= 1;
      };
      
      const isOnline = isSystemOnline(system.machineOn, system.lastConnected);
      
      res.json({
        machineId: system.machineId,
        machineUid: system.machineUid || null,
        pcName: system.pcName,
        macId: system.macId,
        usbStatus: system.usbStatus,
        machineOn: system.machineOn,
        lastConnected: system.lastConnected?.toISOString() || null,
        remark: system.remark,
        createdAt: system.createdAt?.toISOString() || null,
        status: isOnline ? 'online' : 'offline',
        profileId: system.profileId,
        profile: system.profile ? {
          profileId: system.profile.profileId,
          profileName: system.profile.profileName,
          usbPolicy: system.profile.usbPolicy
        } : null
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/systems/disconnected", authMiddleware, async (req, res) => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 7;
      const systems = await storage.getDisconnectedSystems(days);
      res.json(systems.map(s => ({
        machineId: s.machineId,
        machineUid: s.machineUid || null,
        pcName: s.pcName,
        macId: s.macId,
        lastConnected: s.lastConnected?.toISOString() || null,
        remark: s.remark
      })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Enable/Disable USB for a system
  app.put("/api/systems/:id/usb", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid system ID" });
      
      const schema = z.object({
        enabled: z.boolean()
      });
      
      const data = schema.parse(req.body);
      const usbStatus = data.enabled ? 1 : 0;
      
      const system = await storage.updateSystemUsbStatus(id, usbStatus);
      if (!system) return res.status(404).json({ error: "System not found" });
      
      // Send command to agent if online
      if (system.machineOn === 1) {
        const command = data.enabled ? "EnableUsb" : "DisableUsb";
        sendCommandToAgent(system.macId, io, command, { machineId: id });
      }
      
      res.json({ success: true, system: {
        machineId: system.machineId,
        pcName: system.pcName,
        usbStatus: system.usbStatus
      }});
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk USB control
  app.put("/api/systems/bulk/usb", authMiddleware, async (req, res) => {
    try {
      const schema = z.object({
        machineIds: z.array(z.number()),
        enabled: z.boolean()
      });
      
      const data = schema.parse(req.body);
      const usbStatus = data.enabled ? 1 : 0;
      
      const affected = await storage.bulkUpdateUsbStatus(data.machineIds, usbStatus);
      
      // Send commands to online agents
      for (const id of data.machineIds) {
        const system = await storage.getSystem(id);
        if (system && system.machineOn === 1) {
          const command = data.enabled ? "EnableUsb" : "DisableUsb";
          sendCommandToAgent(system.macId, io, command, { machineId: id });
        }
      }
      
      res.json({ success: true, affected });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Assign profile to a system
  app.put("/api/systems/:id/profile", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid system ID" });
      
      const schema = z.object({
        profileId: z.number().nullable()
      });
      
      const data = schema.parse(req.body);
      
      const system = await storage.assignProfileToSystem(id, data.profileId);
      if (!system) return res.status(404).json({ error: "System not found" });
      
      res.json({ success: true, system: {
        machineId: system.machineId,
        pcName: system.pcName,
        profileId: system.profileId
      }});
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk assign profile
  app.put("/api/systems/bulk/profile", authMiddleware, async (req, res) => {
    try {
      const schema = z.object({
        machineIds: z.array(z.number()),
        profileId: z.number().nullable()
      });
      
      const data = schema.parse(req.body);
      const affected = await storage.bulkAssignProfile(data.machineIds, data.profileId);
      
      res.json({ success: true, affected });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== USB LOGS ====================
  app.get("/api/usb-logs", authMiddleware, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 500;
      const logs = await storage.getUsbLogs(limit);
      
      res.json(logs.map(log => ({
        id: log.id,
        logUid: log.logUid || null,
        machineId: log.machineId,
        pcName: log.pcName || 'Unknown',
        deviceName: log.deviceName,
        deviceDescription: log.deviceDescription,
        deviceManufacturer: log.deviceManufacturer,
        devicePort: log.devicePort,
        connectTime: log.deviceConnectTime?.toISOString() || null,
        disconnectTime: log.deviceDisconnectTime?.toISOString() || null,
        duration: log.deviceConnectTime && log.deviceDisconnectTime 
          ? Math.round((new Date(log.deviceDisconnectTime).getTime() - new Date(log.deviceConnectTime).getTime()) / 1000)
          : null,
        status: log.deviceDisconnectTime ? 'Removed' : 'Connected',
        deviceId: log.deviceId,
        createdAt: log.createdAt?.toISOString() || null
      })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/usb-logs/machine/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid machine ID" });
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await storage.getUsbLogsByMachine(id, limit);
      
      res.json(logs.map(log => ({
        id: log.id,
        logUid: log.logUid || null,
        machineId: log.machineId,
        deviceName: log.deviceName,
        deviceDescription: log.deviceDescription,
        deviceManufacturer: log.deviceManufacturer,
        devicePort: log.devicePort,
        connectTime: log.deviceConnectTime?.toISOString() || null,
        disconnectTime: log.deviceDisconnectTime?.toISOString() || null,
        duration: log.deviceConnectTime && log.deviceDisconnectTime 
          ? Math.round((new Date(log.deviceDisconnectTime).getTime() - new Date(log.deviceConnectTime).getTime()) / 1000)
          : null,
        status: log.deviceDisconnectTime ? 'Removed' : 'Connected',
        deviceId: log.deviceId,
        createdAt: log.createdAt?.toISOString() || null
      })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/usb-logs/connected", authMiddleware, async (req, res) => {
    try {
      const devices = await storage.getConnectedUsbDevices();
      res.json(devices.map(d => ({
        id: d.id,
        logUid: d.logUid || null,
        machineId: d.machineId,
        pcName: d.pcName || 'Unknown',
        deviceName: d.deviceName,
        devicePort: d.devicePort,
        connectTime: d.deviceConnectTime?.toISOString() || null
      })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== PROFILES ====================
  app.get("/api/profiles", authMiddleware, async (req, res) => {
    try {
      const profiles = await storage.getProfiles();
      
      // Helper function to check if system is online (last_connected within 1 minute)
      const isSystemOnline = (machineOn: number | null, lastConnected: Date | null): boolean => {
        if (machineOn === 0) return false;
        if (!lastConnected) return false;
        
        const now = new Date();
        const lastConnectedTime = new Date(lastConnected);
        const diffInMs = now.getTime() - lastConnectedTime.getTime();
        const diffInMinutes = diffInMs / (1000 * 60);
        
        // If last connected is more than 1 minute ago, consider offline
        return diffInMinutes <= 1;
      };
      
      res.json(profiles.map(p => ({
        profileId: p.profileId,
        profileUid: p.profileUid || null,
        profileName: p.profileName,
        description: p.description,
        isActive: p.isActive,
        usbPolicy: p.usbPolicy,
        assignedCount: p.assignedCount,
        machines: p.machines.map(m => {
          const isOnline = isSystemOnline(m.machineOn, m.lastConnected);
          return {
            machineId: m.machineId,
            pcName: m.pcName,
            macId: m.macId,
            usbStatus: m.usbStatus,
            machineOn: m.machineOn,
            status: isOnline ? 'online' : 'offline',
            lastConnected: m.lastConnected?.toISOString() || null
          };
        }),
        createdAt: p.createdAt?.toISOString() || null
      })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/profiles/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid profile ID" });
      
      const profile = await storage.getProfile(id);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      
      // Helper function to check if system is online (last_connected within 1 minute)
      const isSystemOnline = (machineOn: number | null, lastConnected: Date | null): boolean => {
        if (machineOn === 0) return false;
        if (!lastConnected) return false;
        
        const now = new Date();
        const lastConnectedTime = new Date(lastConnected);
        const diffInMs = now.getTime() - lastConnectedTime.getTime();
        const diffInMinutes = diffInMs / (1000 * 60);
        
        // If last connected is more than 1 minute ago, consider offline
        return diffInMinutes <= 1;
      };
      
      res.json({
        profileId: profile.profileId,
        profileUid: profile.profileUid || null,
        profileName: profile.profileName,
        description: profile.description,
        isActive: profile.isActive,
        usbPolicy: profile.usbPolicy,
        assignedCount: profile.assignedCount,
        machines: profile.machines.map(m => {
          const isOnline = isSystemOnline(m.machineOn, m.lastConnected);
          return {
            machineId: m.machineId,
            pcName: m.pcName,
            macId: m.macId,
            usbStatus: m.usbStatus,
            machineOn: m.machineOn,
            status: isOnline ? 'online' : 'offline',
            lastConnected: m.lastConnected?.toISOString() || null
          };
        }),
        createdAt: profile.createdAt?.toISOString() || null
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/profiles", authMiddleware, async (req, res) => {
    try {
      console.log("POST /api/profiles - Request body:", JSON.stringify(req.body, null, 2));
      
      // Preprocess: convert empty strings to undefined, string numbers to numbers
      const preprocessed = {
        ...req.body,
        description: req.body.description && req.body.description.trim() ? req.body.description.trim() : undefined,
        usbPolicy: req.body.usbPolicy !== undefined ? (typeof req.body.usbPolicy === 'string' ? parseInt(req.body.usbPolicy, 10) : req.body.usbPolicy) : undefined,
        isActive: req.body.isActive !== undefined ? (typeof req.body.isActive === 'string' ? parseInt(req.body.isActive, 10) : req.body.isActive) : undefined
      };
      
      const schema = z.object({
        profileName: z.string().min(1),
        description: z.string().optional(),
        usbPolicy: z.number().optional(),
        isActive: z.number().optional()
      });
      
      const data = schema.parse(preprocessed);
      console.log("POST /api/profiles - Parsed data:", JSON.stringify(data, null, 2));
      
      const profile = await storage.createProfile(data);
      console.log("POST /api/profiles - Created profile:", profile.profileId);
      
      // Return in the same format as GET /api/profiles
      try {
        const profileWithMachines = await storage.getProfile(profile.profileId);
        if (profileWithMachines) {
          return res.status(201).json({
            profileId: profileWithMachines.profileId,
            profileUid: profileWithMachines.profileUid || null,
            profileName: profileWithMachines.profileName,
            description: profileWithMachines.description,
            isActive: profileWithMachines.isActive,
            usbPolicy: profileWithMachines.usbPolicy,
            assignedCount: profileWithMachines.assignedCount,
            machines: profileWithMachines.machines.map(m => {
              // Helper function to check if system is online (last_connected within 1 minute)
              const isSystemOnline = (machineOn: number | null, lastConnected: Date | null): boolean => {
                if (machineOn === 0) return false;
                if (!lastConnected) return false;
                
                const now = new Date();
                const lastConnectedTime = new Date(lastConnected);
                const diffInMs = now.getTime() - lastConnectedTime.getTime();
                const diffInMinutes = diffInMs / (1000 * 60);
                
                // If last connected is more than 1 minute ago, consider offline
                return diffInMinutes <= 1;
              };
              
              const isOnline = isSystemOnline(m.machineOn, m.lastConnected);
              return {
                machineId: m.machineId,
                pcName: m.pcName,
                macId: m.macId,
                usbStatus: m.usbStatus,
                machineOn: m.machineOn,
                status: isOnline ? 'online' : 'offline',
                lastConnected: m.lastConnected?.toISOString() || null
              };
            }),
            createdAt: profileWithMachines.createdAt?.toISOString() || null
          });
        }
      } catch (getProfileError: any) {
        console.error("Error fetching profile with machines, using fallback:", getProfileError);
      }
      
      // Fallback to basic profile if getProfile fails
      return res.status(201).json({
        profileId: profile.profileId,
        profileUid: profile.profileUid || null,
        profileName: profile.profileName,
        description: profile.description,
        isActive: profile.isActive,
        usbPolicy: profile.usbPolicy,
        assignedCount: 0,
        machines: [],
        createdAt: profile.createdAt?.toISOString() || null
      });
    } catch (error: any) {
      console.error("Error creating profile:", error);
      console.error("Error stack:", error.stack);
      // Check if it's a Zod validation error
      if (error.name === 'ZodError' || error.issues) {
        const zodError = error.issues || error.errors;
        const errorMessage = zodError?.[0]?.message || error.message || 'Validation error';
        console.error("Zod validation error:", JSON.stringify(zodError, null, 2));
        return res.status(400).json({ error: errorMessage });
      }
      res.status(400).json({ error: error.message || 'Failed to create profile' });
    }
  });

  app.put("/api/profiles/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid profile ID" });
      
      const schema = z.object({
        profileName: z.string().min(1).optional(),
        description: z.string().optional(),
        usbPolicy: z.number().optional(),
        isActive: z.number().optional()
      });
      
      const data = schema.parse(req.body);
      const profile = await storage.updateProfile(id, data);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      
      res.json({
        profileId: profile.profileId,
        profileName: profile.profileName,
        description: profile.description,
        isActive: profile.isActive,
        usbPolicy: profile.usbPolicy,
        createdAt: profile.createdAt?.toISOString() || null
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/profiles/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid profile ID" });
      
      const success = await storage.deleteProfile(id);
      if (!success) return res.status(404).json({ error: "Profile not found" });
      
      res.json({ success: true, message: "Profile deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Apply USB policy from profile to all assigned machines
  app.post("/api/profiles/:id/apply-policy", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid profile ID" });
      
      const affected = await storage.applyProfileUsbPolicy(id);
      
      // Get machines assigned to this profile and send commands
      const profile = await storage.getProfile(id);
      if (profile) {
        const command = profile.usbPolicy === 1 ? "EnableUsb" : "DisableUsb";
        for (const machine of profile.machines) {
          if (machine.machineOn === 1) {
            sendCommandToAgent(machine.macId, io, command, { machineId: machine.machineId });
          }
        }
      }
      
      res.json({ success: true, affected });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== URL MASTER (WEBSITE ACCESS CONTROL) ====================
  app.get("/api/urls", authMiddleware, async (req, res) => {
    try {
      const urls = await storage.getUrls();
      res.json(urls.map(u => ({
        id: u.id,
        urlUid: u.urlUid || null,
        url: u.url,
        access: u.remark || 'allowed',
        createdAt: u.createdAt?.toISOString() || null
      })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/urls/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid URL ID" });
      
      const url = await storage.getUrl(id);
      if (!url) return res.status(404).json({ error: "URL not found" });
      
      res.json({
        id: url.id,
        urlUid: url.urlUid || null,
        url: url.url,
        access: url.remark || 'allowed',
        createdAt: url.createdAt?.toISOString() || null
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/urls", authMiddleware, async (req, res) => {
    try {
      const schema = z.object({
        url: z.string().min(1),
        access: z.enum(['allowed', 'blocked'])
      });
      
      const data = schema.parse(req.body);
      const url = await storage.createUrl({
        url: data.url,
        remark: data.access
      });
      
      res.status(201).json({
        id: url.id,
        url: url.url,
        access: url.remark,
        createdAt: url.createdAt?.toISOString() || null
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/urls/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid URL ID" });
      
      const schema = z.object({
        url: z.string().min(1).optional(),
        access: z.enum(['allowed', 'blocked']).optional()
      });
      
      const data = schema.parse(req.body);
      const updates: any = {};
      if (data.url) updates.url = data.url;
      if (data.access) updates.remark = data.access;
      
      const url = await storage.updateUrl(id, updates);
      if (!url) return res.status(404).json({ error: "URL not found" });
      
      res.json({
        id: url.id,
        url: url.url,
        access: url.remark,
        createdAt: url.createdAt?.toISOString() || null
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/urls/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid URL ID" });
      
      const success = await storage.deleteUrl(id);
      if (!success) return res.status(404).json({ error: "URL not found" });
      
      res.json({ success: true, message: "URL deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== DEVICE MASTER (USB Device Registry) ====================
  app.get("/api/devices", authMiddleware, async (req, res) => {
    try {
      const devices = await storage.getDevices();
      res.json(devices.map(d => ({
        id: d.id,
        deviceUid: d.deviceUid || null,
        machineId: d.machineId,
        profileId: d.profileId || null,
        pcName: d.pcName || null,
        deviceName: d.deviceName,
        description: d.description,
        deviceId: d.deviceId,
        deviceManufacturer: d.deviceManufacturer,
        remark: d.remark,
        isAllowed: d.isAllowed,
        createdAt: d.createdAt?.toISOString() || null,
        updatedAt: d.updatedAt?.toISOString() || null
      })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/devices/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid device ID" });
      
      const device = await storage.getDevice(id);
      if (!device) return res.status(404).json({ error: "Device not found" });
      
      res.json({
        id: device.id,
        deviceUid: device.deviceUid || null,
        machineId: device.machineId,
        deviceName: device.deviceName,
        description: device.description,
        deviceId: device.deviceId,
        deviceManufacturer: device.deviceManufacturer,
        remark: device.remark,
        isAllowed: device.isAllowed,
        createdAt: device.createdAt?.toISOString() || null,
        updatedAt: device.updatedAt?.toISOString() || null
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/devices/machine/:machineId", authMiddleware, async (req, res) => {
    try {
      const machineId = parseInt(req.params.machineId);
      if (isNaN(machineId)) return res.status(400).json({ error: "Invalid machine ID" });
      
      const devices = await storage.getDevicesByMachine(machineId);
      res.json(devices.map(d => ({
        id: d.id,
        deviceUid: d.deviceUid || null,
        machineId: d.machineId,
        profileId: d.profileId || null,
        deviceName: d.deviceName,
        description: d.description,
        deviceId: d.deviceId,
        deviceManufacturer: d.deviceManufacturer,
        remark: d.remark,
        isAllowed: d.isAllowed,
        createdAt: d.createdAt?.toISOString() || null
      })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/devices", authMiddleware, async (req, res) => {
    try {
      const schema = z.object({
        machineId: z.number().nullable().optional(),
        profileId: z.number().nullable().optional(), // Device can be assigned to only one profile
        deviceName: z.string().min(1),
        description: z.string().optional(),
        deviceId: z.string().optional(),
        deviceManufacturer: z.string().optional(),
        remark: z.string().optional(),
        isAllowed: z.number().optional()
      });
      
      const data = schema.parse(req.body);
      const device = await storage.createDevice(data);
      
      res.status(201).json({
        id: device.id,
        machineId: device.machineId,
        profileId: device.profileId || null,
        deviceName: device.deviceName,
        description: device.description,
        deviceId: device.deviceId,
        deviceManufacturer: device.deviceManufacturer,
        remark: device.remark,
        isAllowed: device.isAllowed,
        createdAt: device.createdAt?.toISOString() || null
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/devices/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid device ID" });
      
      const schema = z.object({
        machineId: z.number().nullable().optional(),
        profileId: z.number().nullable().optional(), // Device can be assigned to only one profile
        deviceName: z.string().min(1).optional(),
        description: z.string().optional(),
        deviceId: z.string().optional(),
        deviceManufacturer: z.string().optional(),
        remark: z.string().optional(),
        isAllowed: z.number().optional()
      });
      
      const data = schema.parse(req.body);
      const device = await storage.updateDevice(id, data);
      if (!device) return res.status(404).json({ error: "Device not found" });
      
      res.json({
        id: device.id,
        machineId: device.machineId,
        profileId: device.profileId || null,
        deviceName: device.deviceName,
        description: device.description,
        deviceId: device.deviceId,
        deviceManufacturer: device.deviceManufacturer,
        remark: device.remark,
        isAllowed: device.isAllowed,
        createdAt: device.createdAt?.toISOString() || null,
        updatedAt: device.updatedAt?.toISOString() || null
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/devices/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid device ID" });
      
      const success = await storage.deleteDevice(id);
      if (!success) return res.status(404).json({ error: "Device not found" });
      
      res.json({ success: true, message: "Device deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== REPORTS ====================
  
  // Device-to-Machine mapping report
  app.get("/api/reports/devices-by-machine", authMiddleware, async (req, res) => {
    try {
      console.log('[API] Fetching devices-by-machine report...');
      const report = await storage.getDevicesByMachineReport();
      console.log('[API] Devices-by-machine report fetched:', report.length, 'machines');
      
      // Helper function to check if system is online (last_connected within 1 minute)
      const isSystemOnline = (machineOn: number | null, lastConnected: Date | null): boolean => {
        if (machineOn === 0) return false;
        if (!lastConnected) return false;
        
        const now = new Date();
        const lastConnectedTime = new Date(lastConnected);
        const diffInMs = now.getTime() - lastConnectedTime.getTime();
        const diffInMinutes = diffInMs / (1000 * 60);
        
        // If last connected is more than 1 minute ago, consider offline
        return diffInMinutes <= 1;
      };
      
      // Add calculated status to each machine in the report and serialize dates
      const reportWithStatus = report.map(machine => {
        const isOnline = isSystemOnline(machine.machineOn, machine.lastConnected);
        return {
          machineId: machine.machineId,
          pcName: machine.pcName,
          macId: machine.macId,
          machineOn: machine.machineOn,
          lastConnected: machine.lastConnected?.toISOString() || null,
          totalDevices: machine.totalDevices,
          allowedDevices: machine.allowedDevices,
          blockedDevices: machine.blockedDevices,
          status: isOnline ? 'online' : 'offline',
          devices: machine.devices.map(d => ({
            id: d.id,
            deviceUid: d.deviceUid || null,
            machineId: d.machineId,
            deviceName: d.deviceName,
            description: d.description,
            deviceId: d.deviceId,
            deviceManufacturer: d.deviceManufacturer,
            remark: d.remark,
            isAllowed: d.isAllowed,
            createdAt: d.createdAt?.toISOString() || null,
            updatedAt: d.updatedAt?.toISOString() || null
          }))
        };
      });
      
      res.json(reportWithStatus);
    } catch (error: any) {
      console.error('[API] Error fetching devices-by-machine report:', error);
      console.error('[API] Error stack:', error.stack);
      res.status(500).json({ error: error.message || 'Failed to fetch devices-by-machine report' });
    }
  });

  // USB Activity report
  app.get("/api/reports/usb-activity", authMiddleware, async (req, res) => {
    try {
      console.log('[API] Fetching USB activity report...');
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      const report = await storage.getUsbActivityReport(startDate, endDate);
      console.log('[API] USB activity report fetched:', {
        totalEvents: report.totalEvents,
        byMachine: report.byMachine.length,
        byDevice: report.byDevice.length
      });
      
      // Serialize dates in recentActivity
      const serializedReport = {
        ...report,
        recentActivity: report.recentActivity.map(log => ({
          ...log,
          connectTime: log.connectTime?.toISOString() || null,
          disconnectTime: log.disconnectTime?.toISOString() || null,
          createdAt: log.createdAt?.toISOString() || null
        }))
      };
      
      res.json(serializedReport);
    } catch (error: any) {
      console.error('[API] Error fetching USB activity report:', error);
      console.error('[API] Error stack:', error.stack);
      res.status(500).json({ error: error.message || 'Failed to fetch USB activity report' });
    }
  });

  // System Health report
  app.get("/api/reports/system-health", authMiddleware, async (req, res) => {
    try {
      const report = await storage.getSystemHealthReport();
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Device Analytics report
  app.get("/api/reports/device-analytics", authMiddleware, async (req, res) => {
    try {
      console.log('[API] Fetching device analytics report...');
      const report = await storage.getDeviceAnalyticsReport();
      console.log('[API] Device analytics report fetched:', {
        totalDevices: report.summary.totalDevices,
        byManufacturer: report.byManufacturer.length,
        byMachine: report.byMachine.length,
        recentDevices: report.recentDevices.length,
        offlineSystems: report.offlineSystems.length
      });
      
      // Helper function to safely serialize a device
      const serializeDevice = (d: any) => {
        try {
          return {
            id: d.id,
            deviceUid: d.deviceUid || null,
            machineId: d.machineId,
            pcName: d.pcName || null,
            deviceName: d.deviceName || '',
            description: d.description || null,
            deviceId: d.deviceId || null,
            deviceManufacturer: d.deviceManufacturer || null,
            remark: d.remark || null,
            isAllowed: d.isAllowed ?? 1,
            createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : (d.createdAt || null),
            updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : (d.updatedAt || null)
          };
        } catch (err) {
          console.error('[API] Error serializing device:', err, d);
          return null;
        }
      };
      
      // Convert dates to ISO strings for JSON serialization
      const serializedReport = {
        summary: report.summary,
        byManufacturer: report.byManufacturer,
        byStatus: report.byStatus,
        byMachine: report.byMachine.map(m => {
          try {
            return {
              ...m,
              lastDeviceAdded: m.lastDeviceAdded instanceof Date 
                ? m.lastDeviceAdded.toISOString() 
                : (m.lastDeviceAdded || null)
            };
          } catch (err) {
            console.error('[API] Error serializing machine:', err, m);
            return { ...m, lastDeviceAdded: null };
          }
        }),
        recentDevices: report.recentDevices.map(serializeDevice).filter(d => d !== null),
        topDevices: report.topDevices,
        offlineSystems: report.offlineSystems.map(system => {
          try {
            return {
              ...system,
              lastConnected: system.lastConnected instanceof Date 
                ? system.lastConnected.toISOString() 
                : (system.lastConnected || null),
              devices: system.devices.map(serializeDevice).filter(d => d !== null)
            };
          } catch (err) {
            console.error('[API] Error serializing offline system:', err, system);
            return {
              ...system,
              lastConnected: null,
              devices: []
            };
          }
        })
      };
      
      res.json(serializedReport);
    } catch (error: any) {
      console.error('[API] Error fetching device analytics:', error);
      console.error('[API] Error stack:', error.stack);
      res.status(500).json({ 
        error: error.message || 'Failed to fetch device analytics report',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Machine-wise device report
  app.get("/api/reports/machine-devices/:machineId", authMiddleware, async (req, res) => {
    try {
      const machineId = parseInt(req.params.machineId);
      if (isNaN(machineId)) return res.status(400).json({ error: "Invalid machine ID" });
      
      const report = await storage.getMachineDeviceReport(machineId);
      // Convert dates to ISO strings
      const serializedReport = {
        machine: report.machine ? {
          ...report.machine,
          lastConnected: report.machine.lastConnected?.toISOString() || null,
          createdAt: report.machine.createdAt?.toISOString() || null
        } : null,
        devices: report.devices.map(d => ({
          ...d,
          createdAt: d.createdAt?.toISOString() || null,
          updatedAt: d.updatedAt?.toISOString() || null
        })),
        summary: report.summary
      };
      res.json(serializedReport);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Export devices as CSV
  app.get("/api/reports/export/devices", authMiddleware, async (req, res) => {
    try {
      const devices = await storage.getDevices();
      
      const csv = [
        ['ID', 'Machine ID', 'PC Name', 'Device Name', 'Device ID', 'Manufacturer', 'Description', 'Status', 'Remark', 'Created At'].join(','),
        ...devices.map(d => [
          d.id,
          d.machineId || '',
          d.pcName || '',
          `"${(d.deviceName || '').replace(/"/g, '""')}"`,
          `"${(d.deviceId || '').replace(/"/g, '""')}"`,
          `"${(d.deviceManufacturer || '').replace(/"/g, '""')}"`,
          `"${(d.description || '').replace(/"/g, '""')}"`,
          d.isAllowed === 1 ? 'Allowed' : 'Blocked',
          `"${(d.remark || '').replace(/"/g, '""')}"`,
          d.createdAt?.toISOString() || ''
        ].join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=devices-report-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Export USB logs as CSV
  app.get("/api/reports/export/usb-logs", authMiddleware, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 1000;
      const logs = await storage.getUsbLogs(limit);
      
      const csv = [
        ['ID', 'Machine ID', 'PC Name', 'Device Name', 'Device ID', 'Manufacturer', 'Port', 'Connect Time', 'Disconnect Time', 'Status'].join(','),
        ...logs.map(l => [
          l.id,
          l.machineId,
          `"${(l.pcName || '').replace(/"/g, '""')}"`,
          `"${(l.deviceName || '').replace(/"/g, '""')}"`,
          `"${(l.deviceId || '').replace(/"/g, '""')}"`,
          `"${(l.deviceManufacturer || '').replace(/"/g, '""')}"`,
          l.devicePort || '',
          l.deviceConnectTime?.toISOString() || '',
          l.deviceDisconnectTime?.toISOString() || '',
          l.deviceDisconnectTime ? 'Removed' : 'Connected'
        ].join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=usb-logs-report-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Export systems as CSV
  app.get("/api/reports/export/systems", authMiddleware, async (req, res) => {
    try {
      const systems = await storage.getSystems();
      
      // Helper function to check if system is online (last_connected within 1 minute)
      const isSystemOnline = (machineOn: number | null, lastConnected: Date | null): boolean => {
        if (machineOn === 0) return false;
        if (!lastConnected) return false;
        
        const now = new Date();
        const lastConnectedTime = new Date(lastConnected);
        const diffInMs = now.getTime() - lastConnectedTime.getTime();
        const diffInMinutes = diffInMs / (1000 * 60);
        
        // If last connected is more than 1 minute ago, consider offline
        return diffInMinutes <= 1;
      };
      
      const csv = [
        ['Machine ID', 'PC Name', 'MAC ID', 'USB Status', 'Online Status', 'Profile', 'Last Connected', 'Created At'].join(','),
        ...systems.map(s => {
          const isOnline = isSystemOnline(s.machineOn, s.lastConnected);
          return [
            s.machineId,
            `"${(s.pcName || '').replace(/"/g, '""')}"`,
            s.macId || '',
            s.usbStatus === 1 ? 'Enabled' : 'Disabled',
            isOnline ? 'Online' : 'Offline',
            s.profile?.profileName || 'No Profile',
            s.lastConnected?.toISOString() || '',
            s.createdAt?.toISOString() || ''
          ].join(',');
        })
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=systems-report-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== HEALTH CHECK ====================
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  return httpServer;
}
