import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("admin"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const machines = pgTable("machines", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull().unique(),
  hostname: text("hostname").notNull(),
  osVersion: text("os_version").notNull(),
  agentVersion: text("agent_version").notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  status: text("status").notNull().default("offline"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const policies = pgTable("policies", {
  id: serial("id").primaryKey(),
  machineId: integer("machine_id").notNull().references(() => machines.id, { onDelete: "cascade" }),
  lockAllUsb: boolean("lock_all_usb").notNull().default(true),
  temporarilyUnlockedUntil: timestamp("temporarily_unlocked_until"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usbLogs = pgTable("usb_logs", {
  id: serial("id").primaryKey(),
  machineId: integer("machine_id").notNull().references(() => machines.id, { onDelete: "cascade" }),
  deviceId: text("device_id").notNull(),
  vendor: text("vendor").notNull(),
  product: text("product").notNull(),
  eventType: text("event_type").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert Schemas
export const insertAdminSchema = createInsertSchema(admins).omit({
  id: true,
  createdAt: true,
});

export const insertMachineSchema = createInsertSchema(machines).omit({
  id: true,
  createdAt: true,
  lastSeenAt: true,
});

export const insertPolicySchema = createInsertSchema(policies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUsbLogSchema = createInsertSchema(usbLogs).omit({
  id: true,
  createdAt: true,
});

// Select Types
export type Admin = typeof admins.$inferSelect;
export type Machine = typeof machines.$inferSelect;
export type Policy = typeof policies.$inferSelect;
export type UsbLog = typeof usbLogs.$inferSelect;

// Insert Types
export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type InsertMachine = z.infer<typeof insertMachineSchema>;
export type InsertPolicy = z.infer<typeof insertPolicySchema>;
export type InsertUsbLog = z.infer<typeof insertUsbLogSchema>;

// Combined types for API responses
export type MachineWithPolicy = Machine & {
  policy: Policy | null;
};
