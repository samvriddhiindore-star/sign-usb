// IMPORTANT: This file sets up a Socket.IO server, not a SignalR server.
// The naming of this file is misleading. The client connecting to this hub
// MUST use a Socket.IO client library.

import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import { storage } from "./storage";
import { log } from "./index";
import { verifyAgentToken } from "./auth";

interface AgentSocket {
  id: string;
  agentId: string;
  machineId: number;
}

const connectedAgents = new Map<string, AgentSocket>();

// Simple in-memory cache for revoked tokens (TTL = 60s for performance)
const revokedTokenCache = new Map<string, boolean>();
const TOKEN_CACHE_TTL_MS = 60000;

async function isTokenRevoked(token: string): Promise<boolean> {
  // Check in-memory cache first
  if (revokedTokenCache.has(token)) {
    return revokedTokenCache.get(token) || false;
  }

  // Query storage to check if token is revoked
  const storedToken = await storage.getAgentToken(token);
  const revoked =
    !storedToken ||
    storedToken.revoked ||
    (!!storedToken.expiresAt && storedToken.expiresAt < new Date());

  // Cache result for TTL
  revokedTokenCache.set(token, revoked);
  setTimeout(() => revokedTokenCache.delete(token), TOKEN_CACHE_TTL_MS);

  return revoked;
}

export function setupSocketIOHub(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    path: "/agent-hub"
  });

  const agentAuthRequired = process.env.AGENT_AUTH_REQUIRED !== "false";

  io.on("connection", (socket) => {
    // Validate agent token sent in the Socket.IO auth handshake (if required)
    let token: string | undefined;
    let agentPayload: any;

    if (agentAuthRequired) {
      const handshakeAuth: any = (socket.handshake as any).auth || {};
      const handshakeHeaders: any = (socket.handshake as any).headers || {};
      // allow token in auth.token or Authorization header
      token = handshakeAuth.token;
      if (!token && typeof handshakeHeaders.authorization === "string") {
        const authHeader: string = handshakeHeaders.authorization;
        if (authHeader.startsWith("Bearer ")) {
          token = authHeader.substring(7);
        }
      }

      if (!token) {
        log(`Agent connection rejected (no token): ${socket.id}`, "signalr");
        socket.emit("Error", { message: "No agent token provided" });
        socket.disconnect(true);
        return;
      }

      agentPayload = verifyAgentToken(token);
      if (!agentPayload || !agentPayload.agentId) {
        log(`Agent connection rejected (invalid token): ${socket.id}`, "signalr");
        socket.emit("Error", { message: "Invalid agent token" });
        socket.disconnect(true);
        return;
      }

      // attach verified agentId to socket for later checks
      (socket as any).agentFromToken = agentPayload.agentId;
      (socket as any).agentToken = token;
    }

    log(`Agent attempting connection: ${socket.id}${agentPayload ? ` (agentId=${agentPayload.agentId})` : ""}`, "signalr");

    // Helper to check token revocation before processing any event (only if auth is required)
    const validateTokenNotRevoked = async (eventName: string): Promise<boolean> => {
      if (!agentAuthRequired) {
        return true;
      }

      const currentToken = (socket as any).agentToken;
      const revoked = await isTokenRevoked(currentToken);
      if (revoked) {
        log(`Agent token revoked (${eventName}): ${socket.id} (agentId=${(socket as any).agentFromToken})`, "signalr");
        socket.emit("Error", { message: "Agent token has been revoked" });
        socket.disconnect(true);
        return false;
      }
      return true;
    };
    
    socket.on("Register", async (data: { 
      agentId: string,
      hostname: string, 
      osVersion: string, 
      agentVersion: string,
      ipAddress?: string 
    }) => {
      try {
        // Check token revocation before processing Register
        if (!(await validateTokenNotRevoked("Register"))) return;

        // Ensure the agentId in the Register payload matches the agentId in the token
        const tokenAgentId = (socket as any).agentFromToken;
        if (tokenAgentId && tokenAgentId !== data.agentId) {
          log(`Agent registration rejected: token agentId mismatch (${tokenAgentId} != ${data.agentId})`, "signalr");
          socket.emit("Error", { message: "AgentId does not match token" });
          return;
        }

        log(`Agent registering: ${data.agentId} (${data.hostname})`, "signalr");
        
        let machine = await storage.getMachineByAgentId(data.agentId);
        
        if (!machine) {
          machine = await storage.createMachine({
            agentId: data.agentId,
            hostname: data.hostname,
            osVersion: data.osVersion,
            agentVersion: data.agentVersion,
            status: "online",
            ipAddress: data.ipAddress || socket.handshake.address
          });
          
          await storage.createPolicy({
            machineId: machine.id,
            lockAllUsb: true
          });
          
          log(`New machine registered: ${machine.hostname} (ID: ${machine.id})`, "signalr");
        } else {
          await storage.updateMachine(machine.id, {
            hostname: data.hostname,
            osVersion: data.osVersion,
            agentVersion: data.agentVersion,
            status: "online",
            lastSeenAt: new Date(),
            ipAddress: data.ipAddress || socket.handshake.address
          });
          
          log(`Existing machine reconnected: ${machine.hostname} (ID: ${machine.id})`, "signalr");
        }
        
        connectedAgents.set(socket.id, {
          id: socket.id,
          agentId: data.agentId,
          machineId: machine.id
        });
        
        socket.emit("Registered", { 
          success: true, 
          machineId: machine.id,
          message: "Agent registered successfully" 
        });
        
        const policy = await storage.getPolicy(machine.id);
        if (policy) {
          const command = policy.lockAllUsb ? "DisableUsb" : "EnableUsb";
          socket.emit(command, { policyId: policy.id });
        }
        
      } catch (error) {
        log(`Registration error: ${error}`, "signalr");
        socket.emit("Error", { message: "Registration failed" });
      }
    });

    socket.on("Heartbeat", async (data: { 
      agentId: string,
      uptime: number,
      cpuUsage?: number,
      memoryUsage?: number 
    }) => {
      try {
        // Check token revocation before processing Heartbeat
        if (!(await validateTokenNotRevoked("Heartbeat"))) return;

        const machine = await storage.getMachineByAgentId(data.agentId);
        if (machine) {
          await storage.updateMachine(machine.id, {
            status: "online",
            lastSeenAt: new Date()
          });
        }
        
        socket.emit("HeartbeatAck", { received: true, timestamp: new Date().toISOString() });
      } catch (error) {
        log(`Heartbeat error: ${error}`, "signalr");
      }
    });

    socket.on("UsbEvent", async (data: {
      agentId: string,
      deviceId: string,
      vendor: string,
      product: string,
      eventType: "connected" | "disconnected" | "blocked",
      status: "allowed" | "blocked"
    }) => {
      try {
        // Check token revocation before processing UsbEvent
        if (!(await validateTokenNotRevoked("UsbEvent"))) return;

        const machine = await storage.getMachineByAgentId(data.agentId);
        if (machine) {
          await storage.createLog({
            machineId: machine.id,
            deviceId: data.deviceId,
            vendor: data.vendor,
            product: data.product,
            eventType: data.eventType,
            status: data.status
          });
          
          log(`USB event logged: ${data.eventType} - ${data.vendor} ${data.product} on ${machine.hostname}`, "signalr");
        }
      } catch (error) {
        log(`UsbEvent error: ${error}`, "signalr");
      }
    });

    socket.on("GetStatus", async (data: { agentId: string }) => {
      try {
        // Check token revocation before processing GetStatus
        if (!(await validateTokenNotRevoked("GetStatus"))) return;

        const machine = await storage.getMachineByAgentId(data.agentId);
        if (machine) {
          const policy = await storage.getPolicy(machine.id);
          socket.emit("StatusResponse", {
            machine,
            policy,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        log(`GetStatus error: ${error}`, "signalr");
      }
    });

    socket.on("disconnect", async () => {
      const agent = connectedAgents.get(socket.id);
      if (agent) {
        log(`Agent disconnected: ${agent.agentId}`, "signalr");
        
        await storage.updateMachine(agent.machineId, {
          status: "offline"
        });
        
        connectedAgents.delete(socket.id);
      }
    });
  });

  return io;
}

export type CommandOptions = {
  waitForAck?: boolean;
  timeoutMs?: number;
};

export async function sendCommandToAgent(
  agentId: string,
  io: SocketIOServer,
  command: string,
  data?: any,
  options: CommandOptions = {}
): Promise<any> {
  for (const [socketId, agent] of connectedAgents.entries()) {
    if (agent.agentId === agentId) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        // If the command is EnableUsb or DisableUsb, log it in usb_logs
        if (command === "EnableUsb" || command === "DisableUsb") {
          try {
            await storage.createLog({
              machineId: agent.machineId,
              deviceId: "",
              vendor: "server",
              product: command,
              eventType: "command",
              status: "sent",
            });
          } catch (err) {
            log(`Failed to create usb_log for command ${command} on ${agent.machineId}: ${err}`, "signalr");
          }
        }

        log(`Command sent to agent ${agentId}: ${command}`, "signalr");

        if (options.waitForAck) {
          const timeout = options.timeoutMs ?? 5000;
          // Use socket.timeout to get an error if agent doesn't respond in time
          return new Promise((resolve, reject) => {
            try {
              // socket.timeout returns a wrapper with emit supporting ack
              (socket as any).timeout(timeout).emit(command, data, (err: any, resp: any) => {
                if (err) {
                  log(`Agent ${agentId} ack error for ${command}: ${err}`, "signalr");
                  return reject(err);
                }
                return resolve(resp);
              });
            } catch (e) {
                      log(`Error sending command with ack to agent ${agentId}: ${e}`, "signalr");
              return reject(e);
            }
          });
        }

        // fire-and-forget
        socket.emit(command, data);
        return { success: true };
      }
    }
  }

  log(`Agent ${agentId} not connected, command queued`, "signalr");
  return { success: false, queued: true };
}
