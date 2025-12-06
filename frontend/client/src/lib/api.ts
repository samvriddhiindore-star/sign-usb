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

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
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

  // User Management
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

  async createUser(data: { name: string; email: string; password: string; role?: string }): Promise<User> {
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

  async updateUser(id: number, data: { name?: string; email?: string; role?: string }): Promise<User> {
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
