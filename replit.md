# USB Sentinel - Enterprise USB Control System

## Overview

USB Sentinel is a comprehensive enterprise USB device control and monitoring system. It consists of a web-based admin panel for centralized management and real-time monitoring of USB policies across Windows machines, paired with Windows Service agents that enforce USB access controls on endpoint devices.

The system enables administrators to:
- Monitor fleet-wide USB device activity in real-time
- Enforce USB lockdown policies remotely
- View detailed audit logs of all USB events
- Manage individual machine policies through an intuitive dashboard

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18 with TypeScript
- Vite as the build tool and development server
- TanStack Query (React Query) for server state management
- Wouter for lightweight client-side routing
- Shadcn/ui component library built on Radix UI primitives
- Tailwind CSS for styling with custom enterprise security theme

**Design Decisions:**
- **Component-based UI**: Modular design using Shadcn/ui components for consistency and maintainability
- **Real-time updates**: React Query handles data fetching and automatic cache invalidation when policies change
- **Responsive layout**: Mobile-first design with sidebar navigation that collapses on smaller screens
- **Client-side routing**: Wouter provides minimal routing overhead compared to React Router
- **Form validation**: React Hook Form with Zod schemas for type-safe form handling

**Key Pages:**
- Login page with JWT authentication
- Dashboard with fleet overview statistics
- Machines list with policy toggle controls
- Individual machine detail pages with USB event logs
- Centralized audit log view

### Backend Architecture

**Technology Stack:**
- Node.js with Express.js
- TypeScript for type safety
- Socket.IO for real-time bidirectional communication with Windows agents
- JWT (jsonwebtoken) for authentication
- Bcrypt for password hashing

**Design Decisions:**
- **REST API for admin panel**: Express routes handle CRUD operations for machines, policies, and logs
- **Socket.IO hub for agents**: Real-time WebSocket connection at `/agent-hub` path for Windows Service communication
- **Stateless authentication**: JWT tokens stored in localStorage (client) and verified on each API request
- **Separation of concerns**: Auth middleware, storage layer, and route handlers are modular
- **Agent connection tracking**: In-memory Map stores connected agents with their socket IDs and machine IDs

**API Structure:**
- `/api/admin/*` - Authentication and admin management
- `/api/machines/*` - Machine CRUD and policy updates
- `/api/logs/*` - USB event log retrieval
- `/agent-hub` - Socket.IO namespace for agent connections

**Agent Communication Protocol:**
- Agents connect via Socket.IO and emit "Register" event with machine details
- Server tracks connected agents and updates machine status to "online"
- Admins can send commands (EnableUsb, DisableUsb, GetStatus) through Socket.IO
- Agents emit heartbeat events to maintain connection status
- Automatic status updates to "offline" when agents disconnect

### Data Storage

**Database: PostgreSQL**
- Accessed via Neon serverless driver
- ORM: Drizzle ORM for type-safe database queries
- Migration strategy: Schema defined in `shared/schema.ts`, migrations in `migrations/` directory

**Database Schema:**

**admins table:**
- Stores administrator credentials and roles
- Password hashing via bcryptjs
- Default admin seeded: admin@company.com / admin123

**machines table:**
- Tracks Windows machines running USB agents
- Unique agentId per machine
- Status field (online/offline) updated based on Socket.IO connection
- Stores hostname, OS version, IP address, and agent version

**policies table:**
- One-to-one relationship with machines (via machineId foreign key)
- `lockAllUsb` boolean determines if USB is blocked
- `temporarilyUnlockedUntil` timestamp for temporary access grants
- Cascade delete when machine is removed

**usb_logs table:**
- Audit trail of all USB device events
- Records device details (vendor, product, deviceId)
- Event types: connected, disconnected, blocked
- Status: allowed or blocked
- Foreign key to machines table

### Authentication & Authorization

**Admin Authentication:**
- JWT-based authentication with 7-day expiration
- Password hashing using bcrypt (10 rounds)
- Tokens stored in localStorage on client
- `authMiddleware` validates Bearer tokens on protected routes
- Payload includes adminId, email, and role for future RBAC expansion

**Agent Authentication:**
- Currently relies on agentId registration
- No token-based auth for agents (potential security improvement area)
- Agents identified by their unique agentId sent during registration

### External Dependencies

**Third-party Services:**
- **Neon Database**: Serverless PostgreSQL hosting
- **Socket.IO**: WebSocket communication library for real-time agent connections

**Key NPM Packages:**
- `@neondatabase/serverless` - Neon database driver
- `drizzle-orm` - Type-safe SQL query builder
- `socket.io` - WebSocket server
- `express` - Web framework
- `jsonwebtoken` - JWT creation and validation
- `bcryptjs` - Password hashing
- `@tanstack/react-query` - React data fetching
- `@radix-ui/*` - Headless UI components
- `wouter` - Lightweight routing

**Build Tools:**
- Vite for frontend bundling and HMR
- esbuild for server-side bundling
- Drizzle Kit for database migrations
- TypeScript compiler for type checking

**Windows Service Integration Note:**
The backend uses Socket.IO while the Windows agent (external .NET service) uses SignalR. These protocols are not directly compatible. The Windows agent needs either:
1. Adaptation to use Socket.IO client library instead of SignalR
2. Backend modification to use SignalR (via @microsoft/signalr npm package)
3. Protocol translation layer

**Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string (required)
- `JWT_SECRET` - Secret key for JWT signing (defaults to insecure value in development)
- `NODE_ENV` - Environment mode (development/production)