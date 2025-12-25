# SIGN - USB

A comprehensive USB device management and monitoring system for enterprise environments.

## 📚 Documentation

- **[Knowledge Base](./KNOWLEDGE_BASE.md)** - Complete user guide with step-by-step instructions and screenshot locations
- **[Functionality Guide](./FUNCTIONALITY.md)** - Technical overview and architecture documentation
- **[Integration Guide](./INTEGRATION_GUIDE.md)** - Windows Service integration instructions

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (Node 20 recommended)
- MySQL/TiDB database
- Modern web browser

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run development server
npm run dev

# Build for production
npm run build
```

### Accessing the Application

1. Navigate to `http://localhost:3000` (or your configured port)
2. Login with admin credentials
3. Start managing your USB devices and systems

## 📖 User Guide

For detailed instructions on using the application, see the **[Knowledge Base](./KNOWLEDGE_BASE.md)** which includes:

- Step-by-step guides for all features
- Screenshot locations for documentation
- Troubleshooting tips
- Best practices

## 🏗️ Architecture

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React + Vite + TypeScript
- **Database**: MySQL/TiDB (via Drizzle ORM)
- **Authentication**: JWT tokens
- **UI Components**: Shadcn UI + Tailwind CSS

## 📋 Features

- ✅ **Dashboard** - Real-time system health and KPI monitoring
- ✅ **Machine Management** - Register and manage client systems
- ✅ **Profile Management** - Create and assign USB access policies
- ✅ **User Management** - Admin user CRUD operations
- ✅ **Reports & Analytics** - Comprehensive device and activity reports
- ✅ **Website Access Control** - Manage allowed website URLs
- ✅ **USB Activity Logs** - Track all USB device connections
- ✅ **Real-time Status** - Online/offline system detection

## 🔧 Development

```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## 📝 License

Proprietary - All rights reserved

---

For detailed user instructions, see the [Knowledge Base](./KNOWLEDGE_BASE.md).


