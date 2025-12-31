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
  // System registration endpoint - for desktop agents to register/update by MAC ID
  // This endpoint does NOT require authentication (agents use this)
  app.post("/api/systems/register", async (req, res) => {
    try {
      const schema = z.object({
        pcName: z.string().min(1),
        macId: z.string().min(1),
        clientTime: z.string().optional(), // ISO string of client's current time
        systemUserId: z.number().nullable().optional() // Optional system user ID to associate with
      });

      const data = schema.parse(req.body);

      const result = await storage.registerOrUpdateSystemByMacId(data.pcName, data.macId, data.clientTime, data.systemUserId);

      // Calculate time offset info for response
      let timeOffsetInfo = null;
      if (result.system.timeOffset !== null && result.system.timeOffset !== undefined) {
        const offsetMs = result.system.timeOffset;
        const offsetHours = (offsetMs / (1000 * 60 * 60)).toFixed(2);
        const offsetMinutes = (offsetMs / (1000 * 60)).toFixed(2);
        timeOffsetInfo = {
          milliseconds: offsetMs,
          hours: parseFloat(offsetHours),
          minutes: parseFloat(offsetMinutes),
          description: offsetMs > 0
            ? `Server is ${offsetHours} hours ahead of client`
            : offsetMs < 0
              ? `Client is ${Math.abs(parseFloat(offsetHours))} hours ahead of server`
              : 'Server and client times are synchronized'
        };
      }

      res.json({
        success: true,
        system: {
          machineId: result.system.machineId,
          pcName: result.system.pcName,
          macId: result.system.macId,
          machineOn: result.system.machineOn,
          lastConnected: result.system.lastConnected?.toISOString() || null,
          timeOffset: result.system.timeOffset
        },
        wasUpdated: result.wasUpdated,
        pcNameChanged: result.pcNameChanged,
        oldPcName: result.oldPcName || null,
        timeOffsetInfo: timeOffsetInfo,
        duplicateDetected: result.duplicateDetected || false,
        duplicateSystems: result.duplicateSystems?.map(s => ({
          machineId: s.machineId,
          pcName: s.pcName,
          systemUserId: s.systemUserId,
          lastConnected: s.lastConnected?.toISOString() || null
        })) || null
      });
    } catch (error: any) {
      console.error("[SYSTEM REGISTRATION ERROR]", error);
      res.status(400).json({ error: error.message });
    }
  });



  app.get("/api/systems", authMiddleware, async (req, res) => {
    try {
      const systems = await storage.getSystems();

      const systemsWithStatus = await Promise.all(systems.map(async (s) => {
        // Pass lastUpdated for accurate time-offset-aware status calculation
        const isOnline = await storage.isSystemOnline(s.machineOn, s.lastConnected, s.timeOffset, s.clientStatus ?? null, s.lastUpdated ?? null);

        // Debug logging for offline systems
        if (!isOnline) {
          const reason = s.clientStatus === 0 ? 'client_status=0 (forced offline)' :
            s.clientStatus === 1 ? 'client_status=1 (forced online) - but other checks failed' :
              s.machineOn === 0 ? 'machineOn=0' :
                !s.lastConnected ? 'no lastConnected' :
                  'timeout (lastUpdated/lastConnected > 60s ago)';
          console.log(`[DEBUG] System ${s.machineId} (${s.pcName}) marked offline:`, {
            machineOn: s.machineOn,
            clientStatus: s.clientStatus ?? null,
            lastConnected: s.lastConnected?.toISOString(),
            lastUpdated: s.lastUpdated?.toISOString(),
            timeOffset: s.timeOffset,
            reason,
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
          clientStatus: s.clientStatus ?? 0,
          clientStatusUpdatedAt: s.clientStatusUpdatedAt?.toISOString() || null,
          remark: s.remark,
          createdAt: s.createdAt?.toISOString() || null,
          status: isOnline ? 'online' : 'offline',
          systemUserId: s.systemUserId,
          systemUser: s.systemUser ? {
            systemUserId: s.systemUser.systemUserId,
            systemUserName: s.systemUser.systemUserName,
            usbPolicy: s.systemUser.usbPolicy
          } : null
        };
      }));

      res.json(systemsWithStatus);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // IMPORTANT: Specific routes must come BEFORE parameterized routes like /:id
  // ==================== DUPLICATE MAC ID MANAGEMENT ====================
  // Get all duplicate MAC IDs
  app.get("/api/systems/duplicates", authMiddleware, async (req, res) => {
    try {
      console.log('[API] Fetching duplicate MAC IDs...');
      const duplicates = await storage.getDuplicateMacIds();
      console.log(`[API] Found ${duplicates.length} duplicate MAC ID groups`);

      const response = duplicates.map(dup => ({
        macId: dup.macId,
        count: dup.count,
        systems: dup.systems.map(s => ({
          machineId: s.machineId,
          pcName: s.pcName,
          macId: s.macId,
          systemUserId: s.systemUserId,
          lastConnected: s.lastConnected?.toISOString() || null,
          createdAt: s.createdAt?.toISOString() || null
        }))
      }));

      console.log(`[API] Returning ${response.length} duplicate groups`);
      res.json(response);
    } catch (error: any) {
      console.error('[API] Error fetching duplicate MAC IDs:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Merge duplicate MAC IDs - keep one system and merge others into it
  app.post("/api/systems/duplicates/merge", authMiddleware, async (req, res) => {
    try {
      const schema = z.object({
        macId: z.string().min(1),
        keepMachineId: z.number(), // The system to keep
        mergeMachineIds: z.array(z.number()) // Systems to merge into the kept one
      });

      const data = schema.parse(req.body);

      const result = await storage.mergeDuplicateMacId(data.macId, data.keepMachineId, data.mergeMachineIds);

      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Sync/Merge all duplicate MAC IDs in the database
  app.post("/api/systems/sync-duplicates", authMiddleware, async (req, res) => {
    try {
      console.log('[API] Syncing duplicate MAC IDs...');

      // Use the autoMergeDuplicateMacIds function logic
      let duplicates;
      try {
        duplicates = await storage.getDuplicateMacIds();
      } catch (fetchError: any) {
        console.error('[API] Error fetching duplicate MAC IDs:', fetchError);
        return res.status(500).json({
          success: false,
          error: `Failed to fetch duplicate MAC IDs: ${fetchError.message}`,
          merged: 0,
          groups: 0
        });
      }

      if (duplicates.length === 0) {
        return res.json({
          success: true,
          merged: 0,
          groups: 0,
          message: 'No duplicate MAC IDs found in the database'
        });
      }

      console.log(`[API] Found ${duplicates.length} duplicate MAC ID groups`);

      let totalMerged = 0;

      for (const duplicate of duplicates) {
        try {
          const normalizedMacId = duplicate.macId.trim().toUpperCase();
          const systems = duplicate.systems;

          if (systems.length < 2) continue;

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

          // Automatically merge duplicates
          const mergeResult = await storage.mergeDuplicateMacId(normalizedMacId, keepSystem.machineId, mergeMachineIds);

          if (mergeResult.success && mergeResult.merged > 0) {
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
            } catch (notifError: any) {
              console.error(`[API] Failed to create notification (merge was successful):`, notifError);
            }

            totalMerged += mergeResult.merged;
          }
        } catch (error: any) {
          console.error(`[API] Error merging duplicates for MAC ID ${duplicate.macId}:`, error);
          // Continue with next duplicate group
        }
      }

      console.log(`[API] Sync completed: Merged ${totalMerged} duplicate systems across ${duplicates.length} MAC ID groups`);

      res.json({
        success: true,
        merged: totalMerged,
        groups: duplicates.length,
        message: `Successfully merged ${totalMerged} duplicate system(s) from ${duplicates.length} MAC ID group(s)`
      });
    } catch (error: any) {
      console.error('[API] Error syncing duplicate MAC IDs:', error);
      console.error('[API] Error stack:', error.stack);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to sync duplicate MAC IDs',
        merged: 0,
        groups: 0
      });
    }
  });

  // MOVED UP: Specific routes first
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

  app.get("/api/systems/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid system ID" });

      const system = await storage.getSystem(id);
      if (!system) return res.status(404).json({ error: "System not found" });

      const isOnline = await storage.isSystemOnline(system.machineOn, system.lastConnected, system.timeOffset, system.clientStatus ?? null);

      res.json({
        machineId: system.machineId,
        machineUid: system.machineUid || null,
        pcName: system.pcName,
        macId: system.macId,
        usbStatus: system.usbStatus,
        machineOn: system.machineOn,
        lastConnected: system.lastConnected?.toISOString() || null,
        clientStatus: system.clientStatus ?? 0,
        clientStatusUpdatedAt: system.clientStatusUpdatedAt?.toISOString() || null,
        remark: system.remark,
        createdAt: system.createdAt?.toISOString() || null,
        status: isOnline ? 'online' : 'offline',
        systemUserId: system.systemUserId,
        systemUser: system.systemUser ? {
          systemUserId: system.systemUser.systemUserId,
          systemUserName: system.systemUser.systemUserName,
          usbPolicy: system.systemUser.usbPolicy
        } : null
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });




  // MOVED UP: Bulk USB control first
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

      res.json({
        success: true, system: {
          machineId: system.machineId,
          pcName: system.pcName,
          usbStatus: system.usbStatus
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });




  // MOVED UP: Bulk assign system user first
  app.put("/api/systems/bulk/system-user", authMiddleware, async (req, res) => {
    try {
      const schema = z.object({
        machineIds: z.array(z.number()),
        systemUserId: z.number().nullable()
      });

      const data = schema.parse(req.body);
      const affected = await storage.bulkAssignSystemUser(data.machineIds, data.systemUserId);

      res.json({ success: true, affected });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Assign system user to a system

  app.put("/api/systems/:id/system-user", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid system ID" });

      const schema = z.object({
        systemUserId: z.number().nullable()
      });

      const data = schema.parse(req.body);

      const system = await storage.assignSystemUserToSystem(id, data.systemUserId);
      if (!system) return res.status(404).json({ error: "System not found" });

      res.json({
        success: true, system: {
          machineId: system.machineId,
          pcName: system.pcName,
          systemUserId: system.systemUserId
        }
      });
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

      // Get system to check online status
      const system = await storage.getSystem(id);

      const logsWithStatus = await Promise.all(logs.map(async (log) => {
        let deviceStatus: string;

        // If device has a disconnect time, it's removed
        if (log.deviceDisconnectTime) {
          deviceStatus = 'Removed';
        } else {
          // Device doesn't have disconnect time - check if system is online
          if (system) {
            const isSystemOnline = await storage.isSystemOnline(
              system.machineOn,
              system.lastConnected,
              system.timeOffset,
              system.clientStatus ?? null
            );
            // If system is offline, device is automatically disconnected
            deviceStatus = isSystemOnline ? 'Connected' : 'Disconnected';
          } else {
            // System not found - assume disconnected
            deviceStatus = 'Disconnected';
          }
        }

        return {
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
          status: deviceStatus,
          deviceId: log.deviceId,
          createdAt: log.createdAt?.toISOString() || null
        };
      }));

      res.json(logsWithStatus);
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

  // ==================== SYSTEM USERS ====================
  app.get("/api/system-users", authMiddleware, async (req, res) => {
    try {
      const systemUsersList = await storage.getSystemUsers();

      const systemUsersWithStatus = await Promise.all(systemUsersList.map(async (su) => ({
        systemUserId: su.systemUserId,
        systemUserUid: su.systemUserUid || null,
        systemUserName: su.systemUserName,
        description: su.description,
        isActive: su.isActive,
        usbPolicy: su.usbPolicy,
        assignedCount: su.assignedCount,
        machines: await Promise.all(su.machines.map(async (m) => {
          const isOnline = await storage.isSystemOnline(m.machineOn, m.lastConnected, m.timeOffset, m.clientStatus ?? null);
          return {
            machineId: m.machineId,
            pcName: m.pcName,
            macId: m.macId,
            usbStatus: m.usbStatus,
            machineOn: m.machineOn,
            clientStatus: m.clientStatus ?? 0,
            status: isOnline ? 'online' : 'offline',
            lastConnected: m.lastConnected?.toISOString() || null
          };
        })),
        createdAt: su.createdAt?.toISOString() || null
      })));

      res.json(systemUsersWithStatus);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/system-users/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid system user ID" });

      const systemUser = await storage.getSystemUser(id);
      if (!systemUser) return res.status(404).json({ error: "System user not found" });

      res.json({
        systemUserId: systemUser.systemUserId,
        systemUserUid: systemUser.systemUserUid || null,
        systemUserName: systemUser.systemUserName,
        description: systemUser.description,
        isActive: systemUser.isActive,
        usbPolicy: systemUser.usbPolicy,
        assignedCount: systemUser.assignedCount,
        machines: await Promise.all(systemUser.machines.map(async (m) => {
          const isOnline = await storage.isSystemOnline(m.machineOn, m.lastConnected, m.timeOffset, m.clientStatus ?? null);
          return {
            machineId: m.machineId,
            pcName: m.pcName,
            macId: m.macId,
            usbStatus: m.usbStatus,
            machineOn: m.machineOn,
            clientStatus: m.clientStatus ?? 0,
            status: isOnline ? 'online' : 'offline',
            lastConnected: m.lastConnected?.toISOString() || null
          };
        })),
        createdAt: systemUser.createdAt?.toISOString() || null
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/system-users", authMiddleware, async (req, res) => {
    try {
      console.log("POST /api/system-users - Request body:", JSON.stringify(req.body, null, 2));

      // Preprocess: convert empty strings to undefined, string numbers to numbers
      const preprocessed = {
        ...req.body,
        description: req.body.description && req.body.description.trim() ? req.body.description.trim() : undefined,
        usbPolicy: req.body.usbPolicy !== undefined ? (typeof req.body.usbPolicy === 'string' ? parseInt(req.body.usbPolicy, 10) : req.body.usbPolicy) : undefined,
        isActive: req.body.isActive !== undefined ? (typeof req.body.isActive === 'string' ? parseInt(req.body.isActive, 10) : req.body.isActive) : undefined
      };

      const schema = z.object({
        systemUserName: z.string().min(1),
        description: z.string().optional(),
        usbPolicy: z.number().optional(),
        isActive: z.number().optional()
      });

      const data = schema.parse(preprocessed);
      console.log("POST /api/system-users - Parsed data:", JSON.stringify(data, null, 2));

      const systemUser = await storage.createSystemUser(data);
      console.log("POST /api/system-users - Created system user:", systemUser.systemUserId);

      // Return in the same format as GET /api/system-users
      try {
        const systemUserWithMachines = await storage.getSystemUser(systemUser.systemUserId);
        if (systemUserWithMachines) {
          return res.status(201).json({
            systemUserId: systemUserWithMachines.systemUserId,
            systemUserUid: systemUserWithMachines.systemUserUid || null,
            systemUserName: systemUserWithMachines.systemUserName,
            description: systemUserWithMachines.description,
            isActive: systemUserWithMachines.isActive,
            usbPolicy: systemUserWithMachines.usbPolicy,
            assignedCount: systemUserWithMachines.assignedCount,
            machines: await Promise.all(systemUserWithMachines.machines.map(async (m) => {
              const isOnline = await storage.isSystemOnline(m.machineOn, m.lastConnected, m.timeOffset, m.clientStatus ?? null);
              return {
                machineId: m.machineId,
                pcName: m.pcName,
                macId: m.macId,
                usbStatus: m.usbStatus,
                machineOn: m.machineOn,
                clientStatus: m.clientStatus ?? 0,
                status: isOnline ? 'online' : 'offline',
                lastConnected: m.lastConnected?.toISOString() || null
              };
            })),
            createdAt: systemUserWithMachines.createdAt?.toISOString() || null
          });
        }
      } catch (getSystemUserError: any) {
        console.error("Error fetching system user with machines, using fallback:", getSystemUserError);
      }

      // Fallback to basic system user if getSystemUser fails
      return res.status(201).json({
        systemUserId: systemUser.systemUserId,
        systemUserUid: systemUser.systemUserUid || null,
        systemUserName: systemUser.systemUserName,
        description: systemUser.description,
        isActive: systemUser.isActive,
        usbPolicy: systemUser.usbPolicy,
        assignedCount: 0,
        machines: [],
        createdAt: systemUser.createdAt?.toISOString() || null
      });
    } catch (error: any) {
      console.error("Error creating system user:", error);
      console.error("Error stack:", error.stack);
      // Check if it's a Zod validation error
      if (error.name === 'ZodError' || error.issues) {
        const zodError = error.issues || error.errors;
        const errorMessage = zodError?.[0]?.message || error.message || 'Validation error';
        console.error("Zod validation error:", JSON.stringify(zodError, null, 2));
        return res.status(400).json({ error: errorMessage });
      }
      res.status(400).json({ error: error.message || 'Failed to create system user' });
    }
  });

  app.put("/api/system-users/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid system user ID" });

      const schema = z.object({
        systemUserName: z.string().min(1).optional(),
        description: z.string().optional(),
        usbPolicy: z.number().optional(),
        isActive: z.number().optional()
      });

      const data = schema.parse(req.body);
      const systemUser = await storage.updateSystemUser(id, data);
      if (!systemUser) return res.status(404).json({ error: "System user not found" });

      res.json({
        systemUserId: systemUser.systemUserId,
        systemUserName: systemUser.systemUserName,
        description: systemUser.description,
        isActive: systemUser.isActive,
        usbPolicy: systemUser.usbPolicy,
        createdAt: systemUser.createdAt?.toISOString() || null
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/system-users/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid system user ID" });

      const success = await storage.deleteSystemUser(id);
      if (!success) return res.status(404).json({ error: "System user not found" });

      res.json({ success: true, message: "System user deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Apply USB policy from system user to all assigned machines
  app.post("/api/system-users/:id/apply-policy", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid system user ID" });

      const affected = await storage.applySystemUserUsbPolicy(id);

      // Get machines assigned to this system user and send commands
      const systemUser = await storage.getSystemUser(id);
      if (systemUser) {
        const command = systemUser.usbPolicy === 1 ? "EnableUsb" : "DisableUsb";
        for (const machine of systemUser.machines) {
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

  // Bulk URL creation
  app.post("/api/urls/bulk", authMiddleware, async (req, res) => {
    try {
      const schema = z.object({
        urls: z.array(z.string()).min(1, "At least one URL is required")
      });

      const data = schema.parse(req.body);
      const result = await storage.createBulkUrls(data.urls, 'allowed');

      res.status(201).json({
        success: result.success,
        failed: result.failed,
        errors: result.errors,
        message: `Successfully added ${result.success} URL(s)${result.failed > 0 ? `, ${result.failed} failed` : ''}`
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Bulk URL deletion
  app.delete("/api/urls/bulk", authMiddleware, async (req, res) => {
    try {
      const schema = z.object({
        ids: z.array(z.number()).min(1, "At least one URL ID is required")
      });

      const data = schema.parse(req.body);
      const result = await storage.deleteBulkUrls(data.ids);

      res.json({
        success: true,
        deleted: result.deleted,
        message: `Successfully deleted ${result.deleted} URL(s)`
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
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




  app.get("/api/devices", authMiddleware, async (req, res) => {
    try {
      const devices = await storage.getDevices();
      res.json(devices.map(d => ({
        id: d.id,
        deviceUid: d.deviceUid || null,
        machineId: d.machineId,
        systemUserId: d.systemUserId || null,
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
        systemUserId: d.systemUserId || null,
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
        systemUserId: z.number().nullable().optional(), // Device can be assigned to only one system user
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
        systemUserId: z.number().nullable().optional(), // Device can be assigned to only one system user
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

      // Add calculated status to each machine in the report and serialize dates
      const reportWithStatus = await Promise.all(report.map(async (machine) => {
        const isOnline = await storage.isSystemOnline(machine.machineOn, machine.lastConnected, machine.timeOffset, machine.clientStatus ?? null);
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
      }));

      res.json(reportWithStatus);
    } catch (error: any) {
      console.error('[API] Error fetching devices-by-machine report:', error);
      console.error('[API] Error stack:', error.stack);
      res.status(500).json({ error: error.message || 'Failed to fetch devices-by-machine report' });
    }
  });

  // USB Activity report
  // USB Activity endpoint removed

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
          id: d.id,
          deviceUid: d.deviceUid || null,
          machineId: d.machineId,
          systemUserId: d.systemUserId || null,
          deviceName: d.deviceName,
          description: d.description || null,
          deviceId: d.deviceId,
          deviceManufacturer: d.deviceManufacturer,
          remark: d.remark,
          isAllowed: d.isAllowed,
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

      // Get all systems to check online status
      const systems = await storage.getSystems();
      const systemsMap = new Map(systems.map(s => [s.machineId, s]));

      const csv = [
        ['ID', 'Machine ID', 'PC Name', 'Device Name', 'Device ID', 'Manufacturer', 'Port', 'Connect Time', 'Disconnect Time', 'Status'].join(','),
        ...(await Promise.all(logs.map(async (l) => {
          let deviceStatus: string;
          if (l.deviceDisconnectTime) {
            deviceStatus = 'Removed';
          } else {
            const system = systemsMap.get(l.machineId);
            if (system) {
              const isSystemOnline = await storage.isSystemOnline(
                system.machineOn,
                system.lastConnected,
                system.timeOffset,
                system.clientStatus ?? null
              );
              deviceStatus = isSystemOnline ? 'Connected' : 'Disconnected';
            } else {
              deviceStatus = 'Disconnected';
            }
          }

          return [
            l.id,
            l.machineId,
            `"${(l.pcName || '').replace(/"/g, '""')}"`,
            `"${(l.deviceName || '').replace(/"/g, '""')}"`,
            `"${(l.deviceId || '').replace(/"/g, '""')}"`,
            `"${(l.deviceManufacturer || '').replace(/"/g, '""')}"`,
            l.devicePort || '',
            l.deviceConnectTime?.toISOString() || '',
            l.deviceDisconnectTime?.toISOString() || '',
            deviceStatus
          ].join(',');
        })))
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

      const csv = [
        ['Machine ID', 'PC Name', 'MAC ID', 'USB Status', 'Online Status', 'System User', 'Last Connected', 'Created At'].join(','),
        ...(await Promise.all(systems.map(async (s) => {
          const isOnline = await storage.isSystemOnline(s.machineOn, s.lastConnected, s.timeOffset, s.clientStatus ?? null);
          return [
            s.machineId,
            `"${(s.pcName || '').replace(/"/g, '""')}"`,
            s.macId || '',
            s.usbStatus === 1 ? 'Enabled' : 'Disabled',
            isOnline ? 'Online' : 'Offline',
            s.systemUser?.systemUserName || 'No System User',
            s.lastConnected?.toISOString() || '',
            s.createdAt?.toISOString() || ''
          ].join(',');
        })))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=systems-report-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== SYSTEM NOTIFICATIONS ====================
  app.get("/api/notifications", authMiddleware, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const unreadOnly = req.query.unreadOnly === 'true';

      const notifications = await storage.getNotifications(limit, unreadOnly);

      res.json(notifications.map(n => ({
        id: n.id,
        notificationUid: n.notificationUid || null,
        machineId: n.machineId,
        notificationType: n.notificationType,
        title: n.title,
        message: n.message,
        oldValue: n.oldValue || null,
        newValue: n.newValue || null,
        macId: n.macId || null,
        isRead: n.isRead,
        createdAt: n.createdAt?.toISOString() || null
      })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/notifications/unread-count", authMiddleware, async (req, res) => {
    try {
      const count = await storage.getUnreadNotificationCount();
      res.json({ count });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/notifications/:id/read", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid notification ID" });

      const notification = await storage.markNotificationAsRead(id);
      if (!notification) return res.status(404).json({ error: "Notification not found" });

      res.json({
        success: true,
        notification: {
          id: notification.id,
          isRead: notification.isRead
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/notifications/read-all", authMiddleware, async (req, res) => {
    try {
      const affected = await storage.markAllNotificationsAsRead();
      res.json({ success: true, affected });
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
