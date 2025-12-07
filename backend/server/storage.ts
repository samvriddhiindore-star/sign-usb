import { db } from "./db";
import { 
  machines, 
  policies, 
  usbLogs, 
  admins,
  agentTokens,
  type Machine, 
  type Policy, 
  type UsbLog,
  type Admin,
  type InsertMachine, 
  type InsertPolicy, 
  type InsertUsbLog,
  type InsertAdmin,
  type MachineWithPolicy
  ,
  type AgentToken,
  type InsertAgentToken
} from "../shared/schema";
import { eq, desc, and } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface IStorage {
  // Admins
  getAdminByEmail(email: string): Promise<Admin | undefined>;
  createAdmin(admin: InsertAdmin): Promise<Admin>;
  getAdmins(): Promise<Admin[]>;
  getAdmin(id: number): Promise<Admin | undefined>;
  updateAdmin(id: number, updates: Partial<Admin>): Promise<Admin | undefined>;
  deleteAdmin(id: number): Promise<boolean>;
  
  // Machines
  getMachines(): Promise<MachineWithPolicy[]>;
  getMachine(id: number): Promise<MachineWithPolicy | undefined>;
  getMachineByAgentId(agentId: string): Promise<Machine | undefined>;
  createMachine(machine: InsertMachine): Promise<Machine>;
  updateMachine(id: number, updates: Partial<Machine>): Promise<Machine | undefined>;
  updateMachineByAgentId(agentId: string, updates: Partial<Machine>): Promise<Machine | undefined>;
  
  // Policies
  getPolicy(machineId: number): Promise<Policy | undefined>;
  createPolicy(policy: InsertPolicy): Promise<Policy>;
  updatePolicy(machineId: number, updates: Partial<Policy>): Promise<Policy | undefined>;
  
  // USB Logs
  getLogs(machineId: number, limit?: number): Promise<UsbLog[]>;
  getAllLogs(limit?: number): Promise<UsbLog[]>;
  createLog(log: InsertUsbLog): Promise<UsbLog>;
  // Agent tokens
  createAgentToken(token: InsertAgentToken): Promise<AgentToken>;
  revokeAgentTokenByToken(token: string): Promise<boolean>;
  revokeAgentTokensByAgentId(agentId: string): Promise<number>;
  getAgentToken(token: string): Promise<AgentToken | undefined>;
  getAgentTokensByAgentId(agentId: string, limit?: number): Promise<AgentToken[]>;
}

class DatabaseStorage implements IStorage {
  async getAdminByEmail(email: string): Promise<Admin | undefined> {
    const result = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
    return result[0];
  }

  async createAdmin(admin: InsertAdmin): Promise<Admin> {
    const result = await db.insert(admins).values(admin).returning();
    return result[0];
  }

  async getAdmins(): Promise<Admin[]> {
    return await db.select().from(admins).orderBy(desc(admins.createdAt));
  }

  async getAdmin(id: number): Promise<Admin | undefined> {
    const result = await db.select().from(admins).where(eq(admins.id, id)).limit(1);
    return result[0];
  }

  async updateAdmin(id: number, updates: Partial<Admin>): Promise<Admin | undefined> {
    const result = await db.update(admins).set(updates).where(eq(admins.id, id)).returning();
    return result[0];
  }

  async deleteAdmin(id: number): Promise<boolean> {
    const result = await db.delete(admins).where(eq(admins.id, id));
    return result.rowCount !== undefined ? result.rowCount > 0 : true;
  }

  async getMachines(): Promise<MachineWithPolicy[]> {
    const result = await db
      .select()
      .from(machines)
      .leftJoin(policies, eq(machines.id, policies.machineId))
      .orderBy(desc(machines.lastSeenAt));
    
    return result.map(row => ({
      ...row.machines,
      policy: row.policies
    }));
  }

  async getMachine(id: number): Promise<MachineWithPolicy | undefined> {
    const result = await db
      .select()
      .from(machines)
      .leftJoin(policies, eq(machines.id, policies.machineId))
      .where(eq(machines.id, id))
      .limit(1);
    
    if (result.length === 0) return undefined;
    
    return {
      ...result[0].machines,
      policy: result[0].policies
    };
  }

  async getMachineByAgentId(agentId: string): Promise<Machine | undefined> {
    const result = await db.select().from(machines).where(eq(machines.agentId, agentId)).limit(1);
    return result[0];
  }

  async createMachine(machine: InsertMachine): Promise<Machine> {
    const result = await db.insert(machines).values(machine).returning();
    return result[0];
  }

  async updateMachine(id: number, updates: Partial<Machine>): Promise<Machine | undefined> {
    const result = await db.update(machines).set(updates).where(eq(machines.id, id)).returning();
    return result[0];
  }

  async updateMachineByAgentId(agentId: string, updates: Partial<Machine>): Promise<Machine | undefined> {
    const result = await db.update(machines).set(updates).where(eq(machines.agentId, agentId)).returning();
    return result[0];
  }

  async getPolicy(machineId: number): Promise<Policy | undefined> {
    const result = await db.select().from(policies).where(eq(policies.machineId, machineId)).limit(1);
    return result[0];
  }

  async createPolicy(policy: InsertPolicy): Promise<Policy> {
    const result = await db.insert(policies).values(policy).returning();
    return result[0];
  }

  async updatePolicy(machineId: number, updates: Partial<Policy>): Promise<Policy | undefined> {
    const updatedData = { ...updates, updatedAt: new Date() };
    const result = await db.update(policies).set(updatedData).where(eq(policies.machineId, machineId)).returning();
    return result[0];
  }

  async getLogs(machineId: number, limit: number = 100): Promise<UsbLog[]> {
    return await db
      .select()
      .from(usbLogs)
      .where(eq(usbLogs.machineId, machineId))
      .orderBy(desc(usbLogs.createdAt))
      .limit(limit);
  }

  async getAllLogs(limit: number = 100): Promise<UsbLog[]> {
    return await db
      .select()
      .from(usbLogs)
      .orderBy(desc(usbLogs.createdAt))
      .limit(limit);
  }

  async createLog(log: InsertUsbLog): Promise<UsbLog> {
    const result = await db.insert(usbLogs).values(log).returning();
    return result[0];
  }

  async createAgentToken(token: InsertAgentToken): Promise<AgentToken> {
    const result = await db.insert(agentTokens).values(token).returning();
    return result[0];
  }

  async revokeAgentTokenByToken(token: string): Promise<boolean> {
    const result = await db.update(agentTokens).set({ revoked: true }).where(eq(agentTokens.token, token));
    return result.rowCount !== undefined ? result.rowCount > 0 : true;
  }

  async revokeAgentTokensByAgentId(agentId: string): Promise<number> {
    const result = await db.update(agentTokens).set({ revoked: true }).where(eq(agentTokens.agentId, agentId));
    return result.rowCount ?? 0;
  }

  async getAgentToken(token: string): Promise<AgentToken | undefined> {
    const result = await db.select().from(agentTokens).where(eq(agentTokens.token, token)).limit(1);
    return result[0];
  }

  async getAgentTokensByAgentId(agentId: string, limit: number = 100): Promise<AgentToken[]> {
    return await db.select().from(agentTokens).where(eq(agentTokens.agentId, agentId)).orderBy(desc(agentTokens.createdAt)).limit(limit);
  }
}

export const storage = new DatabaseStorage();
