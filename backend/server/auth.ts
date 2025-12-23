import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "usb-sentinel-secret-change-in-production";
const AGENT_JWT_SECRET = process.env.AGENT_JWT_SECRET || JWT_SECRET;

export interface JWTPayload {
  adminId: number;
  email: string;
  role: string;
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET as jwt.Secret, {
    expiresIn: "7d",
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

export interface AgentJWTPayload {
  agentId: string;
  iat?: number;
  exp?: number;
}

/**
 * Generate a JWT for an agent. Use a separate secret `AGENT_JWT_SECRET` if set.
 */
export function generateAgentToken(agentId: string, expiresIn = "30d"): string {
  const payload: AgentJWTPayload = { agentId };
  return jwt.sign(payload as any, AGENT_JWT_SECRET as jwt.Secret, {
    expiresIn,
  } as jwt.SignOptions);
}

export function verifyAgentToken(token: string): AgentJWTPayload | null {
  try {
    return jwt.verify(token, AGENT_JWT_SECRET) as AgentJWTPayload;
  } catch (error) {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  
  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  
  if (!payload) {
    return res.status(401).json({ error: "Invalid token" });
  }
  
  (req as any).admin = payload;
  next();
}
