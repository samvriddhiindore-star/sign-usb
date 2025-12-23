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
  profileId: number | null;
  profile: {
    profileId: number;
    profileName: string;
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

export interface ProfileMachine {
  machineId: number;
  pcName: string;
  macId: string;
  usbStatus: number;
  machineOn: number;
}

export interface Profile {
  profileId: number;
  profileName: string;
  description: string | null;
  isActive: number | null;
  usbPolicy: number | null;
  assignedCount: number;
  machines: ProfileMachine[];
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

  async assignProfileToSystem(machineId: number, profileId: number | null): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/systems/${machineId}/profile`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ profileId })
    });
    
    if (!response.ok) {
      throw new Error('Failed to assign profile');
    }
    
    return response.json();
  },

  async bulkAssignProfile(machineIds: number[], profileId: number | null): Promise<{ success: boolean; affected: number }> {
    const response = await fetch(`${API_BASE}/systems/bulk/profile`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ machineIds, profileId })
    });
    
    if (!response.ok) {
      throw new Error('Failed to bulk assign profile');
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

  // ==================== PROFILES ====================
  async getProfiles(): Promise<Profile[]> {
    const response = await fetch(`${API_BASE}/profiles`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch profiles');
    }
    
    return response.json();
  },

  async getProfile(id: number): Promise<Profile> {
    const response = await fetch(`${API_BASE}/profiles/${id}`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch profile');
    }
    
    return response.json();
  },

  async createProfile(data: { profileName: string; description?: string }): Promise<Profile> {
    const response = await fetch(`${API_BASE}/profiles`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error('Failed to create profile');
    }
    
    return response.json();
  },

  async updateProfile(id: number, data: { profileName?: string; description?: string; isActive?: number }): Promise<Profile> {
    const response = await fetch(`${API_BASE}/profiles/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error('Failed to update profile');
    }
    
    return response.json();
  },

  async deleteProfile(id: number): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/profiles/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete profile');
    }
    
    return response.json();
  },

  async applyProfilePolicy(profileId: number): Promise<{ success: boolean; affected: number }> {
    const response = await fetch(`${API_BASE}/profiles/${profileId}/apply-policy`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to apply profile policy');
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
  }
};
