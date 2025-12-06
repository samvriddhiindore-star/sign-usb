import { useState, useEffect } from 'react';

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
  };
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

const MOCK_MACHINES: Machine[] = [
  {
    id: 'm-1',
    hostname: 'FINANCE-DT-01',
    osVersion: 'Windows 11 Pro 23H2',
    agentVersion: '1.2.0',
    lastSeenAt: new Date().toISOString(),
    status: 'online',
    policy: { lockAllUsb: true, temporarilyUnlockedUntil: null }
  },
  {
    id: 'm-2',
    hostname: 'HR-LAPTOP-04',
    osVersion: 'Windows 10 Ent 22H2',
    agentVersion: '1.1.9',
    lastSeenAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    status: 'offline',
    policy: { lockAllUsb: false, temporarilyUnlockedUntil: null }
  },
  {
    id: 'm-3',
    hostname: 'DEV-WORKSTATION-09',
    osVersion: 'Windows 11 Pro 23H2',
    agentVersion: '1.2.1',
    lastSeenAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    status: 'online',
    policy: { lockAllUsb: true, temporarilyUnlockedUntil: new Date(Date.now() + 1000 * 60 * 30).toISOString() }
  },
  {
    id: 'm-4',
    hostname: 'EXEC-SURFACE-01',
    osVersion: 'Windows 11 Ent 23H2',
    agentVersion: '1.2.1',
    lastSeenAt: new Date().toISOString(),
    status: 'online',
    policy: { lockAllUsb: true, temporarilyUnlockedUntil: null }
  },
  {
    id: 'm-5',
    hostname: 'RECEPTION-PC',
    osVersion: 'Windows 10 Pro 21H2',
    agentVersion: '1.0.5',
    lastSeenAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    status: 'offline',
    policy: { lockAllUsb: true, temporarilyUnlockedUntil: null }
  }
];

const MOCK_LOGS: UsbLog[] = [
  { id: 'l-1', machineId: 'm-1', deviceId: 'USB\VID_0781&PID_5581', vendor: 'SanDisk', product: 'Ultra Flair', eventType: 'connected', status: 'blocked', createdAt: new Date().toISOString() },
  { id: 'l-2', machineId: 'm-1', deviceId: 'USB\VID_046D&PID_C52B', vendor: 'Logitech', product: 'USB Receiver', eventType: 'connected', status: 'allowed', createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
  { id: 'l-3', machineId: 'm-3', deviceId: 'USB\VID_0951&PID_1666', vendor: 'Kingston', product: 'DataTraveler 3.0', eventType: 'connected', status: 'allowed', createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString() },
  { id: 'l-4', machineId: 'm-2', deviceId: 'USB\VID_05AC&PID_12A8', vendor: 'Apple', product: 'iPhone', eventType: 'connected', status: 'allowed', createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString() },
  { id: 'l-5', machineId: 'm-1', deviceId: 'USB\VID_0781&PID_5581', vendor: 'SanDisk', product: 'Ultra Flair', eventType: 'blocked', status: 'blocked', createdAt: new Date().toISOString() },
];

// Simple mock API
export const api = {
  getMachines: () => Promise.resolve([...MOCK_MACHINES]),
  getMachine: (id: string) => Promise.resolve(MOCK_MACHINES.find(m => m.id === id)),
  getLogs: (machineId: string) => Promise.resolve(MOCK_LOGS.filter(l => l.machineId === machineId)),
  updatePolicy: (machineId: string, policy: Partial<Machine['policy']>) => {
    const machine = MOCK_MACHINES.find(m => m.id === machineId);
    if (machine) {
      machine.policy = { ...machine.policy, ...policy };
    }
    return Promise.resolve(machine);
  }
};
