import { randomUUID } from "crypto";
import { db } from "./db";
import {
  clientMaster,
  clientUsbStatus,
  systemUsers,
  urlMaster,
  deviceMaster,
  admins,
  systemNotifications,
  type ClientMaster,
  type ClientUsbStatus,
  type SystemUser,
  type UrlMaster,
  type DeviceMaster,
  type Admin,
  type InsertClientMaster,
  type InsertClientUsbStatus,
  type InsertSystemUser,
  type InsertUrlMaster,
  type InsertDeviceMaster,
  type InsertAdmin,
  type InsertSystemNotification,
  type SystemNotification,
  type DashboardStats,
  type ClientWithSystemUser,
  type SystemUserWithMachines,
  type DeviceMasterWithDescription
} from "../shared/schema";
import { eq, desc, and, sql, gte, isNull, count, inArray, max, ne } from "drizzle-orm";

export interface IStorage {
  // Admins
  getAdminByEmail(email: string): Promise<Admin | undefined>;
  createAdmin(admin: InsertAdmin): Promise<Admin>;
  getAdmins(): Promise<Admin[]>;
  getAdmin(id: number): Promise<Admin | undefined>;
  updateAdmin(id: number, updates: Partial<Admin>): Promise<Admin | undefined>;
  updateAdminPassword(id: number, passwordHash: string): Promise<Admin | undefined>;
  updateAdminStatus(id: number, status: number): Promise<Admin | undefined>;
  updateAdminLastLogin(id: number): Promise<Admin | undefined>;
  deleteAdmin(id: number): Promise<boolean>;

  // Client Master (Systems)
  getSystems(): Promise<ClientWithSystemUser[]>;
  getSystem(machineId: number): Promise<ClientWithSystemUser | undefined>;
  getSystemByMacId(macId: string): Promise<ClientMaster | undefined>;
  createSystem(system: InsertClientMaster): Promise<ClientMaster>;
  updateSystem(machineId: number, updates: Partial<ClientMaster>): Promise<ClientMaster | undefined>;
  deleteSystem(machineId: number): Promise<boolean>;
  updateSystemUsbStatus(machineId: number, usbStatus: number): Promise<ClientMaster | undefined>;
  bulkUpdateUsbStatus(machineIds: number[], usbStatus: number): Promise<number>;
  getDisconnectedSystems(dayThreshold: number): Promise<ClientMaster[]>;
  assignSystemUserToSystem(machineId: number, systemUserId: number | null): Promise<ClientMaster | undefined>;
  bulkAssignSystemUser(machineIds: number[], systemUserId: number | null): Promise<number>;
  getSystemsBySystemUser(systemUserId: number): Promise<ClientMaster[]>;

  // USB Logs
  getUsbLogs(limit?: number): Promise<(ClientUsbStatus & { pcName?: string })[]>;
  getUsbLogsByMachine(machineId: number, limit?: number): Promise<ClientUsbStatus[]>;
  getConnectedUsbDevices(): Promise<(ClientUsbStatus & { pcName?: string })[]>;
  createUsbLog(log: InsertClientUsbStatus): Promise<ClientUsbStatus>;
  updateUsbLog(id: number, updates: Partial<ClientUsbStatus>): Promise<ClientUsbStatus | undefined>;

  // System Users
  getSystemUsers(): Promise<SystemUserWithMachines[]>;
  getSystemUser(systemUserId: number): Promise<SystemUserWithMachines | undefined>;
  createSystemUser(systemUser: InsertSystemUser): Promise<SystemUser>;
  updateSystemUser(systemUserId: number, updates: Partial<SystemUser>): Promise<SystemUser | undefined>;
  deleteSystemUser(systemUserId: number): Promise<boolean>;
  applySystemUserUsbPolicy(systemUserId: number): Promise<number>;

  // URL Master (Website Access Control)
  getUrls(): Promise<UrlMaster[]>;
  getUrl(id: number): Promise<UrlMaster | undefined>;
  createUrl(url: InsertUrlMaster): Promise<UrlMaster>;
  updateUrl(id: number, updates: Partial<UrlMaster>): Promise<UrlMaster | undefined>;
  deleteUrl(id: number): Promise<boolean>;

  // Device Master (System-wide USB Device Registry)
  getDevices(): Promise<(DeviceMasterWithDescription & { pcName?: string })[]>;
  getDevice(id: number): Promise<DeviceMasterWithDescription | undefined>;
  getDevicesByMachine(machineId: number): Promise<DeviceMasterWithDescription[]>;
  getDeviceByDeviceId(deviceId: string): Promise<DeviceMasterWithDescription | undefined>;
  createDevice(device: InsertDeviceMaster): Promise<DeviceMasterWithDescription>;
  updateDevice(id: number, updates: Partial<DeviceMaster>): Promise<DeviceMasterWithDescription | undefined>;
  deleteDevice(id: number): Promise<boolean>;

  // Device Reports
  getDeviceAnalyticsReport(): Promise<{
    summary: {
      totalDevices: number;
      allowedDevices: number;
      blockedDevices: number;
      devicesWithMachines: number;
      orphanedDevices: number;
    };
    byManufacturer: { manufacturer: string; count: number; allowed: number; blocked: number }[];
    byStatus: { status: string; count: number }[];
    byMachine: { machineId: number; pcName: string; macId: string; totalDevices: number; allowedDevices: number; blockedDevices: number; lastDeviceAdded: Date | null; isOnline: boolean }[];
    recentDevices: (DeviceMaster & { pcName?: string })[];
    topDevices: { deviceName: string; count: number; machines: number }[];
    offlineSystems: { machineId: number; pcName: string; macId: string; lastConnected: Date | null; totalDevices: number; allowedDevices: number; blockedDevices: number; devices: DeviceMaster[] }[];
  }>;
  getMachineDeviceReport(machineId: number): Promise<{
    machine: ClientMaster | null;
    devices: DeviceMasterWithDescription[];
    summary: {
      totalDevices: number;
      allowedDevices: number;
      blockedDevices: number;
      byManufacturer: { manufacturer: string; count: number }[];
    };
  }>;

  // Dashboard Stats
  getDashboardStats(): Promise<DashboardStats>;

  // System Registration (with MAC ID matching and PC name change detection)
  registerOrUpdateSystemByMacId(pcName: string, macId: string, clientTime?: string, systemUserId?: number | null): Promise<{ system: ClientMaster; wasUpdated: boolean; pcNameChanged: boolean; oldPcName?: string; duplicateDetected?: boolean; duplicateSystems?: ClientMaster[]; mergedCount?: number }>;

  // System Notifications
  createNotification(notification: InsertSystemNotification): Promise<SystemNotification>;
  getNotifications(limit?: number, unreadOnly?: boolean): Promise<SystemNotification[]>;
  markNotificationAsRead(id: number): Promise<SystemNotification | undefined>;
  markAllNotificationsAsRead(): Promise<number>;
  getUnreadNotificationCount(): Promise<number>;
}

class DatabaseStorage implements IStorage {
  // ==================== HELPER METHODS ====================
  // Note: Database server time logic removed - using application server time instead
  // Online/offline status is now primarily determined by client_status field

  /**
   * Check if a system is online
   * Priority order:
   * 1. client_status field takes precedence (1=online, 0=offline)
   * 2. lastUpdated (server timestamp) - most reliable as it's always in server time
   * 3. lastConnected with timeOffset adjustment - fallback for compatibility
   * 
   * @param machineOn - Machine on/off flag
   * @param lastConnected - Client's reported connection time (may be in client timezone like IST)
   * @param timeOffset - Calculated offset in ms: server_time - client_time (e.g., for IST client: ~-19800000ms = -5.5hrs)
   * @param clientStatus - Client-reported status (1=online, 0=offline)
   * @param lastUpdated - Server's timestamp when record was updated (always in server/UTC time)
   */
  async isSystemOnline(
    machineOn: number | null,
    lastConnected: Date | null,
    timeOffset: number | null,
    clientStatus: number | null = null,
    lastUpdated: Date | null = null
  ): Promise<boolean> {
    // PRIORITY 1: client_status takes precedence
    if (clientStatus === 1) return true;
    if (clientStatus === 0) return false;

    // PRIORITY 2: machineOn flag
    if (machineOn === 0) return false;

    const now = new Date();
    const ONLINE_THRESHOLD_SECONDS = 60; // 60 seconds threshold for online status

    // PRIORITY 3: Use lastUpdated (server timestamp) - most reliable
    // This is set by the server on each update, so it's always in server time
    if (lastUpdated) {
      const lastUpdatedTime = lastUpdated instanceof Date ? lastUpdated : new Date(lastUpdated);
      if (!isNaN(lastUpdatedTime.getTime())) {
        const diffInMs = now.getTime() - lastUpdatedTime.getTime();
        const diffInSeconds = diffInMs / 1000;

        // System is online if lastUpdated is within threshold
        if (diffInSeconds >= 0 && diffInSeconds <= ONLINE_THRESHOLD_SECONDS) {
          return true;
        }
      }
    }

    // PRIORITY 4: Use lastConnected with timeOffset adjustment
    if (!lastConnected) return false;

    const lastConnectedTime = lastConnected instanceof Date ? lastConnected : new Date(lastConnected);
    if (isNaN(lastConnectedTime.getTime())) {
      return false;
    }

    // Apply time offset if available
    // timeOffset = server_time - client_time
    // So: adjusted_time = lastConnected + timeOffset (converts client time to server time)
    let adjustedLastConnected = lastConnectedTime.getTime();
    if (timeOffset !== null && timeOffset !== undefined) {
      adjustedLastConnected = lastConnectedTime.getTime() + timeOffset;
    }

    const diffInMs = now.getTime() - adjustedLastConnected;
    const diffInSeconds = diffInMs / 1000;

    // System is online if adjusted time is within threshold
    return diffInSeconds >= 0 && diffInSeconds <= ONLINE_THRESHOLD_SECONDS;
  }

  // ==================== ADMIN METHODS ====================
  private async fetchAdminById(id: number): Promise<Admin | undefined> {
    const result = await db.select().from(admins).where(eq(admins.id, id)).limit(1);
    return result[0];
  }

  async getAdminByEmail(email: string): Promise<Admin | undefined> {
    const result = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
    return result[0];
  }

  async createAdmin(admin: InsertAdmin): Promise<Admin> {
    const result = await db.insert(admins).values(admin);
    const insertedId = (result as any).insertId as number | undefined;
    const created = insertedId ? await this.fetchAdminById(insertedId) : await this.getAdminByEmail(admin.email);
    if (!created) {
      throw new Error("Failed to create admin");
    }
    return created;
  }

  async getAdmins(): Promise<Admin[]> {
    return await db.select().from(admins).orderBy(desc(admins.createdAt));
  }

  async getAdmin(id: number): Promise<Admin | undefined> {
    return this.fetchAdminById(id);
  }

  async updateAdmin(id: number, updates: Partial<Admin>): Promise<Admin | undefined> {
    await db.update(admins).set({ ...updates, updatedAt: new Date() }).where(eq(admins.id, id));
    return this.fetchAdminById(id);
  }

  async updateAdminPassword(id: number, passwordHash: string): Promise<Admin | undefined> {
    await db.update(admins).set({ passwordHash, updatedAt: new Date() }).where(eq(admins.id, id));
    return this.fetchAdminById(id);
  }

  async updateAdminStatus(id: number, status: number): Promise<Admin | undefined> {
    await db.update(admins).set({ status, updatedAt: new Date() }).where(eq(admins.id, id));
    return this.fetchAdminById(id);
  }

  async updateAdminLastLogin(id: number): Promise<Admin | undefined> {
    await db.update(admins).set({ lastLogin: new Date() }).where(eq(admins.id, id));
    return this.fetchAdminById(id);
  }

  async deleteAdmin(id: number): Promise<boolean> {
    const result = await db.delete(admins).where(eq(admins.id, id));
    return (result as any).affectedRows !== undefined ? (result as any).affectedRows > 0 : true;
  }

  // ==================== CLIENT MASTER (SYSTEMS) METHODS ====================
  async getSystems(): Promise<ClientWithSystemUser[]> {
    // Use raw SQL to avoid column issues with client_status_updated_at
    try {
      // Check if client_status column exists
      const checkStatus = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'client_master'
        AND COLUMN_NAME = 'client_status'
      `);
      const hasClientStatus = Array.isArray(checkStatus) && Array.isArray(checkStatus[0])
        ? (checkStatus[0] as any[])[0]?.count > 0
        : (checkStatus as any[])[0]?.count > 0;

      // Check if client_status_updated_at column exists
      const checkUpdatedAt = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'client_master'
        AND COLUMN_NAME = 'client_status_updated_at'
      `);
      const hasClientStatusUpdatedAt = Array.isArray(checkUpdatedAt) && Array.isArray(checkUpdatedAt[0])
        ? (checkUpdatedAt[0] as any[])[0]?.count > 0
        : (checkUpdatedAt as any[])[0]?.count > 0;

      // Build SQL query based on available columns
      let sqlQuery;
      if (hasClientStatus && hasClientStatusUpdatedAt) {
        sqlQuery = sql`
          SELECT 
            cm.machine_id, cm.machine_uid, cm.pc_name, cm.mac_id, cm.usb_status, cm.machine_on,
            cm.last_connected, cm.time_offset, cm.client_status, cm.client_status_updated_at,
            cm.last_updated, cm.remark, cm.created_at, cm.profile_id,
            pm.profile_id as system_user_id, pm.profile_name as system_user_name, pm.usb_policy
          FROM client_master cm
          LEFT JOIN profile_master pm ON cm.profile_id = pm.profile_id
          ORDER BY cm.last_connected DESC
        `;
      } else if (hasClientStatus) {
        sqlQuery = sql`
          SELECT 
            cm.machine_id, cm.machine_uid, cm.pc_name, cm.mac_id, cm.usb_status, cm.machine_on,
            cm.last_connected, cm.time_offset, cm.client_status,
            cm.last_updated, cm.remark, cm.created_at, cm.profile_id,
            pm.profile_id as system_user_id, pm.profile_name as system_user_name, pm.usb_policy
          FROM client_master cm
          LEFT JOIN profile_master pm ON cm.profile_id = pm.profile_id
          ORDER BY cm.last_connected DESC
        `;
      } else {
        sqlQuery = sql`
          SELECT 
            cm.machine_id, cm.machine_uid, cm.pc_name, cm.mac_id, cm.usb_status, cm.machine_on,
            cm.last_connected, cm.time_offset,
            cm.last_updated, cm.remark, cm.created_at, cm.profile_id,
            pm.profile_id as system_user_id, pm.profile_name as system_user_name, pm.usb_policy
          FROM client_master cm
          LEFT JOIN profile_master pm ON cm.profile_id = pm.profile_id
          ORDER BY cm.last_connected DESC
        `;
      }

      const result = await db.execute(sqlQuery);

      // Extract rows from result (handle nested array structure)
      let rows: any[] = [];
      if (Array.isArray(result) && result.length > 0) {
        if (Array.isArray(result[0])) {
          rows = result[0];
        } else if (typeof result[0] === 'object' && result[0].machine_id !== undefined) {
          rows = result;
        }
      }

      return rows.map((row: any) => ({
        machineId: row.machine_id,
        machineUid: row.machine_uid || null,
        pcName: row.pc_name,
        macId: row.mac_id,
        usbStatus: row.usb_status,
        machineOn: row.machine_on,
        lastConnected: row.last_connected ? new Date(row.last_connected) : null,
        timeOffset: row.time_offset,
        clientStatus: hasClientStatus ? (row.client_status ?? null) : null,
        clientStatusUpdatedAt: hasClientStatusUpdatedAt ? (row.client_status_updated_at ? new Date(row.client_status_updated_at) : null) : null,
        lastUpdated: row.last_updated ? new Date(row.last_updated) : null,
        remark: row.remark || null,
        createdAt: row.created_at ? new Date(row.created_at) : null,
        systemUserId: row.profile_id || null,
        systemUser: row.system_user_id ? {
          systemUserId: row.system_user_id,
          systemUserName: row.system_user_name,
          usbPolicy: row.usb_policy || 0
        } : null,
      }));
    } catch (error: any) {
      console.error('[getSystems] Error fetching systems:', error);
      throw error;
    }
  }

  async getSystem(machineId: number): Promise<ClientWithSystemUser | undefined> {
    try {
      const result = await db
        .select({
          machineId: clientMaster.machineId,
          pcName: clientMaster.pcName,
          macId: clientMaster.macId,
          usbStatus: clientMaster.usbStatus,
          machineOn: clientMaster.machineOn,
          lastConnected: clientMaster.lastConnected,
          timeOffset: clientMaster.timeOffset,
          clientStatus: clientMaster.clientStatus,
          clientStatusUpdatedAt: clientMaster.clientStatusUpdatedAt,
          remark: clientMaster.remark,
          createdAt: clientMaster.createdAt,
          systemUserId: clientMaster.systemUserId,
          systemUser: systemUsers,
        })
        .from(clientMaster)
        .leftJoin(systemUsers, eq(clientMaster.systemUserId, systemUsers.systemUserId))
        .where(eq(clientMaster.machineId, machineId))
        .limit(1);

      if (!result[0]) return undefined;

      const row = result[0];
      return {
        machineId: row.machineId,
        pcName: row.pcName,
        macId: row.macId,
        usbStatus: row.usbStatus,
        machineOn: row.machineOn,
        lastConnected: row.lastConnected,
        timeOffset: row.timeOffset,
        clientStatus: row.clientStatus ?? null,
        clientStatusUpdatedAt: row.clientStatusUpdatedAt ?? null,
        remark: row.remark,
        createdAt: row.createdAt,
        systemUserId: row.systemUserId,
        systemUser: row.systemUser,
      };
    } catch (error: any) {
      // If columns don't exist, try without clientStatus columns
      if (error.message?.includes('client_status') || error.code === 'ER_BAD_FIELD_ERROR') {
        console.warn('[getSystem] clientStatus columns not found, fetching without them:', error.message);
        const result = await db
          .select({
            machineId: clientMaster.machineId,
            pcName: clientMaster.pcName,
            macId: clientMaster.macId,
            usbStatus: clientMaster.usbStatus,
            machineOn: clientMaster.machineOn,
            lastConnected: clientMaster.lastConnected,
            timeOffset: clientMaster.timeOffset,
            remark: clientMaster.remark,
            createdAt: clientMaster.createdAt,
            systemUserId: clientMaster.systemUserId,
            systemUser: systemUsers,
          })
          .from(clientMaster)
          .leftJoin(systemUsers, eq(clientMaster.systemUserId, systemUsers.systemUserId))
          .where(eq(clientMaster.machineId, machineId))
          .limit(1);

        if (!result[0]) return undefined;

        const row = result[0];
        return {
          machineId: row.machineId,
          pcName: row.pcName,
          macId: row.macId,
          usbStatus: row.usbStatus,
          machineOn: row.machineOn,
          lastConnected: row.lastConnected,
          timeOffset: row.timeOffset,
          clientStatus: null,
          clientStatusUpdatedAt: null,
          remark: row.remark,
          createdAt: row.createdAt,
          systemUserId: row.systemUserId,
          systemUser: row.systemUser,
        };
      }
      throw error;
    }
  }

  async getSystemByMacId(macId: string): Promise<ClientMaster | undefined> {
    const result = await db.select().from(clientMaster).where(eq(clientMaster.macId, macId)).limit(1);
    return result[0];
  }

  async getSystemsByMacId(macId: string): Promise<ClientMaster[]> {
    // Get all systems and filter by normalized MAC ID (case-insensitive, trimmed)
    // This ensures we catch duplicates even if they have different case or whitespace
    // Use raw SQL to avoid column issues
    try {
      const result = await db.execute(sql`
        SELECT 
          machine_id, machine_uid, pc_name, mac_id, usb_status, machine_on, 
          last_connected, time_offset, remark, created_at, profile_id
        FROM client_master
      `);

      // Extract rows from result (handle nested array structure)
      let rows: any[] = [];
      if (Array.isArray(result) && result.length > 0) {
        if (Array.isArray(result[0])) {
          rows = result[0];
        } else if (typeof result[0] === 'object' && result[0].machine_id !== undefined) {
          rows = result;
        }
      }

      const allSystems = rows.map((row: any) => ({
        machineId: row.machine_id,
        machineUid: row.machine_uid || null,
        pcName: row.pc_name,
        macId: row.mac_id,
        usbStatus: row.usb_status,
        machineOn: row.machine_on,
        lastConnected: row.last_connected ? new Date(row.last_connected) : null,
        timeOffset: row.time_offset,
        remark: row.remark || null,
        createdAt: row.created_at ? new Date(row.created_at) : null,
        systemUserId: row.profile_id || null,
        clientStatus: null,
        clientStatusUpdatedAt: null
      })) as ClientMaster[];

      const normalizedMacId = macId.trim().toUpperCase();

      const matchingSystems = allSystems.filter(system => {
        const systemMacId = (system.macId || '').trim().toUpperCase();
        return systemMacId === normalizedMacId && systemMacId !== ''; // Exclude empty MAC IDs
      });

      if (matchingSystems.length > 1) {
        console.log(`[getSystemsByMacId] Found ${matchingSystems.length} systems with MAC ID "${normalizedMacId}":`,
          matchingSystems.map(s => ({ machineId: s.machineId, pcName: s.pcName, macId: s.macId }))
        );
      }

      return matchingSystems;
    } catch (error: any) {
      console.error(`[getSystemsByMacId] Error fetching systems for MAC ID ${macId}:`, error);
      throw error;
    }
  }

  async getDuplicateMacIds(): Promise<{ macId: string; count: number; systems: ClientMaster[] }[]> {
    try {
      // Get all systems and group by MAC ID in JavaScript (more reliable than SQL GROUP BY)
      // Always use raw SQL to avoid column issues
      console.log('[getDuplicateMacIds] Fetching all systems from database...');
      const result = await db.execute(sql`
        SELECT 
          machine_id, machine_uid, pc_name, mac_id, usb_status, machine_on, 
          last_connected, time_offset, remark, created_at, profile_id
        FROM client_master
      `);

      // Convert raw result to ClientMaster format
      // Drizzle's db.execute() returns [rows, fields] where rows is an array of objects
      // The result might be wrapped in an array, so we need to extract the actual rows
      let rows: any[] = [];
      if (Array.isArray(result) && result.length > 0) {
        // Check if first element is an array (nested structure)
        if (Array.isArray(result[0])) {
          rows = result[0]; // Result is [[rows]]
        } else if (typeof result[0] === 'object' && result[0].machine_id !== undefined) {
          rows = result; // Result is [rows]
        }
      }

      const allSystems = rows.map((row: any) => {
        // Row is an object with keys like machine_id, pc_name, mac_id, etc.
        return {
          machineId: row.machine_id,
          machineUid: row.machine_uid || null,
          pcName: row.pc_name,
          macId: row.mac_id,
          usbStatus: row.usb_status,
          machineOn: row.machine_on,
          lastConnected: row.last_connected ? new Date(row.last_connected) : null,
          timeOffset: row.time_offset,
          remark: row.remark || null,
          createdAt: row.created_at ? new Date(row.created_at) : null,
          systemUserId: row.profile_id || null,
          clientStatus: null,
          clientStatusUpdatedAt: null
        };
      }) as ClientMaster[];

      console.log(`[getDuplicateMacIds] Loaded ${allSystems.length} systems from database`);

      // Group by MAC ID (case-insensitive, trimmed) so AA:BB and aa:bb are treated as the same MAC
      const macIdMap = new Map<string, ClientMaster[]>();

      allSystems.forEach(system => {
        const rawMacId = system.macId ?? '';
        const trimmedMacId = rawMacId.trim();
        const normalizedKey = trimmedMacId.toUpperCase(); // use uppercase as the grouping key

        if (normalizedKey) {
          if (!macIdMap.has(normalizedKey)) {
            macIdMap.set(normalizedKey, []);
          }
          macIdMap.get(normalizedKey)!.push(system);
        }
      });

      // Find duplicates (MAC IDs with more than 1 system)
      const duplicates: { macId: string; count: number; systems: ClientMaster[] }[] = [];

      macIdMap.forEach((systems, normalizedKey) => {
        if (systems.length > 1) {
          duplicates.push({
            // For display, use the MAC ID from the first system (original casing)
            macId: systems[0].macId?.trim() || normalizedKey,
            count: systems.length,
            systems
          });
        }
      });

      // Sort by count (descending)
      duplicates.sort((a, b) => b.count - a.count);

      console.log(`[DUPLICATE MAC IDS] Found ${duplicates.length} duplicate MAC ID groups`);
      duplicates.forEach(dup => {
        console.log(`[DUPLICATE MAC IDS] MAC ID: "${dup.macId}" has ${dup.count} systems`);
      });

      return duplicates;
    } catch (error: any) {
      console.error(`[DUPLICATE MAC IDS ERROR]`, error);
      throw error;
    }
  }

  async mergeDuplicateMacId(macId: string, keepMachineId: number, mergeMachineIds: number[]): Promise<{ success: boolean; merged: number; message: string }> {
    // Verify all systems have the same MAC ID
    const allSystems = await this.getSystemsByMacId(macId);

    if (!allSystems.some(s => s.machineId === keepMachineId)) {
      throw new Error(`System with machineId ${keepMachineId} not found for MAC ID ${macId}`);
    }

    for (const mergeId of mergeMachineIds) {
      if (!allSystems.some(s => s.machineId === mergeId)) {
        throw new Error(`System with machineId ${mergeId} not found for MAC ID ${macId}`);
      }
    }

    // Get the system to keep
    const keepSystem = allSystems.find(s => s.machineId === keepMachineId);
    if (!keepSystem) {
      throw new Error(`System to keep not found`);
    }

    // Simplified merge logic: Only delete duplicate entries from client_master table
    // No need to transfer data from other tables since duplicates only exist in client_master
    let mergedCount = 0;

    for (const mergeId of mergeMachineIds) {
      const mergeSystem = allSystems.find(s => s.machineId === mergeId);
      if (!mergeSystem) continue;

      // Simply delete the duplicate system from client_master table
      await this.deleteSystem(mergeId);
      mergedCount++;
    }

    return {
      success: true,
      merged: mergedCount,
      message: `Successfully deleted ${mergedCount} duplicate system(s) from client_master table. Kept system ${keepMachineId} (${keepSystem.pcName})`
    };
  }

  async createSystem(system: InsertClientMaster): Promise<ClientMaster> {
    const machineUid = randomUUID();
    const result = await db.insert(clientMaster).values({
      ...system,
      machineUid
    });
    const insertedId = (result as any).insertId as number | undefined;
    if (!insertedId) throw new Error("Failed to create system");
    const created = await db.select().from(clientMaster).where(eq(clientMaster.machineId, insertedId)).limit(1);
    if (!created[0]) throw new Error("Failed to retrieve created system");
    return created[0];
  }

  async updateSystem(machineId: number, updates: Partial<ClientMaster>): Promise<ClientMaster | undefined> {
    await db.update(clientMaster).set(updates).where(eq(clientMaster.machineId, machineId));
    const result = await db.select().from(clientMaster).where(eq(clientMaster.machineId, machineId)).limit(1);
    return result[0];
  }

  async deleteSystem(machineId: number): Promise<boolean> {
    const result = await db.delete(clientMaster).where(eq(clientMaster.machineId, machineId));
    return (result as any).affectedRows !== undefined ? (result as any).affectedRows > 0 : true;
  }

  async updateSystemUsbStatus(machineId: number, usbStatus: number): Promise<ClientMaster | undefined> {
    await db.update(clientMaster).set({ usbStatus }).where(eq(clientMaster.machineId, machineId));
    const result = await db.select().from(clientMaster).where(eq(clientMaster.machineId, machineId)).limit(1);
    return result[0];
  }

  async bulkUpdateUsbStatus(machineIds: number[], usbStatus: number): Promise<number> {
    if (machineIds.length === 0) return 0;
    const result = await db.update(clientMaster)
      .set({ usbStatus })
      .where(inArray(clientMaster.machineId, machineIds));
    return (result as any).affectedRows ?? machineIds.length;
  }

  async getDisconnectedSystems(dayThreshold: number = 7): Promise<ClientMaster[]> {
    try {
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - dayThreshold);

      // Use raw SQL to avoid column issues with client_status_updated_at
      const checkStatus = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'client_master'
        AND COLUMN_NAME = 'client_status'
      `);
      const hasClientStatus = Array.isArray(checkStatus) && Array.isArray(checkStatus[0])
        ? (checkStatus[0] as any[])[0]?.count > 0
        : (checkStatus as any[])[0]?.count > 0;

      const checkUpdatedAt = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'client_master'
        AND COLUMN_NAME = 'client_status_updated_at'
      `);
      const hasClientStatusUpdatedAt = Array.isArray(checkUpdatedAt) && Array.isArray(checkUpdatedAt[0])
        ? (checkUpdatedAt[0] as any[])[0]?.count > 0
        : (checkUpdatedAt as any[])[0]?.count > 0;

      let query;
      if (hasClientStatus && hasClientStatusUpdatedAt) {
        query = sql`
          SELECT 
            machine_id, machine_uid, pc_name, mac_id, usb_status, machine_on,
            last_connected, time_offset, client_status, client_status_updated_at,
            remark, created_at, profile_id
          FROM client_master
          WHERE machine_on = 0 OR last_connected < ${thresholdDate} OR last_connected IS NULL
        `;
      } else if (hasClientStatus) {
        query = sql`
          SELECT 
            machine_id, machine_uid, pc_name, mac_id, usb_status, machine_on,
            last_connected, time_offset, client_status,
            remark, created_at, profile_id
          FROM client_master
          WHERE machine_on = 0 OR last_connected < ${thresholdDate} OR last_connected IS NULL
        `;
      } else {
        query = sql`
          SELECT 
            machine_id, machine_uid, pc_name, mac_id, usb_status, machine_on,
            last_connected, time_offset,
            remark, created_at, profile_id
          FROM client_master
          WHERE machine_on = 0 OR last_connected < ${thresholdDate} OR last_connected IS NULL
        `;
      }

      const result = await db.execute(query);
      const rows = Array.isArray(result) && Array.isArray(result[0])
        ? result[0]
        : Array.isArray(result)
          ? result
          : [];

      return rows.map((row: any) => ({
        machineId: row.machine_id,
        machineUid: row.machine_uid,
        pcName: row.pc_name,
        macId: row.mac_id,
        usbStatus: row.usb_status,
        machineOn: row.machine_on,
        lastConnected: row.last_connected ? new Date(row.last_connected) : null,
        timeOffset: row.time_offset,
        clientStatus: hasClientStatus ? (row.client_status ?? null) : null,
        clientStatusUpdatedAt: hasClientStatusUpdatedAt ? (row.client_status_updated_at ? new Date(row.client_status_updated_at) : null) : null,
        remark: row.remark || null,
        createdAt: row.created_at ? new Date(row.created_at) : null,
        systemUserId: row.profile_id || null,
      })) as ClientMaster[];
    } catch (error: any) {
      console.error('[getDisconnectedSystems] Error:', error);
      // Return empty array on error to prevent breaking the report
      return [];
    }
  }

  async assignSystemUserToSystem(machineId: number, systemUserId: number | null): Promise<ClientMaster | undefined> {
    // Enforce one system user per machine: if assigning a system user, unassign it from any other machine first
    if (systemUserId !== null) {
      // Find any other machine that has this system user assigned
      const existingMachines = await db.select()
        .from(clientMaster)
        .where(and(
          eq(clientMaster.systemUserId, systemUserId),
          ne(clientMaster.machineId, machineId)
        ));

      // Unassign the system user from other machines
      if (existingMachines.length > 0) {
        await db.update(clientMaster)
          .set({ systemUserId: null })
          .where(and(
            eq(clientMaster.systemUserId, systemUserId),
            ne(clientMaster.machineId, machineId)
          ));
      }
    }

    // Assign the system user to the requested machine
    await db.update(clientMaster)
      .set({ systemUserId })
      .where(eq(clientMaster.machineId, machineId));

    const result = await db.select().from(clientMaster).where(eq(clientMaster.machineId, machineId)).limit(1);
    return result[0];
  }

  async bulkAssignSystemUser(machineIds: number[], systemUserId: number | null): Promise<number> {
    if (machineIds.length === 0) return 0;

    // Enforce one system user per machine: if assigning a system user, unassign it from any other machines first
    if (systemUserId !== null) {
      // Find any machines that have this system user assigned (excluding the ones we're assigning to)
      const existingMachines = await db.select()
        .from(clientMaster)
        .where(and(
          eq(clientMaster.systemUserId, systemUserId),
          sql`${clientMaster.machineId} NOT IN (${sql.join(machineIds.map(id => sql`${id}`), sql`, `)})`
        ));

      // Unassign the system user from other machines
      if (existingMachines.length > 0) {
        await db.update(clientMaster)
          .set({ systemUserId: null })
          .where(and(
            eq(clientMaster.systemUserId, systemUserId),
            sql`${clientMaster.machineId} NOT IN (${sql.join(machineIds.map(id => sql`${id}`), sql`, `)})`
          ));
      }
    }

    // Assign the system user to the requested machines
    const result = await db.update(clientMaster)
      .set({ systemUserId })
      .where(inArray(clientMaster.machineId, machineIds));
    return (result as any).affectedRows ?? machineIds.length;
  }

  async getSystemsBySystemUser(systemUserId: number): Promise<ClientMaster[]> {
    return await db.select().from(clientMaster)
      .where(eq(clientMaster.systemUserId, systemUserId))
      .orderBy(desc(clientMaster.lastConnected));
  }

  // ==================== USB LOGS METHODS ====================
  async getUsbLogs(limit: number = 500): Promise<(ClientUsbStatus & { pcName?: string })[]> {
    const result = await db
      .select({
        id: clientUsbStatus.id,
        logUid: clientUsbStatus.logUid,
        machineId: clientUsbStatus.machineId,
        deviceName: clientUsbStatus.deviceName,
        deviceDescription: clientUsbStatus.deviceDescription,
        deviceManufacturer: clientUsbStatus.deviceManufacturer,
        devicePort: clientUsbStatus.devicePort,
        deviceConnectTime: clientUsbStatus.deviceConnectTime,
        deviceDisconnectTime: clientUsbStatus.deviceDisconnectTime,
        deviceRemark: clientUsbStatus.deviceRemark,
        createdAt: clientUsbStatus.createdAt,
        deviceId: clientUsbStatus.deviceId,
        pcName: clientMaster.pcName,
      })
      .from(clientUsbStatus)
      .leftJoin(clientMaster, eq(clientUsbStatus.machineId, clientMaster.machineId))
      .orderBy(desc(clientUsbStatus.deviceConnectTime))
      .limit(limit);

    return result as (ClientUsbStatus & { pcName?: string })[];
  }

  async getUsbLogsByMachine(machineId: number, limit: number = 100): Promise<ClientUsbStatus[]> {
    return await db
      .select()
      .from(clientUsbStatus)
      .where(eq(clientUsbStatus.machineId, machineId))
      .orderBy(desc(clientUsbStatus.deviceConnectTime))
      .limit(limit);
  }

  async getConnectedUsbDevices(): Promise<(ClientUsbStatus & { pcName?: string })[]> {
    // Get all devices that don't have a disconnect time
    const result = await db
      .select({
        id: clientUsbStatus.id,
        logUid: clientUsbStatus.logUid,
        machineId: clientUsbStatus.machineId,
        deviceName: clientUsbStatus.deviceName,
        deviceDescription: clientUsbStatus.deviceDescription,
        deviceManufacturer: clientUsbStatus.deviceManufacturer,
        devicePort: clientUsbStatus.devicePort,
        deviceConnectTime: clientUsbStatus.deviceConnectTime,
        deviceDisconnectTime: clientUsbStatus.deviceDisconnectTime,
        deviceRemark: clientUsbStatus.deviceRemark,
        createdAt: clientUsbStatus.createdAt,
        deviceId: clientUsbStatus.deviceId,
        // Include system information to check online status
        pcName: clientMaster.pcName,
        machineOn: clientMaster.machineOn,
        lastConnected: clientMaster.lastConnected,
        timeOffset: clientMaster.timeOffset,
        clientStatus: clientMaster.clientStatus,
      })
      .from(clientUsbStatus)
      .leftJoin(clientMaster, eq(clientUsbStatus.machineId, clientMaster.machineId))
      .where(isNull(clientUsbStatus.deviceDisconnectTime))
      .orderBy(desc(clientUsbStatus.deviceConnectTime));

    // Filter out devices from offline systems
    // A device can only be "connected" if its system is online
    const connectedDevices = await Promise.all(
      result.map(async (device) => {
        const isSystemOnline = await this.isSystemOnline(
          device.machineOn ?? null,
          device.lastConnected ?? null,
          device.timeOffset ?? null,
          device.clientStatus ?? null
        );
        return isSystemOnline ? device : null;
      })
    );

    // Filter out null values (devices from offline systems)
    return connectedDevices.filter((d): d is ClientUsbStatus & { pcName?: string } => d !== null);
  }

  async createUsbLog(log: InsertClientUsbStatus): Promise<ClientUsbStatus> {
    const logUid = randomUUID();
    const result = await db.insert(clientUsbStatus).values({
      ...log,
      logUid
    });
    const insertedId = (result as any).insertId as number | undefined;
    if (!insertedId) throw new Error("Failed to create USB log");
    const created = await db.select().from(clientUsbStatus).where(eq(clientUsbStatus.id, insertedId)).limit(1);
    if (!created[0]) throw new Error("Failed to retrieve created USB log");
    return created[0];
  }

  async updateUsbLog(id: number, updates: Partial<ClientUsbStatus>): Promise<ClientUsbStatus | undefined> {
    await db.update(clientUsbStatus).set(updates).where(eq(clientUsbStatus.id, id));
    const result = await db.select().from(clientUsbStatus).where(eq(clientUsbStatus.id, id)).limit(1);
    return result[0];
  }

  // ==================== PROFILE METHODS ====================
  async getSystemUsers(): Promise<SystemUserWithMachines[]> {
    const systemUsersList = await db.select().from(systemUsers).orderBy(desc(systemUsers.createdAt));

    const systemUsersWithMachines = await Promise.all(
      systemUsersList.map(async (systemUser) => {
        const machines = await this.getSystemsBySystemUser(systemUser.systemUserId);
        return {
          ...systemUser,
          machines,
          assignedCount: machines.length
        };
      })
    );

    return systemUsersWithMachines;
  }

  async getSystemUser(systemUserId: number): Promise<SystemUserWithMachines | undefined> {
    const result = await db.select().from(systemUsers).where(eq(systemUsers.systemUserId, systemUserId)).limit(1);
    if (!result[0]) return undefined;

    const machines = await this.getSystemsBySystemUser(systemUserId);
    return {
      ...result[0],
      machines,
      assignedCount: machines.length
    };
  }

  async createSystemUser(systemUser: InsertSystemUser): Promise<SystemUser> {
    try {
      // Generate UUID for system_user_uid
      const systemUserUid = randomUUID();

      // Get the maximum systemUserId from the table and increment by 1
      const maxIdResult = await db
        .select({ maxId: max(systemUsers.systemUserId) })
        .from(systemUsers);

      const nextId = (maxIdResult[0]?.maxId || 0) + 1;

      console.log(`createSystemUser - Max ID: ${maxIdResult[0]?.maxId || 0}, Next ID: ${nextId}`);

      // Insert with the calculated ID
      await db.insert(systemUsers).values({
        ...systemUser,
        systemUserId: nextId,
        systemUserUid
      });

      // Retrieve the created system user
      const created = await db.select().from(systemUsers)
        .where(eq(systemUsers.systemUserId, nextId))
        .limit(1);

      if (!created[0]) {
        throw new Error("Failed to retrieve created system user");
      }

      console.log(`createSystemUser - Successfully created system user with ID: ${nextId}`);
      return created[0];

    } catch (error: any) {
      console.error("createSystemUser error:", error);

      // If insertion failed, try to find by name as fallback
      if (systemUser.systemUserName && error.code !== 'ER_DUP_ENTRY') {
        const found = await db.select().from(systemUsers)
          .where(eq(systemUsers.systemUserName, systemUser.systemUserName))
          .orderBy(desc(systemUsers.createdAt))
          .limit(1);
        if (found[0]) {
          console.log(`createSystemUser - Found existing system user by name: ${found[0].systemUserId}`);
          return found[0];
        }
      }
      throw error;
    }
  }

  async updateSystemUser(systemUserId: number, updates: Partial<SystemUser>): Promise<SystemUser | undefined> {
    await db.update(systemUsers).set(updates).where(eq(systemUsers.systemUserId, systemUserId));
    const result = await db.select().from(systemUsers).where(eq(systemUsers.systemUserId, systemUserId)).limit(1);
    return result[0];
  }

  async deleteSystemUser(systemUserId: number): Promise<boolean> {
    // First remove system user from all machines
    await db.update(clientMaster)
      .set({ systemUserId: null })
      .where(eq(clientMaster.systemUserId, systemUserId));

    const result = await db.delete(systemUsers).where(eq(systemUsers.systemUserId, systemUserId));
    return (result as any).affectedRows !== undefined ? (result as any).affectedRows > 0 : true;
  }

  async applySystemUserUsbPolicy(systemUserId: number): Promise<number> {
    const systemUser = await db.select().from(systemUsers).where(eq(systemUsers.systemUserId, systemUserId)).limit(1);
    if (!systemUser[0]) return 0;

    const result = await db.update(clientMaster)
      .set({ usbStatus: systemUser[0].usbPolicy })
      .where(eq(clientMaster.systemUserId, systemUserId));

    return (result as any).affectedRows ?? 0;
  }

  // ==================== URL MASTER METHODS ====================
  async getUrls(): Promise<UrlMaster[]> {
    return await db.select().from(urlMaster).orderBy(desc(urlMaster.createdAt));
  }

  async getUrl(id: number): Promise<UrlMaster | undefined> {
    const result = await db.select().from(urlMaster).where(eq(urlMaster.id, id)).limit(1);
    return result[0];
  }

  async createUrl(url: InsertUrlMaster): Promise<UrlMaster> {
    const urlUid = randomUUID();
    const result = await db.insert(urlMaster).values({
      ...url,
      urlUid
    });
    const insertedId = (result as any).insertId as number | undefined;
    if (!insertedId) throw new Error("Failed to create URL");
    const created = await db.select().from(urlMaster).where(eq(urlMaster.id, insertedId)).limit(1);
    if (!created[0]) throw new Error("Failed to retrieve created URL");
    return created[0];
  }

  async updateUrl(id: number, updates: Partial<UrlMaster>): Promise<UrlMaster | undefined> {
    await db.update(urlMaster).set(updates).where(eq(urlMaster.id, id));
    const result = await db.select().from(urlMaster).where(eq(urlMaster.id, id)).limit(1);
    return result[0];
  }

  async deleteUrl(id: number): Promise<boolean> {
    const result = await db.delete(urlMaster).where(eq(urlMaster.id, id));
    return (result as any).affectedRows !== undefined ? (result as any).affectedRows > 0 : true;
  }

  // ==================== DEVICE MASTER METHODS ====================
  async getDevices(): Promise<(DeviceMasterWithDescription & { pcName?: string })[]> {
    const result = await db
      .select({
        id: deviceMaster.id,
        deviceUid: deviceMaster.deviceUid,
        machineId: deviceMaster.machineId,
        systemUserId: deviceMaster.systemUserId,
        deviceName: deviceMaster.deviceName,
        deviceDescription: deviceMaster.deviceDescription,
        deviceId: deviceMaster.deviceId,
        deviceManufacturer: deviceMaster.deviceManufacturer,
        remark: deviceMaster.remark,
        isAllowed: deviceMaster.isAllowed,
        createdAt: deviceMaster.createdAt,
        updatedAt: deviceMaster.updatedAt,
        pcName: clientMaster.pcName,
      })
      .from(deviceMaster)
      .leftJoin(clientMaster, eq(deviceMaster.machineId, clientMaster.machineId))
      .orderBy(desc(deviceMaster.createdAt));

    // Map result: convert deviceDescription to description for API compatibility
    return result.map(r => {
      const { deviceDescription, ...rest } = r;
      return {
        ...rest,
        description: deviceDescription || null
      };
    }) as (DeviceMasterWithDescription & { pcName?: string })[];
  }

  async getDevice(id: number): Promise<DeviceMasterWithDescription | undefined> {
    const result = await db
      .select({
        id: deviceMaster.id,
        deviceUid: deviceMaster.deviceUid,
        machineId: deviceMaster.machineId,
        systemUserId: deviceMaster.systemUserId,
        deviceName: deviceMaster.deviceName,
        deviceDescription: deviceMaster.deviceDescription,
        deviceId: deviceMaster.deviceId,
        deviceManufacturer: deviceMaster.deviceManufacturer,
        remark: deviceMaster.remark,
        isAllowed: deviceMaster.isAllowed,
        createdAt: deviceMaster.createdAt,
        updatedAt: deviceMaster.updatedAt,
      })
      .from(deviceMaster)
      .where(eq(deviceMaster.id, id))
      .limit(1);

    if (!result[0]) return undefined;

    // Map deviceDescription to description for compatibility
    const { deviceDescription, ...rest } = result[0];
    return {
      ...rest,
      description: deviceDescription || null
    };
  }

  async getDevicesByMachine(machineId: number): Promise<DeviceMasterWithDescription[]> {
    const result = await db
      .select({
        id: deviceMaster.id,
        deviceUid: deviceMaster.deviceUid,
        machineId: deviceMaster.machineId,
        systemUserId: deviceMaster.systemUserId,
        deviceName: deviceMaster.deviceName,
        deviceDescription: deviceMaster.deviceDescription,
        deviceId: deviceMaster.deviceId,
        deviceManufacturer: deviceMaster.deviceManufacturer,
        remark: deviceMaster.remark,
        isAllowed: deviceMaster.isAllowed,
        createdAt: deviceMaster.createdAt,
        updatedAt: deviceMaster.updatedAt,
      })
      .from(deviceMaster)
      .where(eq(deviceMaster.machineId, machineId))
      .orderBy(desc(deviceMaster.createdAt));

    // Map deviceDescription to description for compatibility
    return result.map(r => {
      const { deviceDescription, ...rest } = r;
      return {
        ...rest,
        description: deviceDescription || null
      };
    });
  }

  async getDeviceByDeviceId(devId: string): Promise<DeviceMasterWithDescription | undefined> {
    const result = await db
      .select({
        id: deviceMaster.id,
        deviceUid: deviceMaster.deviceUid,
        machineId: deviceMaster.machineId,
        systemUserId: deviceMaster.systemUserId,
        deviceName: deviceMaster.deviceName,
        deviceDescription: deviceMaster.deviceDescription,
        deviceId: deviceMaster.deviceId,
        deviceManufacturer: deviceMaster.deviceManufacturer,
        remark: deviceMaster.remark,
        isAllowed: deviceMaster.isAllowed,
        createdAt: deviceMaster.createdAt,
        updatedAt: deviceMaster.updatedAt,
      })
      .from(deviceMaster)
      .where(eq(deviceMaster.deviceId, devId))
      .limit(1);

    if (!result[0]) return undefined;

    // Map deviceDescription to description for compatibility
    const { deviceDescription, ...rest } = result[0];
    return {
      ...rest,
      description: deviceDescription || null
    };
  }

  async createDevice(device: InsertDeviceMaster): Promise<DeviceMasterWithDescription> {
    const deviceUid = randomUUID();
    // Map description to deviceDescription if provided
    const deviceData: any = {
      ...device,
      deviceUid
    };
    // If description is provided, map it to deviceDescription
    if ('description' in deviceData && deviceData.description !== undefined) {
      deviceData.deviceDescription = deviceData.description;
      delete deviceData.description;
    }

    // Enforce one profile per device: if assigning a profile, unassign it from any other device first
    if (deviceData.systemUserId !== null && deviceData.systemUserId !== undefined) {
      await db.update(deviceMaster)
        .set({ systemUserId: null })
        .where(eq(deviceMaster.systemUserId, deviceData.systemUserId));
    }

    const result = await db.insert(deviceMaster).values(deviceData);
    const insertedId = (result as any).insertId as number | undefined;
    if (!insertedId) throw new Error("Failed to create device");
    const created = await this.getDevice(insertedId);
    if (!created) throw new Error("Failed to retrieve created device");
    return created;
  }

  async updateDevice(id: number, updates: Partial<DeviceMaster>): Promise<DeviceMasterWithDescription | undefined> {
    // Map description to deviceDescription if provided
    const updateData: any = { ...updates };
    if ('description' in updateData && updateData.description !== undefined) {
      updateData.deviceDescription = updateData.description;
      delete updateData.description;
    }

    // Enforce one profile per device: if assigning a profile, unassign it from any other device first
    if (updateData.systemUserId !== null && updateData.systemUserId !== undefined) {
      await db.update(deviceMaster)
        .set({ systemUserId: null })
        .where(and(
          eq(deviceMaster.systemUserId, updateData.systemUserId),
          ne(deviceMaster.id, id)
        ));
    }

    await db.update(deviceMaster).set(updateData).where(eq(deviceMaster.id, id));
    return this.getDevice(id);
  }

  async deleteDevice(id: number): Promise<boolean> {
    const result = await db.delete(deviceMaster).where(eq(deviceMaster.id, id));
    return (result as any).affectedRows !== undefined ? (result as any).affectedRows > 0 : true;
  }

  // ==================== REPORTS ====================
  async getDevicesByMachineReport(): Promise<{ machineId: number; pcName: string; macId: string; machineOn: number; lastConnected: Date | null; timeOffset: number | null; clientStatus: number | null; totalDevices: number; allowedDevices: number; blockedDevices: number; devices: DeviceMasterWithDescription[] }[]> {
    // Use raw SQL to avoid column issues with client_status_updated_at
    const checkStatus = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'client_master'
      AND COLUMN_NAME = 'client_status'
    `);
    const hasClientStatus = Array.isArray(checkStatus) && Array.isArray(checkStatus[0])
      ? (checkStatus[0] as any[])[0]?.count > 0
      : (checkStatus as any[])[0]?.count > 0;

    let machinesQuery;
    if (hasClientStatus) {
      machinesQuery = sql`
        SELECT 
          machine_id, machine_uid, pc_name, mac_id, usb_status, machine_on,
          last_connected, time_offset, client_status,
          remark, created_at, profile_id
        FROM client_master
        ORDER BY last_connected DESC
      `;
    } else {
      machinesQuery = sql`
        SELECT 
          machine_id, machine_uid, pc_name, mac_id, usb_status, machine_on,
          last_connected, time_offset,
          remark, created_at, profile_id
        FROM client_master
        ORDER BY last_connected DESC
      `;
    }

    const machinesResult = await db.execute(machinesQuery);
    const machinesRows = Array.isArray(machinesResult) && Array.isArray(machinesResult[0])
      ? machinesResult[0]
      : Array.isArray(machinesResult)
        ? machinesResult
        : [];

    const machines = machinesRows.map((row: any) => ({
      machineId: row.machine_id,
      machineUid: row.machine_uid,
      pcName: row.pc_name,
      macId: row.mac_id,
      usbStatus: row.usb_status,
      machineOn: row.machine_on,
      lastConnected: row.last_connected ? new Date(row.last_connected) : null,
      timeOffset: row.time_offset,
      clientStatus: hasClientStatus ? (row.client_status ?? null) : null,
      remark: row.remark || null,
      createdAt: row.created_at ? new Date(row.created_at) : null,
      systemUserId: row.profile_id || null,
    })) as ClientMaster[];

    const report = await Promise.all(
      machines.map(async (machine) => {
        const devices = await this.getDevicesByMachine(machine.machineId);
        return {
          machineId: machine.machineId,
          pcName: machine.pcName,
          macId: machine.macId,
          machineOn: machine.machineOn ?? 0,
          lastConnected: machine.lastConnected,
          timeOffset: machine.timeOffset,
          clientStatus: machine.clientStatus ?? null,
          totalDevices: devices.length,
          allowedDevices: devices.filter(d => d.isAllowed === 1).length,
          blockedDevices: devices.filter(d => d.isAllowed === 0).length,
          devices
        };
      })
    );

    return report;
  }

  // Comprehensive Device Analytics Report
  async getDeviceAnalyticsReport(): Promise<{
    summary: {
      totalDevices: number;
      allowedDevices: number;
      blockedDevices: number;
      devicesWithMachines: number;
      orphanedDevices: number;
    };
    byManufacturer: { manufacturer: string; count: number; allowed: number; blocked: number }[];
    byStatus: { status: string; count: number }[];
    byMachine: { machineId: number; pcName: string; macId: string; totalDevices: number; allowedDevices: number; blockedDevices: number; lastDeviceAdded: Date | null; isOnline: boolean }[];
    recentDevices: (DeviceMaster & { pcName?: string })[];
    topDevices: { deviceName: string; count: number; machines: number }[];
    offlineSystems: { machineId: number; pcName: string; macId: string; lastConnected: Date | null; totalDevices: number; allowedDevices: number; blockedDevices: number; devices: DeviceMaster[] }[];
  }> {
    try {
      // Get all devices with machine info
      const allDevices = await this.getDevices();
      console.log(`[getDeviceAnalyticsReport] Found ${allDevices.length} devices`);

      // Summary statistics
      const totalDevices = allDevices.length;
      const allowedDevices = allDevices.filter(d => d.isAllowed === 1).length;
      const blockedDevices = allDevices.filter(d => d.isAllowed === 0).length;
      const devicesWithMachines = allDevices.filter(d => d.machineId !== null).length;
      const orphanedDevices = allDevices.filter(d => d.machineId === null).length;

      // Group by manufacturer
      const manufacturerMap = new Map<string, { count: number; allowed: number; blocked: number }>();
      allDevices.forEach(device => {
        const manufacturer = device.deviceManufacturer || 'Unknown';
        const existing = manufacturerMap.get(manufacturer) || { count: 0, allowed: 0, blocked: 0 };
        existing.count++;
        if (device.isAllowed === 1) existing.allowed++;
        else existing.blocked++;
        manufacturerMap.set(manufacturer, existing);
      });
      const byManufacturer = Array.from(manufacturerMap.entries())
        .map(([manufacturer, stats]) => ({ manufacturer, ...stats }))
        .sort((a, b) => b.count - a.count);

      // By status
      const byStatus = [
        { status: 'Allowed', count: allowedDevices },
        { status: 'Blocked', count: blockedDevices },
        { status: 'Unassigned', count: orphanedDevices }
      ];

      // By machine - get machines with device counts
      // Use raw SQL to avoid column issues with client_status_updated_at
      const checkStatus = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'client_master'
      AND COLUMN_NAME = 'client_status'
    `);
      const hasClientStatus = Array.isArray(checkStatus) && Array.isArray(checkStatus[0])
        ? (checkStatus[0] as any[])[0]?.count > 0
        : (checkStatus as any[])[0]?.count > 0;

      const checkUpdatedAt = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'client_master'
      AND COLUMN_NAME = 'client_status_updated_at'
    `);
      const hasClientStatusUpdatedAt = Array.isArray(checkUpdatedAt) && Array.isArray(checkUpdatedAt[0])
        ? (checkUpdatedAt[0] as any[])[0]?.count > 0
        : (checkUpdatedAt as any[])[0]?.count > 0;

      let machinesQuery;
      if (hasClientStatus && hasClientStatusUpdatedAt) {
        machinesQuery = sql`
        SELECT 
          machine_id, machine_uid, pc_name, mac_id, usb_status, machine_on,
          last_connected, time_offset, client_status, client_status_updated_at,
          remark, created_at, profile_id
        FROM client_master
      `;
      } else if (hasClientStatus) {
        machinesQuery = sql`
        SELECT 
          machine_id, machine_uid, pc_name, mac_id, usb_status, machine_on,
          last_connected, time_offset, client_status,
          remark, created_at, profile_id
        FROM client_master
      `;
      } else {
        machinesQuery = sql`
        SELECT 
          machine_id, machine_uid, pc_name, mac_id, usb_status, machine_on,
          last_connected, time_offset,
          remark, created_at, profile_id
        FROM client_master
      `;
      }

      const machinesResult = await db.execute(machinesQuery);
      const machinesRows = Array.isArray(machinesResult) && Array.isArray(machinesResult[0])
        ? machinesResult[0]
        : Array.isArray(machinesResult)
          ? machinesResult
          : [];

      const machines = machinesRows.map((row: any) => ({
        machineId: row.machine_id,
        machineUid: row.machine_uid,
        pcName: row.pc_name,
        macId: row.mac_id,
        usbStatus: row.usb_status,
        machineOn: row.machine_on,
        lastConnected: row.last_connected ? new Date(row.last_connected) : null,
        timeOffset: row.time_offset,
        clientStatus: hasClientStatus ? (row.client_status ?? null) : null,
        remark: row.remark || null,
        createdAt: row.created_at ? new Date(row.created_at) : null,
        systemUserId: row.profile_id || null,
      })) as ClientMaster[];

      const byMachine = await Promise.all(
        machines.map(async (machine) => {
          const devices = await this.getDevicesByMachine(machine.machineId);
          const lastDeviceAdded = devices.length > 0
            ? devices.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))[0].createdAt
            : null;
          const isOnline = await this.isSystemOnline(machine.machineOn, machine.lastConnected, machine.timeOffset, machine.clientStatus ?? null);
          return {
            machineId: machine.machineId,
            pcName: machine.pcName,
            macId: machine.macId,
            totalDevices: devices.length,
            allowedDevices: devices.filter(d => d.isAllowed === 1).length,
            blockedDevices: devices.filter(d => d.isAllowed === 0).length,
            lastDeviceAdded,
            isOnline
          };
        })
      ).then(results => results.filter(m => m.totalDevices > 0).sort((a, b) => b.totalDevices - a.totalDevices));

      // Offline systems with devices
      // Check online status for all machines first
      const machineStatuses = await Promise.all(
        machines.map(async (machine) => ({
          machine,
          isOnline: await this.isSystemOnline(machine.machineOn, machine.lastConnected, machine.timeOffset, machine.clientStatus ?? null)
        }))
      );

      const offlineSystems = await Promise.all(
        machineStatuses
          .filter(({ isOnline }) => !isOnline)
          .map(async ({ machine }) => {
            const devices = await this.getDevicesByMachine(machine.machineId);
            return {
              machineId: machine.machineId,
              pcName: machine.pcName,
              macId: machine.macId,
              lastConnected: machine.lastConnected,
              totalDevices: devices.length,
              allowedDevices: devices.filter(d => d.isAllowed === 1).length,
              blockedDevices: devices.filter(d => d.isAllowed === 0).length,
              devices
            };
          })
      ).then(results => results.filter(m => m.totalDevices > 0).sort((a, b) => {
        // Sort by lastConnected (most recent first, nulls last)
        if (!a.lastConnected && !b.lastConnected) return 0;
        if (!a.lastConnected) return 1;
        if (!b.lastConnected) return -1;
        return b.lastConnected.getTime() - a.lastConnected.getTime();
      }));

      // Recent devices (last 20)
      const recentDevices = allDevices
        .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
        .slice(0, 20);

      // Top devices (most common device names across machines)
      const deviceNameMap = new Map<string, { count: number; machines: Set<number> }>();
      allDevices.forEach(device => {
        const name = device.deviceName;
        const existing = deviceNameMap.get(name) || { count: 0, machines: new Set<number>() };
        existing.count++;
        if (device.machineId) existing.machines.add(device.machineId);
        deviceNameMap.set(name, existing);
      });
      const topDevices = Array.from(deviceNameMap.entries())
        .map(([deviceName, stats]) => ({
          deviceName,
          count: stats.count,
          machines: stats.machines.size
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        summary: {
          totalDevices,
          allowedDevices,
          blockedDevices,
          devicesWithMachines,
          orphanedDevices
        },
        byManufacturer,
        byStatus,
        byMachine,
        recentDevices,
        topDevices,
        offlineSystems
      };
    } catch (error: any) {
      console.error('[getDeviceAnalyticsReport] Error:', error);
      console.error('[getDeviceAnalyticsReport] Error stack:', error.stack);
      throw new Error(`Failed to generate device analytics report: ${error.message}`);
    }
  }

  // Machine-wise detailed device report
  async getMachineDeviceReport(machineId: number): Promise<{
    machine: ClientMaster | null;
    devices: DeviceMasterWithDescription[];
    summary: {
      totalDevices: number;
      allowedDevices: number;
      blockedDevices: number;
      byManufacturer: { manufacturer: string; count: number }[];
    };
  }> {
    const machine = await this.getSystem(machineId);
    const devices = await this.getDevicesByMachine(machineId);

    // Group by manufacturer
    const manufacturerMap = new Map<string, number>();
    devices.forEach(device => {
      const manufacturer = device.deviceManufacturer || 'Unknown';
      manufacturerMap.set(manufacturer, (manufacturerMap.get(manufacturer) || 0) + 1);
    });
    const byManufacturer = Array.from(manufacturerMap.entries())
      .map(([manufacturer, count]) => ({ manufacturer, count }))
      .sort((a, b) => b.count - a.count);

    return {
      machine: machine || null,
      devices,
      summary: {
        totalDevices: devices.length,
        allowedDevices: devices.filter(d => d.isAllowed === 1).length,
        blockedDevices: devices.filter(d => d.isAllowed === 0).length,
        byManufacturer
      }
    };
  }

  async getUsbActivityReport(startDate?: Date, endDate?: Date): Promise<{
    totalEvents: number;
    byMachine: { machineId: number; pcName: string; eventCount: number }[];
    byDevice: { deviceName: string; eventCount: number }[];
    byDate: { date: string; eventCount: number }[];
    recentActivity: (ClientUsbStatus & { pcName?: string })[];
  }> {
    let whereClause;
    if (startDate && endDate) {
      whereClause = and(
        gte(clientUsbStatus.createdAt, startDate),
        sql`${clientUsbStatus.createdAt} <= ${endDate}`
      );
    } else if (startDate) {
      whereClause = gte(clientUsbStatus.createdAt, startDate);
    }

    // Total events
    const totalResult = whereClause
      ? await db.select({ count: count() }).from(clientUsbStatus).where(whereClause)
      : await db.select({ count: count() }).from(clientUsbStatus);
    const totalEvents = totalResult[0]?.count || 0;

    // Events by machine
    let byMachineQuery = db
      .select({
        machineId: clientUsbStatus.machineId,
        pcName: clientMaster.pcName,
        eventCount: count()
      })
      .from(clientUsbStatus)
      .leftJoin(clientMaster, eq(clientUsbStatus.machineId, clientMaster.machineId));
    if (whereClause) {
      byMachineQuery = byMachineQuery.where(whereClause);
    }
    const byMachineRaw = await byMachineQuery
      .groupBy(clientUsbStatus.machineId, clientMaster.pcName)
      .orderBy(sql`COUNT(*) DESC`);

    const byMachine = byMachineRaw.map(r => ({
      machineId: r.machineId,
      pcName: r.pcName || 'Unknown',
      eventCount: r.eventCount
    }));

    // Events by device
    let byDeviceQuery = db
      .select({
        deviceName: clientUsbStatus.deviceName,
        eventCount: count()
      })
      .from(clientUsbStatus);
    if (whereClause) {
      byDeviceQuery = byDeviceQuery.where(whereClause);
    }
    const byDeviceRaw = await byDeviceQuery
      .groupBy(clientUsbStatus.deviceName)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(20);

    const byDevice = byDeviceRaw.map(r => ({
      deviceName: r.deviceName,
      eventCount: r.eventCount
    }));

    // Events by date (last 30 days)
    let byDateQuery = db
      .select({
        date: sql<string>`DATE(${clientUsbStatus.createdAt})`,
        eventCount: count()
      })
      .from(clientUsbStatus);
    if (whereClause) {
      byDateQuery = byDateQuery.where(whereClause);
    }
    const byDateRaw = await byDateQuery
      .groupBy(sql`DATE(${clientUsbStatus.createdAt})`)
      .orderBy(sql`DATE(${clientUsbStatus.createdAt})`);

    const byDate = byDateRaw.map(r => ({
      date: r.date,
      eventCount: r.eventCount
    }));

    // Recent activity
    const recentActivity = await this.getUsbLogs(50);

    return {
      totalEvents,
      byMachine,
      byDevice,
      byDate,
      recentActivity
    };
  }

  async getSystemHealthReport(): Promise<{
    totalSystems: number;
    onlineSystems: number;
    offlineSystems: number;
    usbEnabledSystems: number;
    usbDisabledSystems: number;
    systemsBySystemUser: { systemUserId: number | null; systemUserName: string; count: number }[];
    systemsWithDevices: { machineId: number; pcName: string; deviceCount: number }[];
    inactiveSystems: ClientMaster[];
  }> {
    try {
      // Basic counts
      const totalResult = await db.select({ count: count() }).from(clientMaster);
      const totalSystems = totalResult[0]?.count || 0;

      // Get all systems to check online/offline based on last_connected time (30 second rule using client time)
      // Use raw SQL to avoid column issues with client_status_updated_at
      const checkStatus = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'client_master'
      AND COLUMN_NAME = 'client_status'
    `);
      const hasClientStatus = Array.isArray(checkStatus) && Array.isArray(checkStatus[0])
        ? (checkStatus[0] as any[])[0]?.count > 0
        : (checkStatus as any[])[0]?.count > 0;

      let systemsQuery;
      if (hasClientStatus) {
        systemsQuery = sql`
        SELECT machine_on, last_connected, time_offset, client_status
        FROM client_master
      `;
      } else {
        systemsQuery = sql`
        SELECT machine_on, last_connected, time_offset
        FROM client_master
      `;
      }

      const systemsResult = await db.execute(systemsQuery);
      const systemsRows = Array.isArray(systemsResult) && Array.isArray(systemsResult[0])
        ? systemsResult[0]
        : Array.isArray(systemsResult)
          ? systemsResult
          : [];

      const allSystems = systemsRows.map((row: any) => ({
        machineOn: row.machine_on,
        lastConnected: row.last_connected ? new Date(row.last_connected) : null,
        timeOffset: row.time_offset,
        clientStatus: hasClientStatus ? (row.client_status ?? null) : null,
      }));

      // Count online systems: machineOn = 1 AND last_connected within 30 seconds (using client time)
      const systemStatuses = await Promise.all(
        allSystems.map(s => this.isSystemOnline(s.machineOn, s.lastConnected, s.timeOffset, s.clientStatus ?? null))
      );
      const onlineSystems = systemStatuses.filter(isOnline => isOnline).length;

      const offlineSystems = totalSystems - onlineSystems;

      const usbEnabledResult = await db.select({ count: count() }).from(clientMaster).where(eq(clientMaster.usbStatus, 1));
      const usbEnabledSystems = usbEnabledResult[0]?.count || 0;

      const usbDisabledSystems = totalSystems - usbEnabledSystems;

      // Systems by system user
      const systemsBySystemUserRaw = await db
        .select({
          systemUserId: clientMaster.systemUserId,
          systemUserName: systemUsers.systemUserName,
          count: count()
        })
        .from(clientMaster)
        .leftJoin(systemUsers, eq(clientMaster.systemUserId, systemUsers.systemUserId))
        .groupBy(clientMaster.systemUserId, systemUsers.systemUserName);

      const systemsBySystemUser = systemsBySystemUserRaw.map(r => ({
        systemUserId: r.systemUserId,
        systemUserName: r.systemUserName || 'No System User',
        count: r.count
      }));

      // Systems with device counts
      const systemsWithDevicesRaw = await db
        .select({
          machineId: clientMaster.machineId,
          pcName: clientMaster.pcName,
          deviceCount: count(deviceMaster.id)
        })
        .from(clientMaster)
        .leftJoin(deviceMaster, eq(clientMaster.machineId, deviceMaster.machineId))
        .groupBy(clientMaster.machineId, clientMaster.pcName)
        .orderBy(desc(count(deviceMaster.id)));

      const systemsWithDevices = systemsWithDevicesRaw.map(r => ({
        machineId: r.machineId,
        pcName: r.pcName,
        deviceCount: r.deviceCount
      }));

      // Inactive systems (offline for more than 7 days)
      const inactiveSystems = await this.getDisconnectedSystems(7);

      return {
        totalSystems,
        onlineSystems,
        offlineSystems,
        usbEnabledSystems,
        usbDisabledSystems,
        systemsBySystemUser,
        systemsWithDevices,
        inactiveSystems
      };
    } catch (error: any) {
      console.error('[getSystemHealthReport] Error:', error);
      console.error('[getSystemHealthReport] Error stack:', error.stack);
      throw new Error(`Failed to generate system health report: ${error.message}`);
    }
  }

  // ==================== DASHBOARD STATS ====================
  async getDashboardStats(): Promise<DashboardStats> {
    // Total systems
    const totalResult = await db.select({ count: count() }).from(clientMaster);
    const totalSystems = totalResult[0]?.count || 0;

    // Get all systems to check online/offline based on last_connected time (30 second rule using client time)
    const allSystems = await db.select({
      machineOn: clientMaster.machineOn,
      lastConnected: clientMaster.lastConnected,
      timeOffset: clientMaster.timeOffset,
      clientStatus: clientMaster.clientStatus,
    }).from(clientMaster);

    // Count online systems: machineOn = 1 AND last_connected within 30 seconds (using client time)
    const systemStatuses = await Promise.all(
      allSystems.map(async (s) => {
        const isOnline = await this.isSystemOnline(s.machineOn, s.lastConnected, s.timeOffset, s.clientStatus ?? null);

        // Debug logging
        if (!isOnline && s.machineOn === 1) {
          const now = new Date();
          const lastConnectedTime = s.lastConnected ? new Date(s.lastConnected) : null;
          const diffInMs = lastConnectedTime ? now.getTime() - lastConnectedTime.getTime() : null;
          const diffInSeconds = diffInMs ? diffInMs / 1000 : null;
          console.log(`[DASHBOARD DEBUG] System marked offline:`, {
            machineOn: s.machineOn,
            clientStatus: s.clientStatus,
            lastConnected: s.lastConnected?.toISOString(),
            currentTime: now.toISOString(),
            diffInSeconds: diffInSeconds?.toFixed(2)
          });
        }

        return isOnline;
      })
    );
    const onlineSystems = systemStatuses.filter(isOnline => isOnline).length;

    // Offline systems
    const offlineSystems = totalSystems - onlineSystems;

    console.log(`[DASHBOARD STATS] Total: ${totalSystems}, Online: ${onlineSystems}, Offline: ${offlineSystems}`);

    // USB enabled systems
    const usbEnabledResult = await db.select({ count: count() }).from(clientMaster).where(eq(clientMaster.usbStatus, 1));
    const usbEnabledSystems = usbEnabledResult[0]?.count || 0;

    // USB disabled systems
    const usbDisabledSystems = totalSystems - usbEnabledSystems;

    // Blocked URLs
    const blockedResult = await db.select({ count: count() }).from(urlMaster).where(eq(urlMaster.remark, 'blocked'));
    const blockedUrlCount = blockedResult[0]?.count || 0;

    // Allowed URLs
    const allowedResult = await db.select({ count: count() }).from(urlMaster).where(eq(urlMaster.remark, 'allowed'));
    const allowedUrlCount = allowedResult[0]?.count || 0;

    // USB events today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const usbTodayResult = await db.select({ count: count() }).from(clientUsbStatus).where(gte(clientUsbStatus.createdAt, today));
    const usbEventsToday = usbTodayResult[0]?.count || 0;

    // USB events last 7 days
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    const usb7DaysResult = await db.select({ count: count() }).from(clientUsbStatus).where(gte(clientUsbStatus.createdAt, last7Days));
    const usbEventsLast7Days = usb7DaysResult[0]?.count || 0;

    return {
      totalSystems,
      onlineSystems,
      offlineSystems,
      usbEnabledSystems,
      usbDisabledSystems,
      blockedUrlCount,
      allowedUrlCount,
      usbEventsToday,
      usbEventsLast7Days
    };
  }

  // ==================== SYSTEM REGISTRATION ====================
  /**
   * Register or update a system by MAC ID
   * If a system with the same MAC ID exists, update it (especially if PC name changed)
   * If no system exists, create a new one
   * Returns information about whether the system was updated and if PC name changed
   * 
   * IMPORTANT: 
   * - Uses application server time for lastConnected
   * - Calculates timeOffset from clientTime if provided: timeOffset = server_time - client_time
   * - Sets lastUpdated to server time for accurate online/offline detection
   * - Online/offline status is primarily determined by client_status field or lastUpdated
   */
  async registerOrUpdateSystemByMacId(pcName: string, macId: string, clientTime?: string, systemUserId?: number | null): Promise<{ system: ClientMaster; wasUpdated: boolean; pcNameChanged: boolean; oldPcName?: string; duplicateDetected?: boolean; duplicateSystems?: ClientMaster[]; mergedCount?: number }> {
    // Normalize MAC ID for comparison (trim and uppercase)
    const normalizedMacId = macId.trim().toUpperCase();

    // Validate MAC ID
    if (!normalizedMacId || normalizedMacId.length === 0) {
      throw new Error("MAC ID cannot be empty");
    }

    // Check for duplicate MAC IDs
    const allSystemsWithMacId = await this.getSystemsByMacId(macId);

    console.log(`[REGISTER] System "${pcName}" with MAC ID "${normalizedMacId}" - Found ${allSystemsWithMacId.length} existing system(s) with same MAC ID`);

    // Use application server time (UTC)
    const now = new Date();

    // Calculate time offset if clientTime is provided
    // timeOffset = server_time - client_time (in milliseconds)
    // For IST client (UTC+5:30), this will be approximately -19800000ms (-5.5 hours)
    let calculatedTimeOffset: number | null = null;
    if (clientTime) {
      try {
        const clientDate = new Date(clientTime);
        if (!isNaN(clientDate.getTime())) {
          calculatedTimeOffset = now.getTime() - clientDate.getTime();
          const offsetHours = (calculatedTimeOffset / (1000 * 60 * 60)).toFixed(2);
          console.log(`[TIME OFFSET] Calculated for ${pcName}: ${calculatedTimeOffset}ms (${offsetHours} hours) - Server: ${now.toISOString()}, Client: ${clientDate.toISOString()}`);
        }
      } catch (e) {
        console.warn(`[TIME OFFSET] Failed to parse clientTime: ${clientTime}`);
      }
    }

    // If there are multiple systems with the same MAC ID, merge all old entries into the new one
    if (allSystemsWithMacId.length > 1) {
      console.log(`[AUTO-MERGE] Detected ${allSystemsWithMacId.length} duplicate systems for MAC ID ${normalizedMacId}`);
      console.log(`[AUTO-MERGE] Strategy: Create/update new entry first, then merge all old duplicates into it`);

      // Step 1: Create or update the new system entry (this will be the one we keep)
      // First, check if any existing system matches the new registration exactly
      let newSystem: ClientMaster;
      let wasNewSystemCreated = false;
      const exactMatch = allSystemsWithMacId.find(s => s.pcName === pcName);

      if (exactMatch) {
        // Update the matching system with new information
        const updates: any = {
          pcName,
          machineOn: 1,
          lastConnected: now,
          lastUpdated: now, // Server timestamp for status check
          timeOffset: calculatedTimeOffset !== null ? calculatedTimeOffset : exactMatch.timeOffset // Use new offset if available
        };

        if (systemUserId !== undefined) {
          updates.systemUserId = systemUserId;
        }

        const updated = await this.updateSystem(exactMatch.machineId, updates);
        if (!updated) {
          throw new Error("Failed to update system");
        }
        newSystem = updated;
        console.log(`[AUTO-MERGE] Updated existing system ${newSystem.machineId} (${newSystem.pcName}) with new registration data`);
      } else {
        // Create a new system entry
        newSystem = await this.createSystem({
          pcName,
          macId: normalizedMacId,
          usbStatus: 0, // Default: USB disabled
          machineOn: 1, // Online
          lastConnected: now,
          lastUpdated: now, // Server timestamp for status check
          timeOffset: calculatedTimeOffset,
          systemUserId: systemUserId !== undefined ? systemUserId : null
        });
        wasNewSystemCreated = true;
        console.log(`[AUTO-MERGE] Created new system ${newSystem.machineId} (${newSystem.pcName}) for registration`);
      }

      // Step 2: Merge all old duplicate entries into the new one
      const oldSystemsToMerge = allSystemsWithMacId.filter(s => s.machineId !== newSystem.machineId);
      const mergeMachineIds = oldSystemsToMerge.map(s => s.machineId);

      if (mergeMachineIds.length > 0) {
        console.log(`[AUTO-MERGE] Merging ${mergeMachineIds.length} old duplicate system(s) into new entry ${newSystem.machineId}:`,
          oldSystemsToMerge.map(s => ({ machineId: s.machineId, pcName: s.pcName }))
        );

        // Automatically merge old duplicates into the new system
        console.log(`[AUTO-MERGE] Starting merge process for MAC ID ${normalizedMacId}...`);
        const mergeResult = await this.mergeDuplicateMacId(normalizedMacId, newSystem.machineId, mergeMachineIds);

        if (!mergeResult.success || mergeResult.merged === 0) {
          console.error(`[AUTO-MERGE] Merge failed or no systems merged for MAC ID ${normalizedMacId}:`, mergeResult);
          throw new Error(`Failed to merge duplicate systems: ${mergeResult.message}`);
        }

        // Create notification about the automatic merge
        const mergedPcNames = oldSystemsToMerge.map(s => s.pcName).join(', ');
        try {
          await this.createNotification({
            machineId: newSystem.machineId,
            notificationType: 'duplicate_macid_merged',
            title: 'Duplicate MAC ID Automatically Merged',
            message: `Found ${allSystemsWithMacId.length} systems with the same MAC ID (${normalizedMacId}). Automatically merged ${mergeResult.merged} old system(s) (${mergedPcNames}) into new system "${newSystem.pcName}" (ID: ${newSystem.machineId}).`,
            oldValue: mergedPcNames,
            newValue: newSystem.pcName,
            macId: normalizedMacId,
            isRead: 0
          });
          console.log(`[AUTO-MERGE] Notification created successfully for MAC ID ${normalizedMacId}`);
        } catch (notifError: any) {
          console.error(`[AUTO-MERGE] Failed to create notification (merge was successful):`, notifError);
          // Don't throw - merge was successful, notification failure is non-critical
        }

        console.log(`[AUTO-MERGE] Successfully merged ${mergeResult.merged} old duplicate systems into new entry for MAC ID ${normalizedMacId}`);

        // Get the updated system after merge
        const updatedSystem = await this.getSystem(newSystem.machineId);
        if (!updatedSystem) {
          throw new Error("Failed to retrieve merged system");
        }

        return {
          system: updatedSystem,
          wasUpdated: !wasNewSystemCreated,
          pcNameChanged: false, // New system, so no PC name change
          duplicateDetected: true,
          mergedCount: mergeResult.merged
        };
      } else {
        // No old systems to merge (shouldn't happen, but handle gracefully)
        console.log(`[AUTO-MERGE] No old systems to merge (all systems already merged)`);
        return {
          system: newSystem,
          wasUpdated: !wasNewSystemCreated,
          pcNameChanged: false,
          duplicateDetected: true,
          mergedCount: 0
        };
      }
    }

    // No duplicates - proceed with normal logic
    const existingSystem = allSystemsWithMacId.length > 0 ? allSystemsWithMacId[0] : undefined;

    if (existingSystem) {
      // System exists - check if PC name changed
      const pcNameChanged = existingSystem.pcName !== pcName;
      const oldPcName = pcNameChanged ? existingSystem.pcName : undefined;

      // If systemUserId is provided and different, update it
      const updates: any = {
        pcName,
        machineOn: 1,
        lastConnected: now,
        lastUpdated: now, // Server timestamp for status check
        timeOffset: calculatedTimeOffset !== null ? calculatedTimeOffset : existingSystem.timeOffset // Use new offset if available
      };

      // Update systemUserId if provided
      if (systemUserId !== undefined) {
        updates.systemUserId = systemUserId;
      }

      // Update the system with new PC name and mark as online
      // Update the system with new PC name and mark as online
      const updated = await this.updateSystem(existingSystem.machineId, updates);

      if (!updated) {
        throw new Error("Failed to update system");
      }

      // Create notification if PC name changed
      if (pcNameChanged) {
        await this.createNotification({
          machineId: existingSystem.machineId,
          notificationType: 'pc_name_changed',
          title: 'PC Name Changed',
          message: `PC name changed from "${oldPcName}" to "${pcName}" for system with MAC ID: ${macId}`,
          oldValue: oldPcName,
          newValue: pcName,
          macId: macId,
          isRead: 0
        });
      }

      return {
        system: updated,
        wasUpdated: true,
        pcNameChanged,
        oldPcName,
        duplicateDetected: allSystemsWithMacId.length > 1,
        duplicateSystems: allSystemsWithMacId.length > 1 ? allSystemsWithMacId : undefined
      };
    } else {
      // New system - create it
      const newSystem = await this.createSystem({
        pcName,
        macId,
        usbStatus: 0, // Default: USB disabled
        machineOn: 1, // Online
        lastConnected: now,
        lastUpdated: now, // Server timestamp for status check
        timeOffset: calculatedTimeOffset,
        systemUserId: systemUserId !== undefined ? systemUserId : null
      });

      // Create notification for new system registration
      await this.createNotification({
        machineId: newSystem.machineId,
        notificationType: 'system_registered',
        title: 'New System Registered',
        message: `New system "${pcName}" registered with MAC ID: ${macId}`,
        newValue: pcName,
        macId: macId,
        isRead: 0
      });

      return {
        system: newSystem,
        wasUpdated: false,
        pcNameChanged: false,
        duplicateDetected: false
      };
    }
  }

  // ==================== SYSTEM NOTIFICATIONS ====================
  async createNotification(notification: InsertSystemNotification): Promise<SystemNotification> {
    const notificationUid = randomUUID();
    const result = await db.insert(systemNotifications).values({
      ...notification,
      notificationUid
    });
    const insertedId = (result as any).insertId as number | undefined;
    if (!insertedId) throw new Error("Failed to create notification");
    const created = await db.select().from(systemNotifications).where(eq(systemNotifications.id, insertedId)).limit(1);
    if (!created[0]) throw new Error("Failed to retrieve created notification");
    return created[0];
  }

  async getNotifications(limit: number = 100, unreadOnly: boolean = false): Promise<SystemNotification[]> {
    let query = db.select().from(systemNotifications);

    if (unreadOnly) {
      query = query.where(eq(systemNotifications.isRead, 0)) as any;
    }

    const result = await query.orderBy(desc(systemNotifications.createdAt)).limit(limit);
    return result;
  }

  async markNotificationAsRead(id: number): Promise<SystemNotification | undefined> {
    await db.update(systemNotifications)
      .set({ isRead: 1 })
      .where(eq(systemNotifications.id, id));
    const result = await db.select().from(systemNotifications).where(eq(systemNotifications.id, id)).limit(1);
    return result[0];
  }

  async markAllNotificationsAsRead(): Promise<number> {
    const result = await db.update(systemNotifications)
      .set({ isRead: 1 })
      .where(eq(systemNotifications.isRead, 0));
    return (result as any).affectedRows || 0;
  }

  async getUnreadNotificationCount(): Promise<number> {
    const result = await db.select({ count: count() })
      .from(systemNotifications)
      .where(eq(systemNotifications.isRead, 0));
    return result[0]?.count || 0;
  }

  // ==================== CLIENT STATUS MANAGEMENT ====================
  /**
   * Reset client_status from 1 (online) to 0 (offline) for systems where client_status_updated_at is more than 1 minute ago
   * This is called periodically by the background job
   * Note: client_status = 1 means online, client_status = 0 means offline
   */
  async resetExpiredClientStatus(): Promise<number> {
    try {
      // Use application server time
      const now = new Date();

      // Calculate 1 minute ago
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

      // Find all systems with client_status = 1 (online) and client_status_updated_at older than 1 minute
      // After 1 minute, reset to 0 (offline) so normal online/offline logic takes over
      const systemsToReset = await db
        .select({
          machineId: clientMaster.machineId,
          clientStatusUpdatedAt: clientMaster.clientStatusUpdatedAt,
        })
        .from(clientMaster)
        .where(
          and(
            eq(clientMaster.clientStatus, 1),
            sql`${clientMaster.clientStatusUpdatedAt} IS NOT NULL`,
            sql`${clientMaster.clientStatusUpdatedAt} <= ${oneMinuteAgo}`
          )
        );

      if (systemsToReset.length === 0) {
        return 0;
      }

      // Reset client_status to 0 (offline) for all expired systems
      // This allows normal online/offline logic to take over
      const machineIds = systemsToReset.map(s => s.machineId);
      const result = await db
        .update(clientMaster)
        .set({
          clientStatus: 0,
          clientStatusUpdatedAt: null
        })
        .where(inArray(clientMaster.machineId, machineIds));

      const affectedRows = (result as any).affectedRows || 0;

      if (affectedRows > 0) {
        console.log(`[CLIENT STATUS RESET] Reset ${affectedRows} system(s) from client_status=1 (online) to 0 (offline) after 1 minute`);
      }

      return affectedRows;
    } catch (error: any) {
      console.error('[CLIENT STATUS RESET ERROR]', error);
      return 0;
    }
  }

  /**
   * Update client_status to 1 (online) and set client_status_updated_at to current time
   * This should be called when you want to force a system to show as online via client_status
   */
  async setClientStatusOnline(machineId: number): Promise<ClientMaster | undefined> {
    const now = new Date();
    await db
      .update(clientMaster)
      .set({
        clientStatus: 1,
        clientStatusUpdatedAt: now
      })
      .where(eq(clientMaster.machineId, machineId));
    return await this.getSystem(machineId);
  }

  /**
   * Update client_status to 0 (offline)
   * This should be called when you want to force a system to show as offline via client_status
   */
  async setClientStatusOffline(machineId: number): Promise<ClientMaster | undefined> {
    await db
      .update(clientMaster)
      .set({
        clientStatus: 0,
        clientStatusUpdatedAt: null
      })
      .where(eq(clientMaster.machineId, machineId));
    return await this.getSystem(machineId);
  }

  /**
   * Set all machines to offline (client_status = 0)
   * This is used by the background job to reset all machines every 5 minutes
   */
  async setAllMachinesOffline(): Promise<number> {
    try {
      // First, check if client_status_updated_at column exists
      let hasUpdatedAtColumn = false;
      try {
        const checkResult = await db.execute(sql`
          SELECT COUNT(*) as count
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'client_master'
          AND COLUMN_NAME = 'client_status_updated_at'
        `);
        const rows = Array.isArray(checkResult) && Array.isArray(checkResult[0]) ? checkResult[0] : checkResult;
        hasUpdatedAtColumn = (rows as any[])[0]?.count > 0;
      } catch (checkError: any) {
        console.warn('[SET ALL MACHINES OFFLINE] Could not check for client_status_updated_at column:', checkError.message);
      }

      // Use raw SQL to update ALL machines to offline (client_status = 0)
      // This updates all machines regardless of their current status (including null)
      let result;
      if (hasUpdatedAtColumn) {
        result = await db.execute(sql`
          UPDATE client_master 
          SET client_status = 0, client_status_updated_at = NULL
        `);
      } else {
        result = await db.execute(sql`
          UPDATE client_master 
          SET client_status = 0
        `);
      }

      // Drizzle's db.execute() for UPDATE returns [ResultSetHeader, ...]
      // ResultSetHeader has affectedRows property
      let affectedRows = 0;
      if (Array.isArray(result) && result.length > 0) {
        // First element is the ResultSetHeader
        affectedRows = (result[0] as any)?.affectedRows || 0;
      } else if ((result as any)?.affectedRows !== undefined) {
        affectedRows = (result as any).affectedRows;
      }

      if (affectedRows > 0) {
        console.log(`[SET ALL MACHINES OFFLINE] Set ${affectedRows} machine(s) to offline (client_status = 0)`);
      } else {
        console.log(`[SET ALL MACHINES OFFLINE] No machines updated (may already be offline or no machines exist)`);
      }

      return affectedRows;
    } catch (error: any) {
      // If client_status column doesn't exist, log and return 0
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        console.warn('[SET ALL MACHINES OFFLINE] client_status column does not exist, skipping update');
        return 0;
      }
      console.error('[SET ALL MACHINES OFFLINE ERROR]', error);
      console.error('[SET ALL MACHINES OFFLINE ERROR] Code:', error.code);
      console.error('[SET ALL MACHINES OFFLINE ERROR] Message:', error.message);
      return 0;
    }
  }
}

export const storage = new DatabaseStorage();

// ==================== GLOBAL BACKGROUND FUNCTIONS ====================
/**
 * Automatically detect and merge duplicate MAC IDs
 * This function finds all duplicate MAC IDs and merges them automatically
 */
async function autoMergeDuplicateMacIds(): Promise<number> {
  try {
    console.log('[AUTO-MERGE JOB] Checking for duplicate MAC IDs...');
    const duplicates = await storage.getDuplicateMacIds();

    if (duplicates.length === 0) {
      console.log('[AUTO-MERGE JOB] No duplicates found');
      return 0;
    }

    console.log(`[AUTO-MERGE JOB] Found ${duplicates.length} duplicate MAC ID groups`);

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

        console.log(`[AUTO-MERGE JOB] MAC ID: ${normalizedMacId} - Keeping system ${keepSystem.machineId} (${keepSystem.pcName}), merging ${mergeMachineIds.length} systems`);

        // Automatically merge duplicates
        console.log(`[AUTO-MERGE JOB] Starting merge for MAC ID ${normalizedMacId}...`);
        const mergeResult = await storage.mergeDuplicateMacId(normalizedMacId, keepSystem.machineId, mergeMachineIds);

        if (!mergeResult.success || mergeResult.merged === 0) {
          console.error(`[AUTO-MERGE JOB] Merge failed for MAC ID ${normalizedMacId}:`, mergeResult);
          continue; // Skip to next duplicate group
        }

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
          console.log(`[AUTO-MERGE JOB] Notification created for MAC ID ${normalizedMacId}`);
        } catch (notifError: any) {
          console.error(`[AUTO-MERGE JOB] Failed to create notification (merge was successful):`, notifError);
          // Don't throw - merge was successful, notification failure is non-critical
        }

        console.log(`[AUTO-MERGE JOB] Successfully merged ${mergeResult.merged} systems for MAC ID ${normalizedMacId}`);
        totalMerged += mergeResult.merged;
      } catch (error: any) {
        console.error(`[AUTO-MERGE JOB] Error merging duplicates for MAC ID ${duplicate.macId}:`, error);
        // Continue with next duplicate group
      }
    }

    if (totalMerged > 0) {
      console.log(`[AUTO-MERGE JOB] Completed: Merged ${totalMerged} duplicate systems across ${duplicates.length} MAC ID groups`);
    }

    return totalMerged;
  } catch (error: any) {
    console.error('[AUTO-MERGE JOB] Error:', error);
    return 0;
  }
}

let duplicateMergeInterval: NodeJS.Timeout | null = null;

export function startDuplicateMergeJob(): void {
  // Clear any existing interval
  if (duplicateMergeInterval) {
    clearInterval(duplicateMergeInterval);
  }

  // Run immediately on startup to merge any existing duplicates
  autoMergeDuplicateMacIds().catch(err => {
    console.error('[AUTO-MERGE JOB] Error on startup:', err);
  });

  // Then run every 5 minutes to check for new duplicates
  duplicateMergeInterval = setInterval(async () => {
    try {
      await autoMergeDuplicateMacIds();
    } catch (error: any) {
      console.error('[AUTO-MERGE JOB] Error:', error);
    }
  }, 5 * 60 * 1000); // 5 minutes

  console.log('[AUTO-MERGE JOB] Started - will automatically merge duplicate MAC IDs every 5 minutes');
}

export function stopDuplicateMergeJob(): void {
  if (duplicateMergeInterval) {
    clearInterval(duplicateMergeInterval);
    duplicateMergeInterval = null;
    console.log('[AUTO-MERGE JOB] Stopped');
  }
}

/**
 * Global function to reset client_status from 1 to 0 after 1 minute
 * This runs every 30 seconds to check and reset expired client_status values
 */
let clientStatusResetInterval: NodeJS.Timeout | null = null;

export function startClientStatusResetJob(): void {
  // Clear any existing interval
  if (clientStatusResetInterval) {
    clearInterval(clientStatusResetInterval);
  }

  // Run immediately on startup
  storage.resetExpiredClientStatus().catch(err => {
    console.error('[CLIENT STATUS RESET JOB] Error on startup:', err);
  });

  // Then run every 30 seconds
  clientStatusResetInterval = setInterval(async () => {
    try {
      await storage.resetExpiredClientStatus();
    } catch (error: any) {
      console.error('[CLIENT STATUS RESET JOB] Error:', error);
    }
  }, 30 * 1000); // 30 seconds

  console.log('[CLIENT STATUS RESET JOB] Started - will reset client_status from 1 to 0 after 1 minute');
}

export function stopClientStatusResetJob(): void {
  if (clientStatusResetInterval) {
    clearInterval(clientStatusResetInterval);
    clientStatusResetInterval = null;
    console.log('[CLIENT STATUS RESET JOB] Stopped');
  }
}

/**
 * Background job to set all machines to offline every 5 minutes
 * This ensures that machines need to actively report their status to remain online
 */
let setAllMachinesOfflineInterval: NodeJS.Timeout | null = null;

export function startSetAllMachinesOfflineJob(): void {
  // Clear any existing interval
  if (setAllMachinesOfflineInterval) {
    clearInterval(setAllMachinesOfflineInterval);
  }

  // Run immediately on startup
  storage.setAllMachinesOffline().then(affectedRows => {
    if (affectedRows > 0) {
      console.log(`[SET ALL MACHINES OFFLINE JOB] Startup: Set ${affectedRows} machine(s) to offline`);
    }
  }).catch(err => {
    console.error('[SET ALL MACHINES OFFLINE JOB] Error on startup:', err);
  });

  // Then run every 5 minutes
  setAllMachinesOfflineInterval = setInterval(async () => {
    try {
      const affectedRows = await storage.setAllMachinesOffline();
      if (affectedRows > 0) {
        console.log(`[SET ALL MACHINES OFFLINE JOB] Periodic update: Set ${affectedRows} machine(s) to offline`);
      }
    } catch (error: any) {
      console.error('[SET ALL MACHINES OFFLINE JOB] Error:', error);
    }
  }, 5 * 60 * 1000); // 5 minutes

  console.log('[SET ALL MACHINES OFFLINE JOB] Started - will set all machines to offline every 5 minutes');
}

export function stopSetAllMachinesOfflineJob(): void {
  if (setAllMachinesOfflineInterval) {
    clearInterval(setAllMachinesOfflineInterval);
    setAllMachinesOfflineInterval = null;
  }
}
