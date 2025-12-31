import { mysqlTable, varchar, int, datetime, boolean, timestamp, tinyint } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Admin users table
export const admins = mysqlTable("admins", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull().default("user"), // admin, manager, user, viewer
  phone: varchar("phone", { length: 20 }),
  status: tinyint("status").default(1).notNull(), // 0 = inactive, 1 = active
  lastLogin: datetime("last_login"),
  createdAt: timestamp("created_at", { mode: "date" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).default(sql`CURRENT_TIMESTAMP`),
});

// System Users management table (define first for reference)
// Note: Database table and columns keep original names (profile_master, profile_id, etc.) for compatibility
export const systemUsers = mysqlTable("profile_master", {
  systemUserId: int("profile_id").autoincrement().primaryKey(),
  systemUserUid: varchar("profile_uid", { length: 36 }), // UUID stored as char(36)
  systemUserName: varchar("profile_name", { length: 150 }).notNull(),
  description: varchar("description", { length: 255 }),
  isActive: tinyint("is_active").default(1),
  usbPolicy: tinyint("usb_policy").default(0), // 0 = disabled, 1 = enabled
  createdAt: timestamp("created_at", { mode: "date" }).default(sql`CURRENT_TIMESTAMP`),
  machineId: int("machine_id"), // Legacy column
});

// Client machines table
export const clientMaster = mysqlTable("client_master", {
  machineId: int("machine_id").autoincrement().primaryKey(),
  machineUid: varchar("machine_uid", { length: 36 }), // UUID stored as char(36)
  pcName: varchar("pc_name", { length: 255 }).notNull(),
  macId: varchar("mac_id", { length: 255 }).notNull(),
  usbStatus: tinyint("usb_status").default(0), // 0 = disabled, 1 = enabled
  machineOn: tinyint("machine_on").default(0), // 0 = offline, 1 = online
  lastConnected: datetime("last_connected"),
  timeOffset: int("time_offset"), // Time offset in milliseconds: server_time - client_time
  clientStatus: tinyint("client_status").default(0), // 0 = offline, 1 = online (temporary flag)
  clientStatusUpdatedAt: datetime("client_status_updated_at"), // Timestamp when client_status was set to 1 (online)
  lastUpdated: datetime("last_updated"), // Server-side timestamp for accurate online/offline detection
  remark: varchar("remark", { length: 255 }),
  createdAt: timestamp("created_at", { mode: "date" }).default(sql`CURRENT_TIMESTAMP`),
  systemUserId: int("profile_id").references(() => systemUsers.systemUserId, { onDelete: "set null" }),
});

// USB activity logs table
export const clientUsbStatus = mysqlTable("client_usb_status", {
  id: int("id").autoincrement().primaryKey(),
  logUid: varchar("log_uid", { length: 36 }), // UUID stored as char(36)
  machineId: int("machine_id").notNull().references(() => clientMaster.machineId, { onDelete: "cascade" }),
  deviceName: varchar("device_name", { length: 255 }).notNull(),
  deviceDescription: varchar("device_description", { length: 100 }),
  deviceManufacturer: varchar("device_manufacturer", { length: 150 }),
  devicePort: varchar("device_port", { length: 50 }), // F:, G:, H:
  deviceConnectTime: datetime("device_connect_time"),
  deviceDisconnectTime: datetime("device_disconnect_time"),
  deviceRemark: varchar("device_remark", { length: 255 }),
  createdAt: timestamp("created_at", { mode: "date" }).default(sql`CURRENT_TIMESTAMP`),
  deviceId: varchar("device_id", { length: 255 }),
});

// URL/Website access control table
export const urlMaster = mysqlTable("url_master", {
  id: int("id").autoincrement().primaryKey(),
  urlUid: varchar("url_uid", { length: 36 }), // UUID stored as char(36)
  url: varchar("url", { length: 500 }).notNull(),
  remark: varchar("remark", { length: 255 }), // 'allowed' or 'blocked'
  createdAt: timestamp("created_at", { mode: "date" }).default(sql`CURRENT_TIMESTAMP`),
});

// Device Master - System-wide USB device registry
export const deviceMaster = mysqlTable("device_master", {
  id: int("id").autoincrement().primaryKey(),
  deviceUid: varchar("device_uid", { length: 36 }), // UUID stored as char(36)
  machineId: int("machine_id").references(() => clientMaster.machineId, { onDelete: "set null" }),
  systemUserId: int("profile_id").references(() => systemUsers.systemUserId, { onDelete: "set null" }), // Device can be assigned to only one system user
  deviceName: varchar("device_name", { length: 255 }).notNull(),
  deviceDescription: varchar("device_description", { length: 255 }), // Note: column name is device_description in DB
  deviceId: varchar("device_id", { length: 255 }),
  deviceManufacturer: varchar("device_manufacturer", { length: 150 }),
  remark: varchar("remark", { length: 255 }),
  isAllowed: tinyint("is_allowed").default(1), // 0 = blocked, 1 = allowed
  createdAt: timestamp("created_at", { mode: "date" }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at", { mode: "date" }).default(sql`CURRENT_TIMESTAMP`),
});

// System Notifications table - tracks PC name changes and other system events
export const systemNotifications = mysqlTable("system_notifications", {
  id: int("id").autoincrement().primaryKey(),
  notificationUid: varchar("notification_uid", { length: 36 }), // UUID stored as char(36)
  machineId: int("machine_id").references(() => clientMaster.machineId, { onDelete: "cascade" }),
  notificationType: varchar("notification_type", { length: 50 }).notNull(), // 'pc_name_changed', 'system_registered', etc.
  title: varchar("title", { length: 255 }).notNull(),
  message: varchar("message", { length: 500 }),
  oldValue: varchar("old_value", { length: 255 }), // Old PC name
  newValue: varchar("new_value", { length: 255 }), // New PC name
  macId: varchar("mac_id", { length: 255 }), // MAC ID for reference
  isRead: tinyint("is_read").default(0), // 0 = unread, 1 = read
  createdAt: timestamp("created_at", { mode: "date" }).default(sql`CURRENT_TIMESTAMP`),
});

// Insert Schemas
export const insertAdminSchema = createInsertSchema(admins).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLogin: true,
});

export const insertClientMasterSchema = createInsertSchema(clientMaster).omit({
  machineId: true,
  machineUid: true, // Auto-generated, don't include in insert
  createdAt: true,
});

export const insertClientUsbStatusSchema = createInsertSchema(clientUsbStatus).omit({
  id: true,
  logUid: true, // Auto-generated, don't include in insert
  createdAt: true,
});

export const insertSystemUserSchema = createInsertSchema(systemUsers).omit({
  systemUserId: true, // Can be set manually or auto-incremented
  systemUserUid: true, // Auto-generated, don't include in insert
  createdAt: true,
});

export const insertUrlMasterSchema = createInsertSchema(urlMaster).omit({
  id: true,
  urlUid: true, // Auto-generated, don't include in insert
  createdAt: true,
});

export const insertDeviceMasterSchema = createInsertSchema(deviceMaster).omit({
  id: true,
  deviceUid: true, // Auto-generated, don't include in insert
  createdAt: true,
  updatedAt: true,
});

export const insertSystemNotificationSchema = createInsertSchema(systemNotifications).omit({
  id: true,
  notificationUid: true, // Auto-generated, don't include in insert
  createdAt: true,
});

// Select Types
export type Admin = typeof admins.$inferSelect;
export type ClientMaster = typeof clientMaster.$inferSelect;
export type ClientUsbStatus = typeof clientUsbStatus.$inferSelect;
export type SystemUser = typeof systemUsers.$inferSelect;
export type UrlMaster = typeof urlMaster.$inferSelect;
export type DeviceMaster = typeof deviceMaster.$inferSelect;
export type SystemNotification = typeof systemNotifications.$inferSelect;

// Insert Types
export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type InsertClientMaster = z.infer<typeof insertClientMasterSchema>;
export type InsertClientUsbStatus = z.infer<typeof insertClientUsbStatusSchema>;
export type InsertSystemUser = z.infer<typeof insertSystemUserSchema>;
export type InsertUrlMaster = z.infer<typeof insertUrlMasterSchema>;
export type InsertDeviceMaster = z.infer<typeof insertDeviceMasterSchema>;
export type InsertSystemNotification = z.infer<typeof insertSystemNotificationSchema>;

// Extended types for API responses
export type ClientWithSystemUser = ClientMaster & {
  systemUser: SystemUser | null;
};

export type SystemUserWithMachines = SystemUser & {
  machines: ClientMaster[];
  assignedCount: number;
};

// DeviceMaster with description mapped from deviceDescription for API compatibility
// The database has device_description, but we map it to description in API responses
export type DeviceMasterWithDescription = Omit<DeviceMaster, 'deviceDescription'> & {
  description: string | null;
};

export type DashboardStats = {
  totalSystems: number;
  onlineSystems: number;
  offlineSystems: number;
  usbEnabledSystems: number;
  usbDisabledSystems: number;
  blockedUrlCount: number;
  allowedUrlCount: number;
  usbEventsToday: number;
  usbEventsLast7Days: number;
};
