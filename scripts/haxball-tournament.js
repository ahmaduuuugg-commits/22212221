// 🎮 RHL TOURNAMENT 🎮 - Enhanced Haxball Headless Script
// Enhanced version with permanent admin saving and auto-join prevention
// Players wait in spectators until admin moves them - they don't auto-return to spectators
// Copy the entire script and paste it on haxball.com to create the tournament room

// ==================== IMPORTANT SETTINGS - Change before use ====================
const ROOM_CONFIG = {
    roomName: process.env.ROOM_NAME || "🎮 RHL TOURNAMENT 🎮",
    playerName: "[HOST]",
    maxPlayers: parseInt(process.env.MAX_PLAYERS) || 16,
    public: true,
    geo: { code: process.env.GEO_CODE || "eg", lat: parseFloat(process.env.GEO_LAT) || 30.0444, lon: parseFloat(process.env.GEO_LON) || 31.2357 },
    token: process.env.HAXBALL_TOKEN || "thr1.AAAAAGioii7He5G3opmqIQ.QWVGQjVKkXc", // ✅ Reads from ENV!
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
        // Additional STUN servers for better connectivity
        { urls: "stun:stun.sipnet.net" },
        { urls: "stun:stun.sipnet.ru" },
        { urls: "stun:stun.stunprotocol.org:3478" }
    ],
    // Optional: You can also try these locations for better Middle East connectivity:
    // geo: { code: "ae", lat: 25.2048, lon: 55.2708 }, // UAE - Dubai
    // geo: { code: "sa", lat: 24.7136, lon: 46.6753 }, // Saudi Arabia - Riyadh  
    // geo: { code: "tr", lat: 41.0082, lon: 28.9784 }, // Turkey - Istanbul (EU servers)
};

const DISCORD_CONFIG = {
    webhook: process.env.DISCORD_WEBHOOK || "https://canary.discord.com/api/webhooks/1406959936851939379/Bla-hWfT8-lC5U9gXxouT9GA2W0Txltpnv4CrgzYvArO2mqMr_WaUkBA-TsYs3GrTXDT",
    channelId: process.env.DISCORD_CHANNEL_ID || "1406959666717790228",
    reportRoleId: process.env.DISCORD_REPORT_ROLE_ID || "1406593382632915014",
    serverInvite: process.env.DISCORD_INVITE || "https://discord.gg/R3Rtwqqhwm",
};

const OWNER_PASSWORD = process.env.OWNER_PASSWORD || "opopop"; // ✅ Reads from ENV!

// ==================== System Variables ====================
let room;
let gameState = {
    owner: null,
    admins: new Set(),
    savedAdmins: new Map(), // Save admin info permanently: name -> connection
    savedOwner: null, // Save owner connection permanently
    ownerName: null, // Save owner name permanently
    clubs: new Map(),
    clubCaptains: new Map(),
    playerStats: new Map(),
    currentMatch: null,
    lastDiscordReminder: 0,
    matchStats: {
        redGoals: 0,
        blueGoals: 0,
        goalScorers: [],
        assists: [],
        mvp: null
    },
    ballTracker: {
        lastTouchPlayer: null,
        lastTouchTime: 0,
        lastTouchTeam: 0,
        ballHistory: []
    }
};

// ==================== Room Initialization ====================
console.log('🔍 Starting room initialization...');
console.log('Token length:', ROOM_CONFIG.token ? ROOM_CONFIG.token.length : 'NO TOKEN');
console.log('Room name:', ROOM_CONFIG.roomName);
console.log('Geo location:', ROOM_CONFIG.geo);

window.hbInitCalled = false;

// Check if HBInit is available
if (typeof HBInit === 'undefined') {
    console.error('❌ HBInit function is not available!');
    window.initErrors = window.initErrors || [];
    window.initErrors.push('HBInit function not found');
    throw new Error('HBInit function not available');
}

console.log('✅ HBInit function is available');

try {
    console.log('🚀 Calling HBInit with config...');
    console.log('Config details:', {
        roomName: ROOM_CONFIG.roomName,
        maxPlayers: ROOM_CONFIG.maxPlayers,
        public: ROOM_CONFIG.public,
        geo: ROOM_CONFIG.geo,
        tokenPresent: !!ROOM_CONFIG.token,
        tokenLength: ROOM_CONFIG.token ? ROOM_CONFIG.token.length : 0,
        tokenStart: ROOM_CONFIG.token ? ROOM_CONFIG.token.substring(0, 10) + '...' : 'NO TOKEN'
    });
    
    window.hbInitCalled = true;
    
    // Try HBInit and capture any errors
    const startTime = Date.now();
    room = HBInit(ROOM_CONFIG);
    const endTime = Date.now();
    
    console.log(`⏱️ HBInit took ${endTime - startTime}ms`);
    
    if (room) {
        console.log("✅ Room object created successfully!");
        console.log("Room details:", {
            name: room.name || 'no name',
            playerCount: room.getPlayerList ? room.getPlayerList().length : 'no getPlayerList method',
            hasOnPlayerJoin: typeof room.onPlayerJoin === 'function'
        });
        
        // Make room available globally
        window.room = room;
    } else {
        console.error("❌ HBInit returned null/undefined");
        window.initErrors = window.initErrors || [];
        window.initErrors.push('HBInit returned null');
    }
    
    // Send initial Discord notification
    sendDiscordWebhook({
        title: "🎮 RHL TOURNAMENT Room Started",
        description: "Tournament room is now online and ready for players!",
        color: 0x00ff00,
        timestamp: new Date().toISOString(),
        fields: [
            { name: "Room Name", value: ROOM_CONFIG.roomName, inline: true },
            { name: "Max Players", value: ROOM_CONFIG.maxPlayers.toString(), inline: true },
            { name: "Location", value: "Egypt 🇪🇬", inline: true }
        ]
    });
} catch (error) {
    console.error("❌ Failed to initialize room:", error);
    throw error;
}

// ==================== Helper Functions ====================
function sendDiscordWebhook(embed) {
    try {
        fetch(DISCORD_CONFIG.webhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                embeds: [embed],
            }),
        }).catch(err => console.log("Discord webhook error:", err));
    } catch (error) {
        console.log("Discord webhook error:", error);
    }
}

function getPlayerRole(player) {
    // Check club captain first (has priority)
    for (let [clubName, captain] of gameState.clubCaptains) {
        if (captain === player.name) {
            if (gameState.owner && player.id === gameState.owner.id) {
                return `👑 OWNER [${clubName}]`;
            }
            if (gameState.admins.has(player.id)) {
                return `🛡️ ADMIN [${clubName}]`;
            }
            return `👨‍✈️ CAPTAIN [${clubName}]`;
        }
    }

    // Check other roles
    if (gameState.owner && player.id === gameState.owner.id) return "👑 OWNER";
    if (gameState.admins.has(player.id)) return "🛡️ ADMIN";

    // Check club membership
    for (let [clubName, members] of gameState.clubs) {
        if (members.includes(player.name)) {
            return `⚽ [${clubName}]`;
        }
    }
    return "👤 PLAYER";
}

function formatPlayerName(player) {
    const role = getPlayerRole(player);
    return `${role} ${player.name}`;
}

function isOwner(player) {
    return gameState.owner && player.id === gameState.owner.id;
}

function isAdmin(player) {
    return isOwner(player) || gameState.admins.has(player.id);
}

function isSavedOwner(player) {
    return (
        (gameState.savedOwner && player.conn === gameState.savedOwner) ||
        (gameState.ownerName && player.name === gameState.ownerName)
    );
}

function isSavedAdmin(player) {
    return (
        gameState.savedAdmins.has(player.name) &&
        (player.conn === gameState.savedAdmins.get(player.name) ||
            gameState.savedAdmins.get(player.name) === null)
    );
}

function autoRestoreRanks(player) {
    // Restore owner automatically
    if (isSavedOwner(player)) {
        gameState.owner = player;
        room.setPlayerAdmin(player.id, true);
        room.sendAnnouncement(
            `👑 Welcome back, Owner ${player.name}!`,
            null,
            0xffd700,
            "bold",
        );

        gameState.savedOwner = player.conn;
        gameState.ownerName = player.name;

        sendDiscordWebhook({
            title: "👑 Owner Auto-Login",
            description: `**${player.name}** automatically restored as owner`,
            color: 0xffd700,
            timestamp: new Date().toISOString(),
        });
        return true;
    }

    // Restore admin automatically
    if (isSavedAdmin(player)) {
        gameState.admins.add(player.id);
        room.setPlayerAdmin(player.id, true);
        room.sendAnnouncement(
            `🛡️ Welcome back, Admin ${player.name}!`,
            null,
            0x00ff00,
            "bold",
        );

        gameState.savedAdmins.set(player.name, player.conn);

        sendDiscordWebhook({
            title: "🛡️ Admin Auto-Login",
            description: `**${player.name}** automatically restored as admin`,
            color: 0x00ff00,
            timestamp: new Date().toISOString(),
        });
        return true;
    }

    return false;
}

// ==================== Player Movement Control ====================
// Track manually moved players
let manuallyMovedPlayers = new Set();

// This function prevents NEW players from automatically joining teams
function preventAutoJoinForNewPlayers() {
    const players = room.getPlayerList();
    players.forEach(player => {
        // Only prevent auto-join for players who haven't been manually moved by admin
        if (player.team !== 0 && !isAdmin(player) && !manuallyMovedPlayers.has(player.id)) {
            // Move to spectators only if they auto-joined
            room.setPlayerTeam(player.id, 0);
            room.sendAnnouncement(
                `⚠️ ${player.name} moved to spectators. Wait for admin to assign you to a team.`,
                player.id,
                0xff6600,
                "normal"
            );
        }
    });
}

// Mark players as manually moved when admin moves them
function markAsManuallyMoved(playerId) {
    manuallyMovedPlayers.add(playerId);
    console.log(`Player ${playerId} marked as manually moved`);
}

// Remove player from tracking when they leave
function removePlayerTracking(playerId) {
    manuallyMovedPlayers.delete(playerId);
}

// Run auto-join prevention check every 1 second for new players only
setInterval(preventAutoJoinForNewPlayers, 1000);

// ==================== Discord Reminder System ====================
function sendDiscordReminder() {
    const now = Date.now();
    if (now - gameState.lastDiscordReminder >= 180000) { // 3 minutes
        room.sendAnnouncement(
            `📢 Join our Discord server: ${DISCORD_CONFIG.serverInvite}`,
            null,
            0x7289da,
            "bold",
        );
        gameState.lastDiscordReminder = now;
    }
}

setInterval(sendDiscordReminder, 180000); // Every 3 minutes

// ==================== Commands System ====================
const commands = {
    // Owner authentication
    owner: (player, args) => {
        if (args[0] === OWNER_PASSWORD) {
            gameState.owner = player;
            gameState.savedOwner = player.conn;
            gameState.ownerName = player.name;
            room.setPlayerAdmin(player.id, true);

            room.sendAnnouncement(
                `👑 ${player.name} is now the Owner! (Permanently saved)`,
                null,
                0xffd700,
                "bold",
            );

            sendDiscordWebhook({
                title: "👑 Owner Login",
                description: `**${player.name}** authenticated as room owner`,
                color: 0xffd700,
                timestamp: new Date().toISOString(),
            });
        } else {
            room.sendAnnouncement(
                "❌ Wrong owner password!",
                player.id,
                0xff0000,
            );
        }
    },

    // Admin management
    admin: (player, args) => {
        if (!isOwner(player)) {
            room.sendAnnouncement(
                "❌ Only the owner can give admin privileges!",
                player.id,
                0xff0000,
            );
            return;
        }

        const targetName = args.join(" ");
        const targetPlayer = room.getPlayerList().find((p) => p.name === targetName);

        if (!targetPlayer) {
            room.sendAnnouncement("❌ Player not found!", player.id, 0xff0000);
            return;
        }

        gameState.admins.add(targetPlayer.id);
        gameState.savedAdmins.set(targetPlayer.name, targetPlayer.conn);
        room.setPlayerAdmin(targetPlayer.id, true);

        room.sendAnnouncement(
            `🛡️ ${targetPlayer.name} is now an admin! (Permanently saved)`,
            null,
            0x00ff00,
            "bold",
        );

        sendDiscordWebhook({
            title: "🛡️ New Admin",
            description: `**${targetPlayer.name}** promoted to admin by **${player.name}**`,
            color: 0x00ff00,
            timestamp: new Date().toISOString(),
        });
    },

    // Help command
    help: (player, args) => {
        const helpText = `
🎮 RHL TOURNAMENT COMMANDS 🎮

👑 OWNER COMMANDS:
!owner [password] - Authenticate as owner
!admin [player name] - Give admin to player
!unadmin [player name] - Remove admin from player

🛡️ ADMIN COMMANDS:
!kick [player name] - Kick player
!ban [player name] - Ban player
!clear - Clear bans
!rr - Restart game
!pause - Pause game
!unpause - Resume game

⚽ CLUB COMMANDS:
!createclub [club name] - Create a club
!joinclub [club name] - Join a club
!leaveclub - Leave current club
!clubcaptain [player name] - Set club captain
!clubs - List all clubs

📊 TOURNAMENT COMMANDS:
!stats [player name] - View player stats
!leaderboard - View top players
!match [red team] vs [blue team] - Start official match

💬 GENERAL COMMANDS:
!discord - Get Discord server link
!help - Show this help menu
        `;
        
        room.sendAnnouncement(helpText, player.id, 0x00aaff, "normal");
    }
};

// ==================== Event Handlers ====================

// Player join
room.onPlayerJoin = (player) => {
    console.log(`Player ${player.name} joined (ID: ${player.id}, Conn: ${player.conn})`);
    
    // Auto-restore ranks
    const restored = autoRestoreRanks(player);
    
    if (!restored) {
        room.sendAnnouncement(
            `👋 Welcome ${player.name}! Type !help for commands. Join our Discord: ${DISCORD_CONFIG.serverInvite}`,
            player.id,
            0x00aaff,
            "bold",
        );
        
        // Ensure new players start in spectators
        if (player.team !== 0) {
            room.setPlayerTeam(player.id, 0);
        }
    }

    sendDiscordWebhook({
        title: "👋 Player Joined",
        description: `**${formatPlayerName(player)}** joined the room`,
        color: 0x00ff00,
        timestamp: new Date().toISOString(),
        fields: [
            { name: "Player Count", value: room.getPlayerList().length.toString(), inline: true }
        ]
    });
};

// Player leave
room.onPlayerLeave = (player) => {
    console.log(`Player ${player.name} left (ID: ${player.id})`);
    
    removePlayerTracking(player.id);
    gameState.admins.delete(player.id);
    
    if (gameState.owner && player.id === gameState.owner.id) {
        gameState.owner = null;
    }

    sendDiscordWebhook({
        title: "👋 Player Left",
        description: `**${formatPlayerName(player)}** left the room`,
        color: 0xff6600,
        timestamp: new Date().toISOString(),
        fields: [
            { name: "Player Count", value: room.getPlayerList().length.toString(), inline: true }
        ]
    });
};

// Chat command handling
room.onPlayerChat = (player, message) => {
    if (message.startsWith("!")) {
        const args = message.slice(1).split(" ");
        const command = args.shift().toLowerCase();
        
        if (commands[command]) {
            commands[command](player, args);
            return false; // Don't show the command in chat
        }
    }
    return true;
};

// Team change event (to track admin movements)
room.onPlayerTeamChange = (changedPlayer, byPlayer) => {
    if (byPlayer && isAdmin(byPlayer)) {
        markAsManuallyMoved(changedPlayer.id);
        
        const teamNames = ["Spectators", "Red Team", "Blue Team"];
        room.sendAnnouncement(
            `🔄 ${changedPlayer.name} moved to ${teamNames[changedPlayer.team]} by ${byPlayer.name}`,
            null,
            0x00aaff,
            "normal"
        );
    }
};

// Game events
room.onGameStart = (byPlayer) => {
    gameState.matchStats = {
        redGoals: 0,
        blueGoals: 0,
        goalScorers: [],
        assists: [],
        mvp: null
    };
    
    room.sendAnnouncement(
        "🚀 Game started! Good luck to both teams! 🚀",
        null,
        0x00ff00,
        "bold",
        2
    );

    sendDiscordWebhook({
        title: "🚀 Game Started",
        description: byPlayer ? `Game started by **${byPlayer.name}**` : "Game started automatically",
        color: 0x00ff00,
        timestamp: new Date().toISOString()
    });
};

room.onGameStop = (byPlayer) => {
    room.sendAnnouncement(
        "⏹️ Game stopped!",
        null,
        0xff6600,
        "bold"
    );

    sendDiscordWebhook({
        title: "⏹️ Game Stopped",
        description: byPlayer ? `Game stopped by **${byPlayer.name}**` : "Game stopped automatically",
        color: 0xff6600,
        timestamp: new Date().toISOString()
    });
};

// Goal tracking
room.onPlayerBallKick = (player) => {
    gameState.ballTracker.lastTouchPlayer = player;
    gameState.ballTracker.lastTouchTime = Date.now();
    gameState.ballTracker.lastTouchTeam = player.team;
};

room.onTeamGoal = (team) => {
    const scores = room.getScores();
    gameState.matchStats.redGoals = scores.red;
    gameState.matchStats.blueGoals = scores.blue;
    
    const lastTouch = gameState.ballTracker.lastTouchPlayer;
    if (lastTouch && lastTouch.team === team) {
        // Regular goal
        gameState.matchStats.goalScorers.push(lastTouch.name);
        const stats = getPlayerStats(lastTouch.name);
        stats.goals++;
        
        createGoalEffect(lastTouch);
        
        sendDiscordWebhook({
            title: "⚽ GOAL!",
            description: `**${lastTouch.name}** scored for ${team === 1 ? 'Red' : 'Blue'} team!`,
            color: team === 1 ? 0xff0000 : 0x0000ff,
            timestamp: new Date().toISOString(),
            fields: [
                { name: "Score", value: `Red ${scores.red} - ${scores.blue} Blue`, inline: true }
            ]
        });
    } else if (lastTouch) {
        // Own goal
        const stats = getPlayerStats(lastTouch.name);
        stats.ownGoals++;
        
        createOwnGoalEffect(lastTouch);
        
        sendDiscordWebhook({
            title: "😅 Own Goal",
            description: `**${lastTouch.name}** scored an own goal!`,
            color: 0xff6600,
            timestamp: new Date().toISOString(),
            fields: [
                { name: "Score", value: `Red ${scores.red} - ${scores.blue} Blue`, inline: true }
            ]
        });
    }
};

// Initialize room welcome message
room.sendAnnouncement(
    "🎮 Welcome to RHL TOURNAMENT! 🎮\n" +
    "📋 Type !help for commands\n" +
    "💬 Join Discord: " + DISCORD_CONFIG.serverInvite + "\n" +
    "⚠️ Players must wait in spectators until moved by admin",
    null,
    0x00aaff,
    "bold",
    2
);

console.log("🎮 RHL TOURNAMENT room is ready!");
