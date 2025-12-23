#!/usr/bin/env tsx
import { generateAgentToken } from "./auth";

const [, , agentId, expiresIn] = process.argv;

if (!agentId) {
  console.error("Usage: tsx backend/server/generate-agent-token.ts <agentId> [expiresIn]");
  process.exit(1);
}

const token = generateAgentToken(agentId, expiresIn || "30d");
console.log(token);
