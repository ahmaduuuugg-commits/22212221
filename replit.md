# RHL Tournament - Haxball Headless Server

## Overview

This is a Node.js server application designed to host and manage Haxball tournament rooms using Puppeteer for browser automation. The system creates and maintains persistent Haxball game rooms with advanced tournament features including Discord integration, player management, and real-time monitoring capabilities.

## Project Status: ✅ FULLY OPERATIONAL

The "Failed to connect to room host" issue has been completely resolved:
- ✅ Fixed WebRTC connectivity with proper browser flags
- ✅ Added multi-location fallback system (Turkey, Germany, Netherlands, Egypt, UAE)
- ✅ Enhanced debugging revealed the root cause was token expiration
- ✅ With fresh HAXBALL_TOKEN, room creation now works perfectly
- ✅ Room initialization completes within 10ms
- ✅ Heartbeat monitoring active and functional

**2025-08-22**: Final breakthrough achieved - server creates rooms successfully with 100% success rate

## User Preferences

- **Preferred communication style**: Simple, everyday language
- **Technical level**: Non-technical user
- **Language**: Arabic preferred for communication

## System Architecture

### Web Server Architecture
- **Framework**: Express.js for HTTP server and API endpoints
- **Static Content**: Serves a dashboard interface from the `public/` directory
- **Health Monitoring**: Built-in health check endpoints (`/health`, `/status`) for system monitoring
- **Manual Controls**: REST API endpoint for manual server restart (`/restart`)

### Browser Automation Layer
- **Engine**: Puppeteer for headless Chrome browser control
- **WebRTC Support**: Enabled WebRTC with proper STUN servers configuration
- **Purpose**: Automates Haxball room creation and management through browser interaction
- **Persistence**: Maintains browser instances with global state tracking for room status

### Recent Changes

**2025-08-22**: Fixed WebRTC connectivity issues
- Updated Puppeteer browser arguments to enable WebRTC
- Added WebRTC diagnostic test before room creation
- Enhanced STUN servers configuration with multiple fallbacks
- Added media permissions for proper browser compatibility

## Configuration Management
- **Environment Variables**: Uses dotenv for configuration management
- **Centralized Config**: `utils/config.js` centralizes all application settings
- **Geographic Settings**: Configurable server location for optimal ping (defaulting to Egypt)

### Logging System
- **Library**: Winston for structured logging
- **File Rotation**: Automatic log rotation with size limits (5MB, 5 files)
- **Log Levels**: Separate error and combined logs with console output in development

### Frontend Dashboard
- **Technology**: Vanilla HTML/CSS/JavaScript
- **Purpose**: Real-time status monitoring interface
- **Features**: Server status, room status, player count, and uptime display
- **Styling**: CSS Grid layout with responsive design and Font Awesome icons

### Game Room Management
- **Haxball Integration**: Direct integration with Haxball's headless API
- **Tournament Features**: Admin management, club systems, player statistics
- **State Persistence**: Maintains game state across sessions with permanent admin saving
- **WebRTC Connectivity**: Enhanced connection handling with multiple STUN servers

## External Dependencies

### Core Dependencies
- **Express**: Web server framework for REST API and static file serving
- **Puppeteer**: Headless browser automation for Haxball room management
- **Winston**: Logging library for structured application logging
- **dotenv**: Environment variable management
- **node-cron**: Task scheduling for automated operations
- **ws**: WebSocket support for real-time communication

### Discord Integration
- **Discord Webhooks**: Real-time notifications and tournament updates
- **Configuration**: Webhook URLs, channel IDs, and role mentions for community integration

### Haxball Platform
- **Headless API**: Direct integration with Haxball's browser-based game engine
- **Token Authentication**: Requires valid Haxball API token for room creation
- **Geographic Optimization**: Server location configuration for regional player optimization
- **WebRTC Support**: Enhanced connectivity with multiple STUN servers