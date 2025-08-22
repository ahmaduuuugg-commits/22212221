const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');
const config = require('./utils/config');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Global variables
let browser = null;
let page = null;
let isRestartingRoom = false;
let roomStatus = {
    isActive: false,
    lastHeartbeat: null,
    playersCount: 0,
    roomName: '',
    startTime: null,
    restartCount: 0,
    lastRestartTime: null,
    browserConnected: false,
    pageConnected: false
};

// Enhanced health check endpoint
app.get('/health', (req, res) => {
    const now = new Date();
    const memUsage = process.memoryUsage();
    
    const status = {
        server: 'running',
        timestamp: now.toISOString(),
        room: {
            isActive: roomStatus.isActive,
            browserConnected: roomStatus.browserConnected,
            pageConnected: roomStatus.pageConnected,
            playersCount: roomStatus.playersCount,
            roomName: roomStatus.roomName
        },
        uptime: {
            process: process.uptime(),
            server: roomStatus.startTime ? Math.floor((now - roomStatus.startTime) / 1000) : 0
        },
        memory: {
            used: Math.round(memUsage.heapUsed / 1024 / 1024),
            total: Math.round(memUsage.heapTotal / 1024 / 1024),
            external: Math.round(memUsage.external / 1024 / 1024)
        },
        heartbeat: {
            last: roomStatus.lastHeartbeat,
            ageSeconds: roomStatus.lastHeartbeat ? Math.floor((now - roomStatus.lastHeartbeat) / 1000) : null
        },
        restarts: {
            count: roomStatus.restartCount,
            lastRestart: roomStatus.lastRestartTime
        },
        health: roomStatus.isActive && roomStatus.browserConnected && roomStatus.pageConnected ? 'healthy' : 'unhealthy'
    };
    
    const httpStatus = status.health === 'healthy' ? 200 : 503;
    res.status(httpStatus).json(status);
});

// Status endpoint for monitoring
app.get('/status', (req, res) => {
    res.json(roomStatus);
});

// Enhanced manual restart endpoint
app.post('/restart', async (req, res) => {
    logger.info('Manual restart requested via API');
    
    if (isRestartingRoom) {
        res.status(409).json({ 
            success: false, 
            message: 'Restart already in progress' 
        });
        return;
    }
    
    try {
        // Don't await the restart, return immediately
        restartRoomSafely('Manual API restart').catch(error => {
            logger.error('Manual restart failed:', error);
        });
        
        res.json({ 
            success: true, 
            message: 'Room restart initiated',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Failed to initiate manual restart:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to initiate restart',
            error: error.message
        });
    }
});

// Initialize Puppeteer browser with better error handling
async function initBrowser() {
    try {
        // Close existing browser if any
        await closeBrowserSafely();
        
        logger.info('Initializing new Puppeteer browser...');
        
        const browserArgs = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-first-run',
            '--no-zygote',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            // WebRTC support
            '--enable-webrtc',
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--allow-running-insecure-content',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--ignore-certificate-errors',
            '--ignore-ssl-errors',
            '--ignore-certificate-errors-spki-list',
            '--ignore-certificate-errors-ssl-errors',
            // Additional network settings
            '--disable-background-networking',
            '--enable-features=NetworkService,NetworkServiceLogging',
            '--disable-ipc-flooding-protection',
            '--force-webrtc-ip-handling-policy=default',
            // Additional stability args
            '--disable-extensions',
            '--disable-plugins',
            '--disable-images',
            '--disable-javascript-harmony-shipping',
            '--disable-client-side-phishing-detection'
        ];

        // Additional args for Render environment
        if (process.env.RENDER) {
            browserArgs.push('--single-process');
        }

        // Use system chromium
        const executablePath = config.PUPPETEER_EXECUTABLE_PATH;

        browser = await puppeteer.launch({
            headless: 'new',
            args: browserArgs,
            defaultViewport: { width: 1280, height: 720 },
            executablePath: executablePath,
            timeout: 60000 // Increased timeout for initialization
        });

        // Set up browser event handlers
        browser.on('disconnected', () => {
            logger.warn('Browser disconnected event triggered');
            roomStatus.browserConnected = false;
            // Schedule restart after a delay to avoid rapid restarts
            if (!isRestartingRoom) {
                setTimeout(() => {
                    restartRoomSafely('Browser disconnected');
                }, 5000);
            }
        });

        roomStatus.browserConnected = true;
        logger.info('Browser initialized successfully');
        return browser;
    } catch (error) {
        logger.error('Failed to initialize browser:', error);
        roomStatus.browserConnected = false;
        throw error;
    }
}

// Safely close browser
async function closeBrowserSafely() {
    try {
        if (page && !page.isClosed()) {
            logger.info('Closing existing page...');
            await page.close().catch(err => logger.warn('Error closing page:', err));
        }
        
        if (browser && browser.connected) {
            logger.info('Closing existing browser...');
            await browser.close().catch(err => logger.warn('Error closing browser:', err));
        }
        
        browser = null;
        page = null;
        roomStatus.browserConnected = false;
        roomStatus.pageConnected = false;
    } catch (error) {
        logger.warn('Error during browser cleanup:', error);
        // Force reset even if cleanup failed
        browser = null;
        page = null;
        roomStatus.browserConnected = false;
        roomStatus.pageConnected = false;
    }
}

// Check if browser and page are healthy
async function isBrowserHealthy() {
    try {
        if (!browser || !browser.connected) {
            return false;
        }
        
        if (!page || page.isClosed()) {
            return false;
        }
        
        // Try a simple operation to test connection
        await page.evaluate(() => Date.now());
        return true;
    } catch (error) {
        logger.warn('Browser health check failed:', error.message);
        return false;
    }
}

// Geographic fallback locations
const GEO_LOCATIONS = [
    { code: 'tr', lat: 41.0082, lon: 28.9784, name: 'Turkey - Istanbul' },
    { code: 'de', lat: 52.5200, lon: 13.4050, name: 'Germany - Berlin' }, 
    { code: 'nl', lat: 52.3676, lon: 4.9041, name: 'Netherlands - Amsterdam' },
    { code: 'eg', lat: 30.0444, lon: 31.2357, name: 'Egypt - Cairo' },
    { code: 'ae', lat: 25.2048, lon: 55.2708, name: 'UAE - Dubai' }
];

// Create new page and setup Haxball room with location fallback
async function createHaxballRoom(locationIndex = 0) {
    try {
        logger.info('Creating new Haxball room...');
        
        if (!browser) {
            await initBrowser();
        }

        page = await browser.newPage();
        
        // Set up page event handlers first
        page.on('error', (error) => {
            logger.error('Page error event:', error.message);
        });
        
        page.on('pageerror', (error) => {
            logger.error('Page pageerror event:', error.message);
        });
        
        page.on('close', () => {
            logger.warn('Page close event triggered');
            roomStatus.pageConnected = false;
        });
        
        page.on('framedetached', (frame) => {
            logger.warn('Frame detached event:', frame.url());
        });
        
        // Enable WebRTC permissions
        const context = browser.defaultBrowserContext();
        await context.overridePermissions('https://www.haxball.com', [
            'camera',
            'microphone',
            'notifications',
            'geolocation'
        ]);
        
        // Set user agent and other page settings
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Set viewport and other settings
        await page.setViewport({ width: 1280, height: 720 });
        
        // Navigate to Haxball with retry logic
        let navigationSuccess = false;
        let navAttempts = 0;
        const maxNavAttempts = 3;
        
        while (!navigationSuccess && navAttempts < maxNavAttempts) {
            try {
                navAttempts++;
                logger.info(`Navigation attempt ${navAttempts}/${maxNavAttempts}`);
                
                await page.goto('https://www.haxball.com/headless', {
                    waitUntil: 'networkidle2',
                    timeout: 45000
                });
                
                navigationSuccess = true;
                roomStatus.pageConnected = true;
            } catch (navError) {
                logger.warn(`Navigation attempt ${navAttempts} failed:`, navError.message);
                if (navAttempts === maxNavAttempts) {
                    throw navError;
                }
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        logger.info('Navigated to Haxball headless page');

        // Wait for page to load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Test WebRTC before creating room
        const webrtcSupported = await page.evaluate(() => {
            return new Promise((resolve) => {
                if (!window.RTCPeerConnection) {
                    resolve(false);
                    return;
                }
                
                const pc = new RTCPeerConnection({
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' }
                    ]
                });
                
                let candidatesFound = false;
                const timeout = setTimeout(() => {
                    pc.close();
                    resolve(candidatesFound);
                }, 10000);
                
                pc.onicecandidate = (event) => {
                    if (event.candidate) {
                        candidatesFound = true;
                        clearTimeout(timeout);
                        pc.close();
                        resolve(true);
                    }
                };
                
                pc.createDataChannel('test');
                pc.createOffer().then(offer => {
                    return pc.setLocalDescription(offer);
                }).catch(() => {
                    clearTimeout(timeout);
                    pc.close();
                    resolve(false);
                });
            });
        });
        
        if (!webrtcSupported) {
            throw new Error('WebRTC is not supported or blocked in this environment');
        }
        
        logger.info('WebRTC test passed - connection candidates found');
        
        // Test Haxball API accessibility
        try {
            const haxballTest = await page.evaluate(() => {
                return fetch('https://www.haxball.com/headlesstoken', { method: 'GET' })
                    .then(response => response.status)
                    .catch(err => 'network_error');
            });
            logger.info(`Haxball API test result: ${haxballTest}`);
        } catch (error) {
            logger.warn('Could not test Haxball API accessibility:', error.message);
        }

        // Load tournament script
        const tournamentScript = fs.readFileSync(path.join(__dirname, 'scripts/haxball-tournament.js'), 'utf8');
        
        // Replace all process.env references with actual values
        let configuredScript = tournamentScript;
        
        // Log before replacements
        logger.info('Configuring tournament script with environment variables');
        
        // Use current location or fallback
        const currentLocation = GEO_LOCATIONS[locationIndex] || GEO_LOCATIONS[0];
        logger.info(`Attempting room creation with location: ${currentLocation.name}`);
        
        // Replace process.env references systematically
        const replacements = [
            { pattern: /process\.env\.ROOM_NAME/g, value: `"${config.ROOM_NAME}"` },
            { pattern: /parseInt\(process\.env\.MAX_PLAYERS\)/g, value: config.MAX_PLAYERS },
            { pattern: /process\.env\.MAX_PLAYERS/g, value: config.MAX_PLAYERS },
            { pattern: /process\.env\.GEO_CODE/g, value: `"${currentLocation.code}"` },
            { pattern: /parseFloat\(process\.env\.GEO_LAT\)/g, value: currentLocation.lat },
            { pattern: /process\.env\.GEO_LAT/g, value: currentLocation.lat },
            { pattern: /parseFloat\(process\.env\.GEO_LON\)/g, value: currentLocation.lon },
            { pattern: /process\.env\.GEO_LON/g, value: currentLocation.lon },
            { pattern: /process\.env\.HAXBALL_TOKEN/g, value: `"${config.HAXBALL_TOKEN}"` },
            { pattern: /process\.env\.DISCORD_WEBHOOK/g, value: `"${config.DISCORD_WEBHOOK}"` },
            { pattern: /process\.env\.DISCORD_CHANNEL_ID/g, value: `"${config.DISCORD_CHANNEL_ID}"` },
            { pattern: /process\.env\.DISCORD_REPORT_ROLE_ID/g, value: `"${config.DISCORD_REPORT_ROLE_ID}"` },
            { pattern: /process\.env\.DISCORD_INVITE/g, value: `"${config.DISCORD_INVITE}"` },
            { pattern: /process\.env\.OWNER_PASSWORD/g, value: `"${config.OWNER_PASSWORD}"` }
        ];
        
        replacements.forEach(({ pattern, value }) => {
            const matches = configuredScript.match(pattern);
            if (matches) {
                logger.info(`Replacing ${matches.length} instances of ${pattern.source}`);
                configuredScript = configuredScript.replace(pattern, value);
            }
        });
        
        // Final check for any remaining process.env references
        const remainingProcessEnv = configuredScript.match(/process\.env/g);
        if (remainingProcessEnv) {
            logger.warn(`Found ${remainingProcessEnv.length} remaining process.env references`);
            // Replace any remaining process.env with empty object to prevent errors
            configuredScript = configuredScript.replace(/process\.env/g, '{}');
        }

        // Enhanced console event listeners with filtering
        page.on('console', (msg) => {
            const type = msg.type();
            const text = msg.text();
            
            // Filter out noisy console messages
            const ignoredMessages = [
                'Failed to load resource',
                'net::ERR_BLOCKED_BY_CLIENT',
                'Received an invalid message',
                'chrome-extension'
            ];
            
            const shouldIgnore = ignoredMessages.some(ignored => text.includes(ignored));
            
            if (!shouldIgnore) {
                if (type === 'error') {
                    logger.error(`Browser Console ERROR: ${text}`);
                } else if (type === 'log') {
                    logger.info(`Browser Console LOG: ${text}`);
                } else if (type === 'warn') {
                    logger.warn(`Browser Console WARN: ${text}`);
                }
            }
        });
        
        // Add error capturing before script injection
        await page.evaluateOnNewDocument(() => {
            window.initErrors = [];
            window.console.logs = [];
        });
        
        // Inject tournament script and capture room link
        const roomResult = await page.evaluate(configuredScript);
        
        logger.info('Tournament script injected successfully');
        
        // Wait for room creation with better debugging
        logger.info('Waiting for room initialization...');
        
        const roomInitialized = await page.waitForFunction(() => {
            // Add debugging information to window
            window.debugInfo = {
                roomExists: typeof window.room !== 'undefined',
                roomType: typeof window.room,
                hasGetPlayerList: window.room && typeof window.room.getPlayerList === 'function',
                roomObject: window.room ? 'room object exists' : 'no room object',
                errors: window.initErrors || [],
                hbInitCalled: window.hbInitCalled || false
            };
            
            return window.room && typeof window.room.getPlayerList === 'function';
        }, { timeout: 20000 }).catch(async () => {
            // Get debug info if timeout occurs
            const debugInfo = await page.evaluate(() => window.debugInfo || {});
            logger.error('Room initialization timeout. Debug info:', debugInfo);
            
            // Try to get any console errors
            const consoleErrors = await page.evaluate(() => {
                return window.console.logs || [];
            });
            if (consoleErrors.length > 0) {
                logger.error('Console errors:', consoleErrors);
            }
            
            return false;
        });
        
        // Only proceed if room was initialized
        if (!roomInitialized) {
            throw new Error('Room initialization failed - timeout exceeded');
        }
        
        // Get room link - check window.roomLink first (set by our script), then room object
        const roomLink = await page.evaluate(() => {
            try {
                // First check if our script set the roomLink
                if (window.roomLink) {
                    return window.roomLink;
                }
                
                // Then check room object properties
                if (window.room && window.room.link) {
                    return window.room.link;
                } else if (window.room && typeof window.room === 'object') {
                    // Try to find room link in room properties
                    for (let prop in window.room) {
                        if (typeof window.room[prop] === 'string' && window.room[prop].includes('haxball.com/play')) {
                            return window.room[prop];
                        }
                    }
                    // Check if there's a method to get the link
                    if (typeof window.room.getRoomLink === 'function') {
                        return window.room.getRoomLink();
                    }
                    // If no direct link found, try to get from current URL hash or search params
                    const currentUrl = window.location.href;
                    if (currentUrl.includes('#')) {
                        const hash = currentUrl.split('#')[1];
                        if (hash && hash.length > 10) {
                            return `https://www.haxball.com/play?c=${hash}`;
                        }
                    }
                    return 'Room created but link not accessible - check room object properties: ' + Object.keys(window.room).join(', ');
                } else {
                    return 'No room object available - possible token issue';
                }
            } catch (error) {
                return 'Error getting room link: ' + error.message;
            }
        });
        
        // Check for token-related issues in the logs
        const tokenIssues = await page.evaluate(() => {
            try {
                const errors = window.initErrors || [];
                const hasTokenError = errors.some(error => 
                    error.includes('token') || 
                    error.includes('invalid') || 
                    error.includes('expired') ||
                    error.includes('unauthorized')
                );
                return hasTokenError ? errors : null;
            } catch (error) {
                return null;
            }
        });
        
        logger.info('Room link:', roomLink);
        
        // Warn about potential token issues
        if (tokenIssues) {
            logger.warn('Possible token-related issues detected:', tokenIssues);
            logger.warn('💡 SOLUTION: Check if HAXBALL_TOKEN is valid and not expired. Get a fresh token from https://www.haxball.com/headlesstoken');
        }
        
        // If room link looks suspicious, add additional warning
        if (roomLink.includes('not accessible') || roomLink.includes('No room object')) {
            logger.warn('⚠️  POTENTIAL ISSUE: Room created but link not accessible - this usually means:');
            logger.warn('   1. HAXBALL_TOKEN is expired or invalid');
            logger.warn('   2. Network connectivity issues');
            logger.warn('   3. Haxball API changes');
            logger.warn('   🔧 Try getting a fresh token from https://www.haxball.com/headlesstoken');
        }
        
        // Test if room is actually accessible
        const roomTest = await page.evaluate(() => {
            try {
                if (window.room && window.room.getPlayerList) {
                    const players = window.room.getPlayerList();
                    return {
                        playersCount: players.length,
                        roomName: window.room.name || 'Unknown',
                        success: true
                    };
                }
                return { success: false, error: 'Room not initialized' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        logger.info('Room test result:', roomTest);

        // Setup heartbeat monitoring
        await setupHeartbeatMonitoring();
        
        // Setup room status monitoring
        await setupRoomMonitoring();
        
        roomStatus.isActive = true;
        roomStatus.startTime = new Date();
        roomStatus.lastHeartbeat = new Date();
        
        logger.info('Haxball room created and monitoring started');
        
    } catch (error) {
        logger.error(`Failed to create Haxball room with ${GEO_LOCATIONS[locationIndex]?.name || 'default location'}:`, error);
        
        // Try next location if available
        if (locationIndex < GEO_LOCATIONS.length - 1) {
            logger.info(`Trying next location (${locationIndex + 1}/${GEO_LOCATIONS.length})...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            return createHaxballRoom(locationIndex + 1);
        }
        
        throw error;
    }
}

// Setup heartbeat monitoring
async function setupHeartbeatMonitoring() {
    try {
        // Inject heartbeat script into the page
        await page.evaluate(() => {
            // Setup heartbeat system
            window.haxballHeartbeat = {
                lastBeat: Date.now(),
                interval: null,
                start: function() {
                    this.interval = setInterval(() => {
                        this.lastBeat = Date.now();
                        // Store heartbeat data in window for external access
                        window.roomHeartbeat = {
                            timestamp: this.lastBeat,
                            playersCount: room ? room.getPlayerList().length : 0,
                            roomName: room ? 'RHL TOURNAMENT' : 'Unknown'
                        };
                    }, 5000);
                }
            };
            
            // Start heartbeat when room is initialized
            if (typeof room !== 'undefined') {
                window.haxballHeartbeat.start();
            } else {
                // Wait for room to be initialized
                const checkRoom = setInterval(() => {
                    if (typeof room !== 'undefined') {
                        window.haxballHeartbeat.start();
                        clearInterval(checkRoom);
                    }
                }, 1000);
            }
        });
        
        logger.info('Heartbeat monitoring setup complete');
    } catch (error) {
        logger.error('Failed to setup heartbeat monitoring:', error);
    }
}

// Enhanced room monitoring with better error detection
async function setupRoomMonitoring() {
    setInterval(async () => {
        try {
            // Skip monitoring if restart is in progress
            if (isRestartingRoom) {
                return;
            }
            
            // Check browser and page health first
            const browserHealthy = await isBrowserHealthy();
            
            if (!browserHealthy) {
                logger.warn('Browser/Page unhealthy, triggering restart...');
                await restartRoomSafely('Browser health check failed');
                return;
            }
            
            // Try to get heartbeat data
            const heartbeatData = await page.evaluate(() => {
                return window.roomHeartbeat || null;
            }).catch(error => {
                logger.warn('Failed to get heartbeat data:', error.message);
                return null;
            });
            
            if (heartbeatData) {
                roomStatus.lastHeartbeat = new Date(heartbeatData.timestamp);
                roomStatus.playersCount = heartbeatData.playersCount || 0;
                roomStatus.roomName = heartbeatData.roomName || 'Unknown';
                roomStatus.pageConnected = true;
            } else {
                roomStatus.pageConnected = false;
            }
            
            // Check if heartbeat is too old (more than 45 seconds)
            const now = new Date();
            if (roomStatus.lastHeartbeat && (now - roomStatus.lastHeartbeat) > 45000) {
                logger.warn(`Heartbeat is stale (${Math.floor((now - roomStatus.lastHeartbeat) / 1000)}s old), restarting room...`);
                await restartRoomSafely('Stale heartbeat detected');
                return;
            }
            
            // Additional check: if no heartbeat data for too long
            if (!roomStatus.lastHeartbeat && roomStatus.isActive) {
                const timeSinceStart = roomStatus.startTime ? now - roomStatus.startTime : 0;
                if (timeSinceStart > 60000) { // Give 1 minute after start
                    logger.warn('No heartbeat data received after room start, restarting...');
                    await restartRoomSafely('No heartbeat data received');
                }
            }
            
        } catch (error) {
            logger.error('Room monitoring error:', error.message);
            
            // Only restart on critical errors
            if (error.message.includes('detached') || 
                error.message.includes('Connection closed') ||
                error.message.includes('Target closed')) {
                await restartRoomSafely(`Monitoring error: ${error.message}`);
            }
        }
    }, 15000); // Check every 15 seconds (reduced frequency)
}

// Improved restart room function with better error handling
async function restartRoomSafely(reason = 'Manual restart') {
    if (isRestartingRoom) {
        logger.warn('Room restart already in progress, skipping...');
        return;
    }
    
    isRestartingRoom = true;
    
    try {
        logger.info(`Restarting Haxball room. Reason: ${reason}`);
        roomStatus.isActive = false;
        roomStatus.restartCount++;
        roomStatus.lastRestartTime = new Date();
        
        // Prevent restart loops
        if (roomStatus.restartCount > config.MAX_RESTART_COUNT) {
            logger.error(`Maximum restart count (${config.MAX_RESTART_COUNT}) reached. Stopping restart attempts.`);
            return;
        }
        
        // Clean shutdown of browser and page
        await closeBrowserSafely();
        
        // Wait before restart to prevent rapid restarts
        const waitTime = Math.min(5000 * roomStatus.restartCount, 30000); // Exponential backoff, max 30s
        logger.info(`Waiting ${waitTime}ms before restart attempt ${roomStatus.restartCount}...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // Create new room
        await createHaxballRoom();
        logger.info('Room restart completed successfully');
        
        // Reset restart count on successful restart
        if (roomStatus.isActive) {
            roomStatus.restartCount = 0;
        }
        
    } catch (error) {
        logger.error('Failed to restart room:', error);
        
        // Schedule another restart attempt with longer delay
        const retryDelay = Math.min(30000 * roomStatus.restartCount, 300000); // Max 5 minutes
        logger.info(`Scheduling retry in ${retryDelay}ms...`);
        
        setTimeout(() => {
            isRestartingRoom = false;
            restartRoomSafely('Retry after failed restart');
        }, retryDelay);
        return;
    } finally {
        isRestartingRoom = false;
    }
}

// Legacy function for compatibility
async function restartRoom() {
    await restartRoomSafely('Legacy restart call');
}

// Enhanced graceful shutdown
let isShuttingDown = false;

async function gracefulShutdown(signal) {
    if (isShuttingDown) {
        logger.warn(`Already shutting down, ignoring ${signal}`);
        return;
    }
    
    isShuttingDown = true;
    logger.info(`Received ${signal}, shutting down gracefully...`);
    
    try {
        roomStatus.isActive = false;
        
        // Close browser safely with timeout
        const shutdownPromise = closeBrowserSafely();
        const timeoutPromise = new Promise(resolve => setTimeout(resolve, 10000));
        
        await Promise.race([shutdownPromise, timeoutPromise]);
        
        logger.info('Graceful shutdown completed');
    } catch (error) {
        logger.error('Error during graceful shutdown:', error);
    }
    
    process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Error handling
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

// Start server with better initialization
app.listen(PORT, '0.0.0.0', async () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info('Initializing Haxball room...');
    
    // Initialize room with retries
    const initializeRoom = async (attempt = 1) => {
        const maxAttempts = 3;
        
        try {
            await createHaxballRoom();
            logger.info('Haxball room initialization complete');
            return;
        } catch (error) {
            logger.error(`Failed to initialize Haxball room (attempt ${attempt}/${maxAttempts}):`, error);
            
            if (attempt < maxAttempts) {
                const delay = 15000 * attempt; // Increasing delay: 15s, 30s, 45s
                logger.info(`Retrying in ${delay/1000} seconds...`);
                
                setTimeout(() => {
                    initializeRoom(attempt + 1);
                }, delay);
            } else {
                logger.error('Max initialization attempts reached. Manual restart may be required.');
                // Set up periodic retry every 5 minutes
                setTimeout(() => {
                    if (!roomStatus.isActive && !isRestartingRoom) {
                        logger.info('Attempting periodic room initialization...');
                        initializeRoom(1);
                    }
                }, 300000);
            }
        }
    };
    
    await initializeRoom();
});

// Keepalive ping every 5 minutes
setInterval(() => {
    logger.info('Keepalive ping - Room status:', roomStatus.isActive ? 'Active' : 'Inactive');
}, 300000);
