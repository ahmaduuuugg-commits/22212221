# 🎮 Haxball Tournament Server

24/7 Haxball Tournament Room with advanced features for competitive gaming.

## Features

🏆 **Tournament System**
- Advanced player management and statistics
- Club system with captains and members
- Real-time match tracking and scoring

🛡️ **Admin Controls**
- Owner/Admin authentication system  
- Player movement controls (red/blue/spec)
- Kick/ban functionality with saved permissions

📊 **Statistics & Monitoring**
- Player statistics tracking (goals, assists, wins)
- Real-time Discord notifications
- Server health monitoring and auto-restart

🌍 **Geographic Optimization**
- Configurable server locations (Egypt, UAE, Saudi, Turkey)
- Optimized for Middle East players

## Environment Variables

Set these in your Render dashboard:

```
HAXBALL_TOKEN=your_haxball_token_here
OWNER_PASSWORD=your_secure_password_here
DISCORD_WEBHOOK=your_discord_webhook_url
DISCORD_INVITE=your_discord_invite_link
ROOM_NAME=🎮 RHL TOURNAMENT 🎮
NODE_ENV=production
```

## Commands

**Owner Commands:**
- `!owner [password]` - Authenticate as owner
- `!admin [player]` - Give admin privileges
- `!newclub [name] [captain]` - Create club

**Admin Commands:**  
- `!red [player]` - Move to red team
- `!blue [player]` - Move to blue team
- `!spec [player]` - Move to spectators
- `!kick [player]` - Kick player
- `!ban [player]` - Ban player

**General Commands:**
- `!stats [player]` - View player statistics
- `!clubs` - List all clubs
- `!help` - Show all commands

## Deployment on Render

1. Create new Web Service
2. Connect your GitHub repository
3. Set Environment: **Docker**
4. Add environment variables above
5. Deploy!

The server will automatically:
- Create and maintain the Haxball room
- Handle player connections
- Send Discord notifications
- Monitor and restart if needed

## Support

Join our Discord: [Your Discord Link]