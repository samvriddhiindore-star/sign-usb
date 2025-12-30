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
  registerOrUpdateSystemByMacId(pcName: string, macId: string, clientTime?: string, systemUserId?: number | null): Promise<{ system: ClientMaster; wasUpdated: boolean; pcNameChanged: boolean; oldPcName?: string; duplicateDetected?: boolean; duplicateSystems?: ClientMaster[] }>;
  
  // System Notifications
  createNotification(notification: InsertSystemNotification): Promise<SystemNotification>;
  getNotifications(limit?: number, unreadOnly?: boolean): Promise<SystemNotification[]>;
  markNotificationAsRead(id: number): Promise<SystemNotification | undefined>;
  markAllNotificationsAsRead(): Promise<number>;
  getUnreadNotificationCount(): Promise<number>;
}

class DatabaseStorage implements IStorage {
  // ==================== HELPER METHODS ====================
  /**
   * Get the current database server time
   * This ensures we use the database server's clock, not the application server's clock
   */
  private async getDatabaseServerTime(): Promise<Date> {
    const result = await db.execute(sql`SELECT NOW() as db_time`);
    const dbTime = (result as any)[0]?.db_time;
    if (!dbTime) {
      // Fallback to application server time if DB query fails
      console.warn('[WARNING] Failed to get database server time, using application server time');
      return new Date();
    }
    return new Date(dbTime);
  }

  /**
   * Check if a system is online based on last_connected time
   * System is considered offline if last_connected is more than 30 seconds old (using client time)
   * 
   * Time Adjustment Logic (using DATABASE SERVER TIME):
   * 1. Calculate time difference: timeOffset = db_server_time - client_time (stored in DB)
   *    Example: DB Server = 2 PM, Client = 12 PM → timeOffset = +2 hours = +7200000 ms
   * 
   * 2. When checking online status:
   *    - Get current DATABASE server time (e.g., 2:00:30 PM)
   *    - Adjust to client time: client_current = db_server_time - timeOffset (e.g., 12:00:30 PM)
   *    - Get last_connected (stored as database server time, e.g., 2:00:00 PM)
   *    - Adjust to client time: client_last_connected = stored_db_server_time - timeOffset (e.g., 12:00:00 PM)
   *    - Compare in client time: difference = 12:00:30 PM - 12:00:00 PM = 30 seconds
   * 
   * 3. If difference in client time <= 30 seconds → Online, else → Offline
   */
  async isSystemOnline(machineOn: number | null, lastConnected: Date | null, timeOffset: number | null): Promise<boolean> {
    // If machineOn is explicitly 0, system is offline
    if (machineOn === 0) return false;
    
    // If lastConnected is null or undefined, system is offline
    if (!lastConnected) return false;
    
    // Get current DATABASE server time (not application server time)
    const dbServerNow = await this.getDatabaseServerTime();
    
    // Convert lastConnected to Date if it's not already
    const lastConnectedDbServerTime = lastConnected instanceof Date ? lastConnected : new Date(lastConnected);
    
    // Handle invalid dates
    if (isNaN(lastConnectedDbServerTime.getTime())) {
      return false;
    }
    
    // If timeOffset is not available, fall back to simple database server time check (30 seconds)
    if (timeOffset === null || timeOffset === undefined) {
      const diffInMs = dbServerNow.getTime() - lastConnectedDbServerTime.getTime();
      const diffInSeconds = diffInMs / 1000;
      return diffInSeconds >= 0 && diffInSeconds <= 30;
    }
    
    // TIME ADJUSTMENT LOGIC (using DATABASE SERVER TIME):
    // Step 1: Calculate client's current time by adjusting database server time
    // client_time = db_server_time - time_offset
    const clientNow = new Date(dbServerNow.getTime() - timeOffset);
    
    // Step 2: Calculate client's last connected time by adjusting stored database server time
    // client_last_connected = stored_db_server_time - time_offset
    const lastConnectedClientTime = new Date(lastConnectedDbServerTime.getTime() - timeOffset);
    
    // Step 3: Compare in client time domain
    const diffInMs = clientNow.getTime() - lastConnectedClientTime.getTime();
    const diffInSeconds = diffInMs / 1000;
    
    // Debug logging (can be removed in production)
    if (process.env.NODE_ENV === 'development') {
      const offsetHours = (timeOffset / (1000 * 60 * 60)).toFixed(2);
      console.log(`[TIME ADJUSTMENT] Machine check (using DB server time):`, {
        dbServerTime: dbServerNow.toISOString(),
        clientTime: clientNow.toISOString(),
        lastConnectedDbServer: lastConnectedDbServerTime.toISOString(),
        lastConnectedClient: lastConnectedClientTime.toISOString(),
        timeOffsetHours: `${offsetHours} hours`,
        diffInSeconds: diffInSeconds.toFixed(2),
        isOnline: diffInSeconds >= 0 && diffInSeconds <= 30
      });
    }
    
    // System is online if difference in client time is within 30 seconds
    // If difference is negative (future date) or more than 30 seconds, system is offline
    return diffInSeconds >= 0 && diffInSeconds <= 30;
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
      .orderBy(desc(clientMaster.lastConnected));
    
    return result.map(row => ({
      machineId: row.machineId,
      pcName: row.pcName,
      macId: row.macId,
      usbStatus: row.usbStatus,
      machineOn: row.machineOn,
      lastConnected: row.lastConnected,
      timeOffset: row.timeOffset,
      remark: row.remark,
      createdAt: row.createdAt,
      systemUserId: row.systemUserId,
      systemUser: row.systemUser,
    }));
  }

  async getSystem(machineId: number): Promise<ClientWithSystemUser | undefined> {
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
      remark: row.remark,
      createdAt: row.createdAt,
      systemUserId: row.systemUserId,
      systemUser: row.systemUser,
    };
  }

  async getSystemByMacId(macId: string): Promise<ClientMaster | undefined> {
    const result = await db.select().from(clientMaster).where(eq(clientMaster.macId, macId)).limit(1);
    return result[0];
  }

  async getSystemsByMacId(macId: string): Promise<ClientMaster[]> {
    return await db.select().from(clientMaster).where(eq(clientMaster.macId, macId));
  }

  async getDuplicateMacIds(): Promise<{ macId: string; count: number; systems: ClientMaster[] }[]> {
    try {
      // Get all systems and group by MAC ID in JavaScript (more reliable than SQL GROUP BY)
      const allSystems = await db.select().from(clientMaster);
      
      // Group by MAC ID
      const macIdMap = new Map<string, ClientMaster[]>();
      
      allSystems.forEach(system => {
        const macId = system.macId?.trim() || '';
        if (macId) {
          if (!macIdMap.has(macId)) {
            macIdMap.set(macId, []);
          }
          macIdMap.get(macId)!.push(system);
        }
      });

      // Find duplicates (MAC IDs with more than 1 system)
      const duplicates: { macId: string; count: number; systems: ClientMaster[] }[] = [];

      macIdMap.forEach((systems, macId) => {
        if (systems.length > 1) {
          duplicates.push({
            macId: macId,
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
    const allIds = [keepMachineId, ...mergeMachineIds];
    
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

    // Merge logic:
    // 1. Transfer devices from merged systems to the kept system
    // 2. Transfer USB logs references
    // 3. Delete the merged systems

    let mergedCount = 0;

    for (const mergeId of mergeMachineIds) {
      const mergeSystem = allSystems.find(s => s.machineId === mergeId);
      if (!mergeSystem) continue;

      // Update devices to point to the kept system
      await db.update(deviceMaster)
        .set({ machineId: keepMachineId })
        .where(eq(deviceMaster.machineId, mergeId));

      // Update USB logs to point to the kept system
      await db.update(clientUsbStatus)
        .set({ machineId: keepMachineId })
        .where(eq(clientUsbStatus.machineId, mergeId));

      // Update notifications to point to the kept system
      await db.update(systemNotifications)
        .set({ machineId: keepMachineId })
        .where(eq(systemNotifications.machineId, mergeId));

      // Delete the merged system
      await this.deleteSystem(mergeId);
      mergedCount++;
    }

    return {
      success: true,
      merged: mergedCount,
      message: `Successfully merged ${mergedCount} system(s) into system ${keepMachineId} (${keepSystem.pcName})`
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
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - dayThreshold);
    
    const result = await db.select().from(clientMaster).where(
      sql`${clientMaster.machineOn} = 0 OR ${clientMaster.lastConnected} < ${thresholdDate} OR ${clientMaster.lastConnected} IS NULL`
    );
    return result;
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
          device.timeOffset ?? null
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
  async getDevicesByMachineReport(): Promise<{ machineId: number; pcName: string; macId: string; machineOn: number; lastConnected: Date | null; timeOffset: number | null; totalDevices: number; allowedDevices: number; blockedDevices: number; devices: DeviceMasterWithDescription[] }[]> {
    const machines = await db.select().from(clientMaster).orderBy(desc(clientMaster.lastConnected));
    
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
    const machines = await db.select().from(clientMaster);
    const byMachine = await Promise.all(
      machines.map(async (machine) => {
        const devices = await this.getDevicesByMachine(machine.machineId);
        const lastDeviceAdded = devices.length > 0 
          ? devices.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))[0].createdAt
          : null;
        const isOnline = await this.isSystemOnline(machine.machineOn, machine.lastConnected, machine.timeOffset);
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
        isOnline: await this.isSystemOnline(machine.machineOn, machine.lastConnected, machine.timeOffset)
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
    // Basic counts
    const totalResult = await db.select({ count: count() }).from(clientMaster);
    const totalSystems = totalResult[0]?.count || 0;

    // Get all systems to check online/offline based on last_connected time (30 second rule using client time)
    const allSystems = await db.select({
      machineOn: clientMaster.machineOn,
      lastConnected: clientMaster.lastConnected,
      timeOffset: clientMaster.timeOffset,
    }).from(clientMaster);

    // Count online systems: machineOn = 1 AND last_connected within 30 seconds (using client time)
    const systemStatuses = await Promise.all(
      allSystems.map(s => this.isSystemOnline(s.machineOn, s.lastConnected, s.timeOffset))
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
    }).from(clientMaster);

    // Count online systems: machineOn = 1 AND last_connected within 30 seconds (using client time)
    const systemStatuses = await Promise.all(
      allSystems.map(async (s) => {
        const isOnline = await this.isSystemOnline(s.machineOn, s.lastConnected, s.timeOffset);
        
        // Debug logging (using database server time)
        if (!isOnline && s.machineOn === 1) {
          const dbServerNow = await this.getDatabaseServerTime();
          const lastConnectedTime = s.lastConnected ? new Date(s.lastConnected) : null;
          const diffInMs = lastConnectedTime ? dbServerNow.getTime() - lastConnectedTime.getTime() : null;
          const diffInSeconds = diffInMs ? diffInMs / 1000 : null;
          console.log(`[DASHBOARD DEBUG] System marked offline (DB server time):`, {
            machineOn: s.machineOn,
            lastConnected: s.lastConnected?.toISOString(),
            dbServerTime: dbServerNow.toISOString(),
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
   * - Uses DATABASE SERVER time for lastConnected (stored in DB)
   * - Calculates and stores time offset (db_server_time - client_time) for accurate online/offline detection
   */
  async registerOrUpdateSystemByMacId(pcName: string, macId: string, clientTime?: string, systemUserId?: number | null): Promise<{ system: ClientMaster; wasUpdated: boolean; pcNameChanged: boolean; oldPcName?: string; duplicateDetected?: boolean; duplicateSystems?: ClientMaster[] }> {
    // Check for duplicate MAC IDs
    const allSystemsWithMacId = await this.getSystemsByMacId(macId);
    const existingSystem = allSystemsWithMacId.length > 0 ? allSystemsWithMacId[0] : undefined;
    
    // If there are multiple systems with the same MAC ID, log a warning
    if (allSystemsWithMacId.length > 1) {
      console.warn(`[DUPLICATE MAC ID DETECTED] MAC ID ${macId} has ${allSystemsWithMacId.length} systems:`, 
        allSystemsWithMacId.map(s => ({ machineId: s.machineId, pcName: s.pcName, systemUserId: s.systemUserId }))
      );
    }
    
    // Get DATABASE SERVER time (not application server time)
    const dbServerTime = await this.getDatabaseServerTime();
    
    // Calculate time offset if client time is provided
    // TIME DIFFERENCE CALCULATION (using DATABASE SERVER TIME):
    // timeOffset = db_server_time - client_time (in milliseconds)
    // Example: DB Server = 2:00 PM, Client = 12:00 PM → timeOffset = +2 hours = +7200000 ms
    // This offset is stored in the database and used to adjust timestamps for comparison
    let timeOffset: number | null = null;
    if (clientTime) {
      try {
        const clientTimeDate = new Date(clientTime);
        if (!isNaN(clientTimeDate.getTime())) {
          // Calculate the difference: db_server_time - client_time
          timeOffset = dbServerTime.getTime() - clientTimeDate.getTime();
          
          // Log the time difference calculation for debugging
          const offsetHours = (timeOffset / (1000 * 60 * 60)).toFixed(2);
          const offsetMinutes = (timeOffset / (1000 * 60)).toFixed(2);
          console.log(`[TIME OFFSET CALCULATION] System: ${pcName} (${macId})`, {
            dbServerTime: dbServerTime.toISOString(),
            clientTime: clientTimeDate.toISOString(),
            timeOffsetMs: timeOffset,
            timeOffsetHours: `${offsetHours} hours`,
            timeOffsetMinutes: `${offsetMinutes} minutes`,
            note: timeOffset > 0 ? 'DB Server is ahead' : timeOffset < 0 ? 'Client is ahead' : 'Times are synchronized'
          });
        }
      } catch (e) {
        console.warn(`[registerOrUpdateSystemByMacId] Invalid client time: ${clientTime}`);
      }
    }
    
    if (existingSystem) {
      // System exists - check if PC name changed
      const pcNameChanged = existingSystem.pcName !== pcName;
      const oldPcName = pcNameChanged ? existingSystem.pcName : undefined;
      
      // If systemUserId is provided and different, update it
      const updates: any = {
        pcName,
        machineOn: 1,
        lastConnected: dbServerTime, // DATABASE SERVER time
        timeOffset: timeOffset !== null ? timeOffset : existingSystem.timeOffset // Keep existing offset if new one is null
      };
      
      // Update systemUserId if provided
      if (systemUserId !== undefined) {
        updates.systemUserId = systemUserId;
      }
      
      // Update the system with new PC name and mark as online
      // Store DATABASE SERVER time in lastConnected, and time offset for client time calculations
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
      // Store DATABASE SERVER time in lastConnected, and time offset for client time calculations
      const newSystem = await this.createSystem({
        pcName,
        macId,
        usbStatus: 0, // Default: USB disabled
        machineOn: 1, // Online
        lastConnected: dbServerTime, // DATABASE SERVER time
        timeOffset: timeOffset, // Time offset in milliseconds
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
}

export const storage = new DatabaseStorage();
