const API_BASE = '/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

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

export interface UsbLog {
  id: string;
  machineId: string;
  deviceId: string;
  vendor: string;
  product: string;
  eventType: 'connected' | 'disconnected' | 'blocked';
  status: 'allowed' | 'blocked';
  createdAt: string;
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

export const api = {
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

  async getMachines(): Promise<Machine[]> {
    const response = await fetch(`${API_BASE}/machines`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch machines');
    }
    
    return response.json();
  },

  async getMachine(id: string): Promise<Machine> {
    const response = await fetch(`${API_BASE}/machines/${id}`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch machine');
    }
    
    return response.json();
  },

  async updatePolicy(
    machineId: string, 
    policy: { lockAllUsb?: boolean; temporarilyUnlockedUntil?: string | null }
  ): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/machines/${machineId}/policy`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(policy)
    });
    
    if (!response.ok) {
      throw new Error('Failed to update policy');
    }
    
    return response.json();
  },

  async getLogs(machineId: string): Promise<UsbLog[]> {
    const response = await fetch(`${API_BASE}/machines/${machineId}/logs`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch logs');
    }
    
    return response.json();
  },

  async getAllLogs(): Promise<UsbLog[]> {
    const response = await fetch(`${API_BASE}/logs`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch logs');
    }
    
    return response.json();
  }
};
