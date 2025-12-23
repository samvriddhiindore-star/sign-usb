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
  type ProfileWithMachines
} from "../shared/schema";
import { eq, desc, and, sql, gte, isNull, count, inArray } from "drizzle-orm";

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
  getDevices(): Promise<(DeviceMaster & { pcName?: string })[]>;
  getDevice(id: number): Promise<DeviceMaster | undefined>;
  getDevicesByMachine(machineId: number): Promise<DeviceMaster[]>;
  getDeviceByDeviceId(deviceId: string): Promise<DeviceMaster | undefined>;
  createDevice(device: InsertDeviceMaster): Promise<DeviceMaster>;
  updateDevice(id: number, updates: Partial<DeviceMaster>): Promise<DeviceMaster | undefined>;
  deleteDevice(id: number): Promise<boolean>;
  
  // Dashboard Stats
  getDashboardStats(): Promise<DashboardStats>;
}

class DatabaseStorage implements IStorage {
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
    const result = await db.insert(clientMaster).values(system);
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
    await db.update(clientMaster)
      .set({ profileId })
      .where(eq(clientMaster.machineId, machineId));
    const result = await db.select().from(clientMaster).where(eq(clientMaster.machineId, machineId)).limit(1);
    return result[0];
  }

  async bulkAssignProfile(machineIds: number[], profileId: number | null): Promise<number> {
    if (machineIds.length === 0) return 0;
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
    const result = await db.insert(clientUsbStatus).values(log);
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
    const result = await db.insert(profileMaster).values(profile);
    const insertedId = (result as any).insertId as number | undefined;
    if (!insertedId) throw new Error("Failed to create profile");
    const created = await db.select().from(profileMaster).where(eq(profileMaster.profileId, insertedId)).limit(1);
    if (!created[0]) throw new Error("Failed to retrieve created profile");
    return created[0];
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
    const result = await db.insert(urlMaster).values(url);
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
  async getDevices(): Promise<(DeviceMaster & { pcName?: string })[]> {
    const result = await db
      .select({
        id: deviceMaster.id,
        machineId: deviceMaster.machineId,
        deviceName: deviceMaster.deviceName,
        description: deviceMaster.description,
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
    
    return result as (DeviceMaster & { pcName?: string })[];
  }

  async getDevice(id: number): Promise<DeviceMaster | undefined> {
    const result = await db.select().from(deviceMaster).where(eq(deviceMaster.id, id)).limit(1);
    return result[0];
  }

  async getDevicesByMachine(machineId: number): Promise<DeviceMaster[]> {
    return await db.select().from(deviceMaster)
      .where(eq(deviceMaster.machineId, machineId))
      .orderBy(desc(deviceMaster.createdAt));
  }

  async getDeviceByDeviceId(devId: string): Promise<DeviceMaster | undefined> {
    const result = await db.select().from(deviceMaster).where(eq(deviceMaster.deviceId, devId)).limit(1);
    return result[0];
  }

  async createDevice(device: InsertDeviceMaster): Promise<DeviceMaster> {
    const result = await db.insert(deviceMaster).values(device);
    const insertedId = (result as any).insertId as number | undefined;
    if (!insertedId) throw new Error("Failed to create device");
    const created = await this.getDevice(insertedId);
    if (!created) throw new Error("Failed to retrieve created device");
    return created;
  }

  async updateDevice(id: number, updates: Partial<DeviceMaster>): Promise<DeviceMaster | undefined> {
    await db.update(deviceMaster).set(updates).where(eq(deviceMaster.id, id));
    return this.getDevice(id);
  }

  async deleteDevice(id: number): Promise<boolean> {
    const result = await db.delete(deviceMaster).where(eq(deviceMaster.id, id));
    return (result as any).affectedRows !== undefined ? (result as any).affectedRows > 0 : true;
  }

  // ==================== DASHBOARD STATS ====================
  async getDashboardStats(): Promise<DashboardStats> {
    // Total systems
    const totalResult = await db.select({ count: count() }).from(clientMaster);
    const totalSystems = totalResult[0]?.count || 0;

    // Online systems (machine_on = 1)
    const onlineResult = await db.select({ count: count() }).from(clientMaster).where(eq(clientMaster.machineOn, 1));
    const onlineSystems = onlineResult[0]?.count || 0;

    // Offline systems
    const offlineSystems = totalSystems - onlineSystems;

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
