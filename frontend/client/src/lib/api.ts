const API_BASE = '/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

// ==================== TYPES ====================
export interface DashboardStats {
  totalSystems: number;
  onlineSystems: number;
  offlineSystems: number;
  usbEnabledSystems: number;
  usbDisabledSystems: number;
  blockedUrlCount: number;
  allowedUrlCount: number;
  usbEventsToday: number;
  usbEventsLast7Days: number;
}

export interface System {
  machineId: number;
  pcName: string;
  macId: string;
  usbStatus: number;
  machineOn: number;
  lastConnected: string | null;
  remark: string | null;
  createdAt: string | null;
  status: 'online' | 'offline';
  systemUserId: number | null;
  systemUser: {
    systemUserId: number;
    systemUserName: string;
    usbPolicy: number;
  } | null;
}

export interface UsbLog {
  id: number;
  machineId: number;
  pcName: string;
  deviceName: string;
  deviceDescription: string | null;
  deviceManufacturer: string | null;
  devicePort: string | null;
  connectTime: string | null;
  disconnectTime: string | null;
  duration: number | null;
  status: 'Connected' | 'Removed';
  deviceId: string | null;
  createdAt: string | null;
}

export interface SystemUserMachine {
  machineId: number;
  pcName: string;
  macId: string;
  usbStatus: number;
  machineOn: number;
  status?: 'online' | 'offline';
  lastConnected?: string | null;
}

export interface SystemUser {
  systemUserId: number;
  systemUserUid: string | null;
  systemUserName: string;
  description: string | null;
  isActive: number | null;
  usbPolicy: number | null;
  assignedCount: number;
  machines: SystemUserMachine[];
  createdAt: string | null;
}

export interface UrlEntry {
  id: number;
  url: string;
  access: 'allowed' | 'blocked';
  createdAt: string | null;
}

export interface DeviceEntry {
  id: number;
  machineId: number | null;
  systemUserId: number | null;
  pcName: string | null;
  deviceName: string;
  description: string | null;
  deviceId: string | null;
  deviceManufacturer: string | null;
  remark: string | null;
  isAllowed: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface LoginResponse {
  admin: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  token: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: 'admin' | 'manager' | 'user' | 'viewer';
  status: number;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string | null;
}

// Report Types
export interface DevicesByMachineReport {
  machineId: number;
  pcName: string;
  macId: string;
  machineOn: number;
  totalDevices: number;
  allowedDevices: number;
  blockedDevices: number;
  devices: DeviceEntry[];
}

export interface UsbActivityReport {
  totalEvents: number;
  byMachine: { machineId: number; pcName: string; eventCount: number }[];
  byDevice: { deviceName: string; eventCount: number }[];
  byDate: { date: string; eventCount: number }[];
  recentActivity: UsbLog[];
}

export interface SystemHealthReport {
  totalSystems: number;
  onlineSystems: number;
  offlineSystems: number;
  usbEnabledSystems: number;
  usbDisabledSystems: number;
  systemsBySystemUser: { systemUserId: number | null; systemUserName: string; count: number }[];
  systemsWithDevices: { machineId: number; pcName: string; deviceCount: number }[];
  inactiveSystems: System[];
}

export interface SystemNotification {
  id: number;
  notificationUid: string | null;
  machineId: number | null;
  notificationType: string;
  title: string;
  message: string | null;
  oldValue: string | null;
  newValue: string | null;
  macId: string | null;
  isRead: number;
  createdAt: string | null;
}

export interface DeviceAnalyticsReport {
  summary: {
    totalDevices: number;
    allowedDevices: number;
    blockedDevices: number;
    devicesWithMachines: number;
    orphanedDevices: number;
  };
  byManufacturer: { manufacturer: string; count: number; allowed: number; blocked: number }[];
  byStatus: { status: string; count: number }[];
  byMachine: { machineId: number; pcName: string; macId: string; totalDevices: number; allowedDevices: number; blockedDevices: number; lastDeviceAdded: string | null; isOnline: boolean }[];
  recentDevices: DeviceEntry[];
  topDevices: { deviceName: string; count: number; machines: number }[];
  offlineSystems: { machineId: number; pcName: string; macId: string; lastConnected: string | null; totalDevices: number; allowedDevices: number; blockedDevices: number; devices: DeviceEntry[] }[];
}

export interface MachineDeviceReport {
  machine: System | null;
  devices: DeviceEntry[];
  summary: {
    totalDevices: number;
    allowedDevices: number;
    blockedDevices: number;
    byManufacturer: { manufacturer: string; count: number }[];
  };
}

// Legacy types for backwards compatibility
export interface Machine {
  id: string;
  hostname: string;
  osVersion: string;
  agentVersion: string;
  lastSeenAt: string;
  status: 'online' | 'offline';
  policy: {
    lockAllUsb: boolean;
    temporarilyUnlockedUntil?: string | null;
  } | null;
}

export const api = {
  // ==================== AUTH ====================
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    return response.json();
  },

  // ==================== DASHBOARD ====================
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await fetch(`${API_BASE}/dashboard/stats`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch dashboard stats');
    }

    return response.json();
  },

  // ==================== SYSTEMS ====================
  async getSystems(): Promise<System[]> {
    const response = await fetch(`${API_BASE}/systems`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch systems');
    }

    return response.json();
  },

  async getSystem(id: number): Promise<System> {
    const response = await fetch(`${API_BASE}/systems/${id}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch system');
    }

    return response.json();
  },

  async getDisconnectedSystems(days: number = 7): Promise<System[]> {
    const response = await fetch(`${API_BASE}/systems/disconnected?days=${days}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch disconnected systems');
    }

    return response.json();
  },

  async updateSystemUsb(machineId: number, enabled: boolean): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/systems/${machineId}/usb`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ enabled })
    });

    if (!response.ok) {
      throw new Error('Failed to update USB status');
    }

    return response.json();
  },

  async bulkUpdateUsb(machineIds: number[], enabled: boolean): Promise<{ success: boolean; affected: number }> {
    const response = await fetch(`${API_BASE}/systems/bulk/usb`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ machineIds, enabled })
    });

    if (!response.ok) {
      throw new Error('Failed to bulk update USB status');
    }

    return response.json();
  },

  async assignSystemUserToSystem(machineId: number, systemUserId: number | null): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/systems/${machineId}/system-user`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ systemUserId })
    });

    if (!response.ok) {
      throw new Error('Failed to assign system user');
    }

    return response.json();
  },

  async bulkAssignSystemUser(machineIds: number[], systemUserId: number | null): Promise<{ success: boolean; affected: number }> {
    const response = await fetch(`${API_BASE}/systems/bulk/system-user`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ machineIds, systemUserId })
    });

    if (!response.ok) {
      throw new Error('Failed to bulk assign system user');
    }

    return response.json();
  },

  // ==================== USB LOGS ====================
  async getUsbLogs(limit: number = 500): Promise<UsbLog[]> {
    const response = await fetch(`${API_BASE}/usb-logs?limit=${limit}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch USB logs');
    }

    return response.json();
  },

  async getUsbLogsByMachine(machineId: number, limit: number = 100): Promise<UsbLog[]> {
    const response = await fetch(`${API_BASE}/usb-logs/machine/${machineId}?limit=${limit}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch USB logs');
    }

    return response.json();
  },

  async getConnectedUsbDevices(): Promise<UsbLog[]> {
    const response = await fetch(`${API_BASE}/usb-logs/connected`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch connected USB devices');
    }

    return response.json();
  },

  // ==================== SYSTEM USERS ====================
  async getSystemUsers(): Promise<SystemUser[]> {
    const response = await fetch(`${API_BASE}/system-users`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch system users');
    }

    return response.json();
  },

  async getSystemUser(id: number): Promise<SystemUser> {
    const response = await fetch(`${API_BASE}/system-users/${id}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch system user');
    }

    return response.json();
  },

  async createSystemUser(data: { systemUserName: string; description?: string; usbPolicy?: number }): Promise<SystemUser> {
    console.log("API: Creating system user with data:", data);
    const response = await fetch(`${API_BASE}/system-users`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API: System user creation failed:", response.status, errorText);
      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { error: errorText || 'Failed to create system user' };
      }
      throw new Error(error.error || `Failed to create system user (${response.status})`);
    }

    const result = await response.json();
    console.log("API: System user created successfully:", result);
    return result;
  },

  async updateSystemUser(id: number, data: { systemUserName?: string; description?: string; isActive?: number; usbPolicy?: number }): Promise<SystemUser> {
    const response = await fetch(`${API_BASE}/system-users/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to update system user' }));
      throw new Error(error.error || 'Failed to update system user');
    }

    return response.json();
  },

  async deleteSystemUser(id: number): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/system-users/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to delete system user');
    }

    return response.json();
  },

  async applySystemUserPolicy(systemUserId: number): Promise<{ success: boolean; affected: number }> {
    const response = await fetch(`${API_BASE}/system-users/${systemUserId}/apply-policy`, {
      method: 'POST',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to apply system user policy');
    }

    return response.json();
  },

  // ==================== URL/WEBSITE ACCESS ====================
  async getUrls(): Promise<UrlEntry[]> {
    const response = await fetch(`${API_BASE}/urls`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch URLs');
    }

    return response.json();
  },

  async createUrl(data: { url: string; access: 'allowed' | 'blocked' }): Promise<UrlEntry> {
    const response = await fetch(`${API_BASE}/urls`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error('Failed to create URL');
    }

    return response.json();
  },

  async updateUrl(id: number, data: { url?: string; access?: 'allowed' | 'blocked' }): Promise<UrlEntry> {
    const response = await fetch(`${API_BASE}/urls/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error('Failed to update URL');
    }

    return response.json();
  },

  async deleteUrl(id: number): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/urls/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to delete URL');
    }

    return response.json();
  },

  async createBulkUrls(urls: string[]): Promise<{ success: number; failed: number; errors: string[]; message: string }> {
    const response = await fetch(`${API_BASE}/urls/bulk`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ urls })
    });

    if (!response.ok) {
      throw new Error('Failed to create bulk URLs');
    }

    return response.json();
  },

  async deleteBulkUrls(ids: number[]): Promise<{ success: boolean; deleted: number; message: string }> {
    const response = await fetch(`${API_BASE}/urls/bulk`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ids })
    });

    if (!response.ok) {
      throw new Error('Failed to delete URLs');
    }

    return response.json();
  },

  // ==================== DEVICE MASTER ====================
  async getDevices(): Promise<DeviceEntry[]> {
    const response = await fetch(`${API_BASE}/devices`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch devices');
    }

    return response.json();
  },

  async getDevice(id: number): Promise<DeviceEntry> {
    const response = await fetch(`${API_BASE}/devices/${id}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch device');
    }

    return response.json();
  },

  async getDevicesByMachine(machineId: number): Promise<DeviceEntry[]> {
    const response = await fetch(`${API_BASE}/devices/machine/${machineId}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch devices');
    }

    return response.json();
  },

  async createDevice(data: {
    machineId?: number | null;
    deviceName: string;
    description?: string;
    deviceId?: string;
    deviceManufacturer?: string;
    remark?: string;
    isAllowed?: number;
  }): Promise<DeviceEntry> {
    const response = await fetch(`${API_BASE}/devices`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error('Failed to create device');
    }

    return response.json();
  },

  async updateDevice(id: number, data: Partial<DeviceEntry>): Promise<DeviceEntry> {
    const response = await fetch(`${API_BASE}/devices/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error('Failed to update device');
    }

    return response.json();
  },

  async deleteDevice(id: number): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/devices/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to delete device');
    }

    return response.json();
  },

  // ==================== USER MANAGEMENT ====================
  async getUsers(): Promise<User[]> {
    const response = await fetch(`${API_BASE}/users`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }

    return response.json();
  },

  async getUser(id: number): Promise<User> {
    const response = await fetch(`${API_BASE}/users/${id}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user');
    }

    return response.json();
  },

  async createUser(data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role?: 'admin' | 'manager' | 'user' | 'viewer';
    status?: number;
  }): Promise<User> {
    const response = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create user');
    }

    return response.json();
  },

  async updateUser(id: number, data: {
    name?: string;
    email?: string;
    phone?: string | null;
    role?: 'admin' | 'manager' | 'user' | 'viewer';
  }): Promise<User> {
    const response = await fetch(`${API_BASE}/users/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update user');
    }

    return response.json();
  },

  async updateUserStatus(id: number, status: number): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/users/${id}/status`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update user status');
    }

    return response.json();
  },

  async updateUserPassword(id: number, newPassword: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/users/${id}/password`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ newPassword })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update password');
    }

    return response.json();
  },

  async deleteUser(id: number): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/users/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete user');
    }

    return response.json();
  },

  // ==================== REPORTS ====================
  async getDevicesByMachineReport(): Promise<DevicesByMachineReport[]> {
    const response = await fetch(`${API_BASE}/reports/devices-by-machine`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch devices by machine report');
    }

    return response.json();
  },

  async getUsbActivityReport(startDate?: string, endDate?: string): Promise<UsbActivityReport> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await fetch(`${API_BASE}/reports/usb-activity?${params}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch USB activity report');
    }

    return response.json();
  },

  async getSystemHealthReport(): Promise<SystemHealthReport> {
    const response = await fetch(`${API_BASE}/reports/system-health`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch system health report');
    }

    return response.json();
  },

  async getDeviceAnalyticsReport(): Promise<DeviceAnalyticsReport> {
    try {
      const response = await fetch(`${API_BASE}/reports/device-analytics`, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          if (errorData.details) {
            console.error('[API] Device analytics error details:', errorData.details);
          }
        } catch {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
        }
        console.error('[API] Device analytics error:', errorMessage);
        throw new Error(`Failed to fetch device analytics report: ${errorMessage}`);
      }

      const data = await response.json();
      console.log('[API] Device analytics response:', {
        totalDevices: data.summary?.totalDevices,
        byManufacturer: data.byManufacturer?.length,
        byMachine: data.byMachine?.length,
        offlineSystems: data.offlineSystems?.length
      });

      // Validate response structure
      if (!data.summary) {
        console.error('[API] Invalid device analytics response structure:', data);
        throw new Error('Invalid response format from server');
      }

      return data;
    } catch (error: any) {
      console.error('[API] Device analytics fetch failed:', error);
      throw error;
    }
  },

  async getMachineDeviceReport(machineId: number): Promise<MachineDeviceReport> {
    const response = await fetch(`${API_BASE}/reports/machine-devices/${machineId}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch machine device report');
    }

    return response.json();
  },

  getExportDevicesUrl(): string {
    return `${API_BASE}/reports/export/devices`;
  },

  getExportUsbLogsUrl(limit?: number): string {
    return `${API_BASE}/reports/export/usb-logs${limit ? `?limit=${limit}` : ''}`;
  },

  getExportSystemsUrl(): string {
    return `${API_BASE}/reports/export/systems`;
  },

  // ==================== LEGACY (for backwards compatibility) ====================
  async getMachines(): Promise<Machine[]> {
    // Map systems to old machine format for backwards compatibility
    const systems = await this.getSystems();
    return systems.map(s => ({
      id: s.machineId.toString(),
      hostname: s.pcName,
      osVersion: 'N/A',
      agentVersion: 'N/A',
      lastSeenAt: s.lastConnected || '',
      status: s.status,
      policy: {
        lockAllUsb: s.usbStatus === 0,
        temporarilyUnlockedUntil: null
      }
    }));
  },

  async getMachine(id: string): Promise<Machine> {
    const system = await this.getSystem(parseInt(id));
    return {
      id: system.machineId.toString(),
      hostname: system.pcName,
      osVersion: 'N/A',
      agentVersion: 'N/A',
      lastSeenAt: system.lastConnected || '',
      status: system.status,
      policy: {
        lockAllUsb: system.usbStatus === 0,
        temporarilyUnlockedUntil: null
      }
    };
  },

  async updatePolicy(
    machineId: string,
    policy: { lockAllUsb?: boolean; temporarilyUnlockedUntil?: string | null }
  ): Promise<{ success: boolean }> {
    return this.updateSystemUsb(parseInt(machineId), !policy.lockAllUsb);
  },

  async getLogs(machineId: string): Promise<any[]> {
    return this.getUsbLogsByMachine(parseInt(machineId));
  },

  async getAllLogs(): Promise<any[]> {
    return this.getUsbLogs();
  },

  // ==================== NOTIFICATIONS ====================
  async getNotifications(limit?: number, unreadOnly?: boolean): Promise<SystemNotification[]> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (unreadOnly) params.append('unreadOnly', 'true');

    const response = await fetch(`${API_BASE}/notifications?${params}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch notifications');
    }

    return response.json();
  },

  async getUnreadNotificationCount(): Promise<number> {
    const response = await fetch(`${API_BASE}/notifications/unread-count`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch unread notification count');
    }

    const data = await response.json();
    return data.count;
  },

  async markNotificationAsRead(id: number): Promise<void> {
    const response = await fetch(`${API_BASE}/notifications/${id}/read`, {
      method: 'PUT',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to mark notification as read');
    }
  },

  async markAllNotificationsAsRead(): Promise<number> {
    const response = await fetch(`${API_BASE}/notifications/read-all`, {
      method: 'PUT',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to mark all notifications as read');
    }

    const data = await response.json();
    return data.affected;
  },

  // ==================== DUPLICATE MAC ID MANAGEMENT ====================
  async getDuplicateMacIds(): Promise<{ macId: string; count: number; systems: System[] }[]> {
    console.log('[API] Fetching duplicate MAC IDs from:', `${API_BASE}/systems/duplicates`);
    const response = await fetch(`${API_BASE}/systems/duplicates`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Failed to fetch duplicate MAC IDs:', response.status, errorText);
      throw new Error(`Failed to fetch duplicate MAC IDs: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('[API] Received duplicate MAC IDs:', data);
    return data;
  },

  async mergeDuplicateMacId(macId: string, keepMachineId: number, mergeMachineIds: number[]): Promise<{ success: boolean; merged: number; message: string }> {
    const response = await fetch(`${API_BASE}/systems/duplicates/merge`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ macId, keepMachineId, mergeMachineIds })
    });

    if (!response.ok) {
      throw new Error('Failed to merge duplicate MAC IDs');
    }

    return response.json();
  },

  async syncDuplicateMacIds(): Promise<{ success: boolean; merged: number; groups: number; message: string }> {
    const response = await fetch(`${API_BASE}/systems/sync-duplicates`, {
      method: 'POST',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to sync duplicate MAC IDs');
    }

    return response.json();
  },
};
