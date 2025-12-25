import { randomUUID } from "crypto";
import { db } from "./db";
import { 
  clientMaster,
  clientUsbStatus,
  profileMaster,
  urlMaster,
  deviceMaster,
  admins,
  type ClientMaster,
  type ClientUsbStatus,
  type ProfileMaster,
  type UrlMaster,
  type DeviceMaster,
  type Admin,
  type InsertClientMaster,
  type InsertClientUsbStatus,
  type InsertProfileMaster,
  type InsertUrlMaster,
  type InsertDeviceMaster,
  type InsertAdmin,
  type DashboardStats,
  type ClientWithProfile,
  type ProfileWithMachines,
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
  getSystems(): Promise<ClientWithProfile[]>;
  getSystem(machineId: number): Promise<ClientWithProfile | undefined>;
  getSystemByMacId(macId: string): Promise<ClientMaster | undefined>;
  createSystem(system: InsertClientMaster): Promise<ClientMaster>;
  updateSystem(machineId: number, updates: Partial<ClientMaster>): Promise<ClientMaster | undefined>;
  deleteSystem(machineId: number): Promise<boolean>;
  updateSystemUsbStatus(machineId: number, usbStatus: number): Promise<ClientMaster | undefined>;
  bulkUpdateUsbStatus(machineIds: number[], usbStatus: number): Promise<number>;
  getDisconnectedSystems(dayThreshold: number): Promise<ClientMaster[]>;
  assignProfileToSystem(machineId: number, profileId: number | null): Promise<ClientMaster | undefined>;
  bulkAssignProfile(machineIds: number[], profileId: number | null): Promise<number>;
  getSystemsByProfile(profileId: number): Promise<ClientMaster[]>;
  
  // USB Logs
  getUsbLogs(limit?: number): Promise<(ClientUsbStatus & { pcName?: string })[]>;
  getUsbLogsByMachine(machineId: number, limit?: number): Promise<ClientUsbStatus[]>;
  getConnectedUsbDevices(): Promise<(ClientUsbStatus & { pcName?: string })[]>;
  createUsbLog(log: InsertClientUsbStatus): Promise<ClientUsbStatus>;
  updateUsbLog(id: number, updates: Partial<ClientUsbStatus>): Promise<ClientUsbStatus | undefined>;
  
  // Profiles
  getProfiles(): Promise<ProfileWithMachines[]>;
  getProfile(profileId: number): Promise<ProfileWithMachines | undefined>;
  createProfile(profile: InsertProfileMaster): Promise<ProfileMaster>;
  updateProfile(profileId: number, updates: Partial<ProfileMaster>): Promise<ProfileMaster | undefined>;
  deleteProfile(profileId: number): Promise<boolean>;
  applyProfileUsbPolicy(profileId: number): Promise<number>;
  
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
}

class DatabaseStorage implements IStorage {
  // ==================== HELPER METHODS ====================
  /**
   * Check if a system is online based on last_connected time
   * System is considered offline if last_connected is more than 1 minute old
   */
  private isSystemOnline(machineOn: number | null, lastConnected: Date | null): boolean {
    // If machineOn is explicitly 0, system is offline
    if (machineOn === 0) return false;
    
    // If lastConnected is null or undefined, system is offline
    if (!lastConnected) return false;
    
    const now = new Date();
    const lastConnectedTime = new Date(lastConnected);
    
    // Handle invalid dates
    if (isNaN(lastConnectedTime.getTime())) {
      console.warn(`[isSystemOnline] Invalid lastConnected date: ${lastConnected}`);
      return false;
    }
    
    const diffInMs = now.getTime() - lastConnectedTime.getTime();
    const diffInMinutes = diffInMs / (1000 * 60);
    
    // If last connected is more than 1 minute ago, consider offline
    // Also handle negative differences (future dates) as offline
    if (diffInMinutes < 0) {
      console.warn(`[isSystemOnline] Future date detected: ${lastConnected}, diff: ${diffInMinutes.toFixed(2)} minutes`);
      return false;
    }
    
    const isOnline = diffInMinutes <= 1;
    return isOnline;
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
  async getSystems(): Promise<ClientWithProfile[]> {
    const result = await db
      .select({
        machineId: clientMaster.machineId,
        pcName: clientMaster.pcName,
        macId: clientMaster.macId,
        usbStatus: clientMaster.usbStatus,
        machineOn: clientMaster.machineOn,
        lastConnected: clientMaster.lastConnected,
        remark: clientMaster.remark,
        createdAt: clientMaster.createdAt,
        profileId: clientMaster.profileId,
        profile: profileMaster,
      })
      .from(clientMaster)
      .leftJoin(profileMaster, eq(clientMaster.profileId, profileMaster.profileId))
      .orderBy(desc(clientMaster.lastConnected));
    
    return result.map(row => ({
      machineId: row.machineId,
      pcName: row.pcName,
      macId: row.macId,
      usbStatus: row.usbStatus,
      machineOn: row.machineOn,
      lastConnected: row.lastConnected,
      remark: row.remark,
      createdAt: row.createdAt,
      profileId: row.profileId,
      profile: row.profile,
    }));
  }

  async getSystem(machineId: number): Promise<ClientWithProfile | undefined> {
    const result = await db
      .select({
        machineId: clientMaster.machineId,
        pcName: clientMaster.pcName,
        macId: clientMaster.macId,
        usbStatus: clientMaster.usbStatus,
        machineOn: clientMaster.machineOn,
        lastConnected: clientMaster.lastConnected,
        remark: clientMaster.remark,
        createdAt: clientMaster.createdAt,
        profileId: clientMaster.profileId,
        profile: profileMaster,
      })
      .from(clientMaster)
      .leftJoin(profileMaster, eq(clientMaster.profileId, profileMaster.profileId))
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
      remark: row.remark,
      createdAt: row.createdAt,
      profileId: row.profileId,
      profile: row.profile,
    };
  }

  async getSystemByMacId(macId: string): Promise<ClientMaster | undefined> {
    const result = await db.select().from(clientMaster).where(eq(clientMaster.macId, macId)).limit(1);
    return result[0];
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

  async assignProfileToSystem(machineId: number, profileId: number | null): Promise<ClientMaster | undefined> {
    // Enforce one profile per machine: if assigning a profile, unassign it from any other machine first
    if (profileId !== null) {
      // Find any other machine that has this profile assigned
      const existingMachines = await db.select()
        .from(clientMaster)
        .where(and(
          eq(clientMaster.profileId, profileId),
          ne(clientMaster.machineId, machineId)
        ));
      
      // Unassign the profile from other machines
      if (existingMachines.length > 0) {
        await db.update(clientMaster)
          .set({ profileId: null })
          .where(and(
            eq(clientMaster.profileId, profileId),
            ne(clientMaster.machineId, machineId)
          ));
      }
    }
    
    // Assign the profile to the requested machine
    await db.update(clientMaster)
      .set({ profileId })
      .where(eq(clientMaster.machineId, machineId));
    
    const result = await db.select().from(clientMaster).where(eq(clientMaster.machineId, machineId)).limit(1);
    return result[0];
  }

  async bulkAssignProfile(machineIds: number[], profileId: number | null): Promise<number> {
    if (machineIds.length === 0) return 0;
    
    // Enforce one profile per machine: if assigning a profile, unassign it from any other machines first
    if (profileId !== null) {
      // Find any machines that have this profile assigned (excluding the ones we're assigning to)
      const existingMachines = await db.select()
        .from(clientMaster)
        .where(and(
          eq(clientMaster.profileId, profileId),
          sql`${clientMaster.machineId} NOT IN (${sql.join(machineIds.map(id => sql`${id}`), sql`, `)})`
        ));
      
      // Unassign the profile from other machines
      if (existingMachines.length > 0) {
        await db.update(clientMaster)
          .set({ profileId: null })
          .where(and(
            eq(clientMaster.profileId, profileId),
            sql`${clientMaster.machineId} NOT IN (${sql.join(machineIds.map(id => sql`${id}`), sql`, `)})`
          ));
      }
    }
    
    // Assign the profile to the requested machines
    const result = await db.update(clientMaster)
      .set({ profileId })
      .where(inArray(clientMaster.machineId, machineIds));
    return (result as any).affectedRows ?? machineIds.length;
  }

  async getSystemsByProfile(profileId: number): Promise<ClientMaster[]> {
    return await db.select().from(clientMaster)
      .where(eq(clientMaster.profileId, profileId))
      .orderBy(desc(clientMaster.lastConnected));
  }

  // ==================== USB LOGS METHODS ====================
  async getUsbLogs(limit: number = 500): Promise<(ClientUsbStatus & { pcName?: string })[]> {
    const result = await db
      .select({
        id: clientUsbStatus.id,
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
    const result = await db
      .select({
        id: clientUsbStatus.id,
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
      .where(isNull(clientUsbStatus.deviceDisconnectTime))
      .orderBy(desc(clientUsbStatus.deviceConnectTime));
    
    return result as (ClientUsbStatus & { pcName?: string })[];
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
  async getProfiles(): Promise<ProfileWithMachines[]> {
    const profiles = await db.select().from(profileMaster).orderBy(desc(profileMaster.createdAt));
    
    const profilesWithMachines = await Promise.all(
      profiles.map(async (profile) => {
        const machines = await this.getSystemsByProfile(profile.profileId);
        return {
          ...profile,
          machines,
          assignedCount: machines.length
        };
      })
    );
    
    return profilesWithMachines;
  }

  async getProfile(profileId: number): Promise<ProfileWithMachines | undefined> {
    const result = await db.select().from(profileMaster).where(eq(profileMaster.profileId, profileId)).limit(1);
    if (!result[0]) return undefined;
    
    const machines = await this.getSystemsByProfile(profileId);
    return {
      ...result[0],
      machines,
      assignedCount: machines.length
    };
  }

  async createProfile(profile: InsertProfileMaster): Promise<ProfileMaster> {
    try {
      // Generate UUID for profile_uid
      const profileUid = randomUUID();
      
      // Get the maximum profileId from the table and increment by 1
      const maxIdResult = await db
        .select({ maxId: max(profileMaster.profileId) })
        .from(profileMaster);
      
      const nextId = (maxIdResult[0]?.maxId || 0) + 1;
      
      console.log(`createProfile - Max ID: ${maxIdResult[0]?.maxId || 0}, Next ID: ${nextId}`);
      
      // Insert with the calculated ID
      await db.insert(profileMaster).values({
        ...profile,
        profileId: nextId,
        profileUid
      });
      
      // Retrieve the created profile
      const created = await db.select().from(profileMaster)
        .where(eq(profileMaster.profileId, nextId))
        .limit(1);
      
      if (!created[0]) {
        throw new Error("Failed to retrieve created profile");
      }
      
      console.log(`createProfile - Successfully created profile with ID: ${nextId}`);
      return created[0];
      
    } catch (error: any) {
      console.error("createProfile error:", error);
      
      // If insertion failed, try to find by name as fallback
      if (profile.profileName && error.code !== 'ER_DUP_ENTRY') {
        const found = await db.select().from(profileMaster)
          .where(eq(profileMaster.profileName, profile.profileName))
          .orderBy(desc(profileMaster.createdAt))
          .limit(1);
        if (found[0]) {
          console.log(`createProfile - Found existing profile by name: ${found[0].profileId}`);
          return found[0];
        }
      }
      throw error;
    }
  }

  async updateProfile(profileId: number, updates: Partial<ProfileMaster>): Promise<ProfileMaster | undefined> {
    await db.update(profileMaster).set(updates).where(eq(profileMaster.profileId, profileId));
    const result = await db.select().from(profileMaster).where(eq(profileMaster.profileId, profileId)).limit(1);
    return result[0];
  }

  async deleteProfile(profileId: number): Promise<boolean> {
    // First remove profile from all machines
    await db.update(clientMaster)
      .set({ profileId: null })
      .where(eq(clientMaster.profileId, profileId));
    
    const result = await db.delete(profileMaster).where(eq(profileMaster.profileId, profileId));
    return (result as any).affectedRows !== undefined ? (result as any).affectedRows > 0 : true;
  }

  async applyProfileUsbPolicy(profileId: number): Promise<number> {
    const profile = await db.select().from(profileMaster).where(eq(profileMaster.profileId, profileId)).limit(1);
    if (!profile[0]) return 0;
    
    const result = await db.update(clientMaster)
      .set({ usbStatus: profile[0].usbPolicy })
      .where(eq(clientMaster.profileId, profileId));
    
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
        profileId: deviceMaster.profileId,
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
        profileId: deviceMaster.profileId,
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
        profileId: deviceMaster.profileId,
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
        profileId: deviceMaster.profileId,
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
    if (deviceData.profileId !== null && deviceData.profileId !== undefined) {
      await db.update(deviceMaster)
        .set({ profileId: null })
        .where(eq(deviceMaster.profileId, deviceData.profileId));
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
    if (updateData.profileId !== null && updateData.profileId !== undefined) {
      await db.update(deviceMaster)
        .set({ profileId: null })
        .where(and(
          eq(deviceMaster.profileId, updateData.profileId),
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
  async getDevicesByMachineReport(): Promise<{ machineId: number; pcName: string; macId: string; machineOn: number; lastConnected: Date | null; totalDevices: number; allowedDevices: number; blockedDevices: number; devices: DeviceMasterWithDescription[] }[]> {
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
        const isOnline = this.isSystemOnline(machine.machineOn, machine.lastConnected);
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
    const offlineSystems = await Promise.all(
      machines
        .filter(machine => !this.isSystemOnline(machine.machineOn, machine.lastConnected))
        .map(async (machine) => {
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
    const totalResult = await db.select({ count: count() }).from(clientUsbStatus).where(whereClause);
    const totalEvents = totalResult[0]?.count || 0;

    // Events by machine
    const byMachineRaw = await db
      .select({
        machineId: clientUsbStatus.machineId,
        pcName: clientMaster.pcName,
        eventCount: count()
      })
      .from(clientUsbStatus)
      .leftJoin(clientMaster, eq(clientUsbStatus.machineId, clientMaster.machineId))
      .where(whereClause)
      .groupBy(clientUsbStatus.machineId, clientMaster.pcName)
      .orderBy(desc(count()));

    const byMachine = byMachineRaw.map(r => ({
      machineId: r.machineId,
      pcName: r.pcName || 'Unknown',
      eventCount: r.eventCount
    }));

    // Events by device
    const byDeviceRaw = await db
      .select({
        deviceName: clientUsbStatus.deviceName,
        eventCount: count()
      })
      .from(clientUsbStatus)
      .where(whereClause)
      .groupBy(clientUsbStatus.deviceName)
      .orderBy(desc(count()))
      .limit(20);

    const byDevice = byDeviceRaw.map(r => ({
      deviceName: r.deviceName,
      eventCount: r.eventCount
    }));

    // Events by date (last 30 days)
    const byDateRaw = await db
      .select({
        date: sql<string>`DATE(${clientUsbStatus.createdAt})`,
        eventCount: count()
      })
      .from(clientUsbStatus)
      .where(whereClause)
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
    systemsByProfile: { profileId: number | null; profileName: string; count: number }[];
    systemsWithDevices: { machineId: number; pcName: string; deviceCount: number }[];
    inactiveSystems: ClientMaster[];
  }> {
    // Basic counts
    const totalResult = await db.select({ count: count() }).from(clientMaster);
    const totalSystems = totalResult[0]?.count || 0;

    // Get all systems to check online/offline based on last_connected time (1 minute rule)
    const allSystems = await db.select({
      machineOn: clientMaster.machineOn,
      lastConnected: clientMaster.lastConnected,
    }).from(clientMaster);

    // Count online systems: machineOn = 1 AND last_connected within 1 minute
    const onlineSystems = allSystems.filter(s => 
      this.isSystemOnline(s.machineOn, s.lastConnected)
    ).length;

    const offlineSystems = totalSystems - onlineSystems;

    const usbEnabledResult = await db.select({ count: count() }).from(clientMaster).where(eq(clientMaster.usbStatus, 1));
    const usbEnabledSystems = usbEnabledResult[0]?.count || 0;

    const usbDisabledSystems = totalSystems - usbEnabledSystems;

    // Systems by profile
    const systemsByProfileRaw = await db
      .select({
        profileId: clientMaster.profileId,
        profileName: profileMaster.profileName,
        count: count()
      })
      .from(clientMaster)
      .leftJoin(profileMaster, eq(clientMaster.profileId, profileMaster.profileId))
      .groupBy(clientMaster.profileId, profileMaster.profileName);

    const systemsByProfile = systemsByProfileRaw.map(r => ({
      profileId: r.profileId,
      profileName: r.profileName || 'No Profile',
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
      systemsByProfile,
      systemsWithDevices,
      inactiveSystems
    };
  }

  // ==================== DASHBOARD STATS ====================
  async getDashboardStats(): Promise<DashboardStats> {
    // Total systems
    const totalResult = await db.select({ count: count() }).from(clientMaster);
    const totalSystems = totalResult[0]?.count || 0;

    // Get all systems to check online/offline based on last_connected time (1 minute rule)
    const allSystems = await db.select({
      machineOn: clientMaster.machineOn,
      lastConnected: clientMaster.lastConnected,
    }).from(clientMaster);

    // Count online systems: machineOn = 1 AND last_connected within 1 minute
    const onlineSystems = allSystems.filter(s => {
      const isOnline = this.isSystemOnline(s.machineOn, s.lastConnected);
      
      // Debug logging
      if (!isOnline && s.machineOn === 1) {
        const now = new Date();
        const lastConnectedTime = s.lastConnected ? new Date(s.lastConnected) : null;
        const diffInMs = lastConnectedTime ? now.getTime() - lastConnectedTime.getTime() : null;
        const diffInMinutes = diffInMs ? diffInMs / (1000 * 60) : null;
        console.log(`[DASHBOARD DEBUG] System marked offline:`, {
          machineOn: s.machineOn,
          lastConnected: s.lastConnected?.toISOString(),
          diffInMinutes: diffInMinutes?.toFixed(2)
        });
      }
      
      return isOnline;
    }).length;

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
}

export const storage = new DatabaseStorage();
