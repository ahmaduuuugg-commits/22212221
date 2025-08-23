require('dotenv').config();

const config = {
    // Server configuration
    PORT: process.env.PORT || 5000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    
    // Haxball room configuration
    HAXBALL_TOKEN: process.env.HAXBALL_TOKEN || 'thr1.AAAAAGioii7He5G3opmqIQ.QWVGQjVKkXc',
    ROOM_NAME: process.env.ROOM_NAME || '🎮 RHL TOURNAMENT 🎮',
    MAX_PLAYERS: parseInt(process.env.MAX_PLAYERS) || 16,
    
    // Geographic settings - Try Turkey for better connectivity
    GEO_CODE: process.env.GEO_CODE || 'tr',
    GEO_LAT: parseFloat(process.env.GEO_LAT) || 41.0082,
    GEO_LON: parseFloat(process.env.GEO_LON) || 28.9784,
    
    // Discord configuration
    DISCORD_WEBHOOK: process.env.DISCORD_WEBHOOK || 'https://canary.discord.com/api/webhooks/1406959936851939379/Bla-hWfT8-lC5U9gXxouT9GA2W0Txltpnv4CrgzYvArO2mqMr_WaUkBA-TsYs3GrTXDT',
    DISCORD_INVITE: process.env.DISCORD_INVITE || 'https://discord.gg/R3Rtwqqhwm',
    DISCORD_CHANNEL_ID: process.env.DISCORD_CHANNEL_ID || '1406959666717790228',
    DISCORD_REPORT_ROLE_ID: process.env.DISCORD_REPORT_ROLE_ID || '1406593382632915014',
    
    // Authentication
    OWNER_PASSWORD: process.env.OWNER_PASSWORD || 'opopop',
    
    // Puppeteer configuration
    PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH || '/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium',
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD !== 'false',
    
    // Monitoring configuration (improved for stability)
    HEARTBEAT_INTERVAL: parseInt(process.env.HEARTBEAT_INTERVAL) || 5000,
    RESTART_TIMEOUT: parseInt(process.env.RESTART_TIMEOUT) || 60000, // Increased to 60s
    KEEPALIVE_INTERVAL: parseInt(process.env.KEEPALIVE_INTERVAL) || 300000,
    MONITORING_INTERVAL: parseInt(process.env.MONITORING_INTERVAL) || 15000, // 15s monitoring
    HEARTBEAT_STALE_TIME: parseInt(process.env.HEARTBEAT_STALE_TIME) || 45000, // 45s before stale
    BROWSER_INIT_TIMEOUT: parseInt(process.env.BROWSER_INIT_TIMEOUT) || 60000, // 60s browser init
    
    // Logging
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    
    // Health check configuration (improved limits)
    HEALTH_CHECK_TIMEOUT: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 15000, // Increased to 15s
    MAX_RESTART_COUNT: parseInt(process.env.MAX_RESTART_COUNT) || 5, // Reduced to prevent loops
    MIN_RESTART_INTERVAL: parseInt(process.env.MIN_RESTART_INTERVAL) || 30000, // Min 30s between restarts
    MAX_RETRY_DELAY: parseInt(process.env.MAX_RETRY_DELAY) || 300000, // Max 5 min retry delay
    
    // Enhanced browser configuration for WebRTC connectivity
    BROWSER_ARGS: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        // CRITICAL WebRTC arguments for Render connectivity
        '--enable-webrtc',
        '--force-webrtc-ip-handling-policy=default',
        '--webrtc-ip-handling-policy=default',
        '--enable-webrtc-stun-origin',
        '--allow-loopback-in-peer-connection',
        '--enable-webrtc-hide-local-ips-with-mdns=false',
        '--webrtc-max-cpu-consumption-percentage=100',
        '--enable-features=WebRTC-H264WithOpenH264FFmpeg',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--allow-running-insecure-content',
        '--ignore-certificate-errors',
        '--ignore-ssl-errors',
        '--ignore-certificate-errors-spki-list',
        '--ignore-certificate-errors-ssl-errors',
        // Network and permissions
        '--enforce-webrtc-ip-permission-check=false',
        '--disable-background-networking',
        '--enable-features=NetworkService,NetworkServiceLogging',
        '--disable-ipc-flooding-protection',
        // Additional stability args
        '--disable-extensions',
        '--disable-plugins', 
        '--disable-images',
        '--disable-javascript-harmony-shipping',
        '--disable-client-side-phishing-detection',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--disable-popup-blocking',
        '--disable-translate',
        '--disable-sync',
        '--metrics-recording-only',
        '--no-crash-upload'
    ]
};

// Add Render-specific configurations
if (process.env.RENDER) {
    config.BROWSER_ARGS.push('--single-process');
    config.IS_RENDER = true;
} else {
    config.IS_RENDER = false;
}

// Validate required environment variables with better logging
const requiredVars = ['HAXBALL_TOKEN', 'DISCORD_WEBHOOK', 'OWNER_PASSWORD'];
const missingVars = requiredVars.filter(varName => !process.env[varName] || process.env[varName].trim() === '');

if (missingVars.length > 0) {
    console.warn('⚠️ Missing or empty environment variables:', missingVars.join(', '));
    console.warn('⚠️ Using default values. Please set these variables for production use.');
}

// Log configuration status
console.log('🔧 Configuration loaded:');
console.log(`   - Environment: ${config.NODE_ENV}`);
console.log(`   - Render deployment: ${config.IS_RENDER ? 'Yes' : 'No'}`);
console.log(`   - Max restart count: ${config.MAX_RESTART_COUNT}`);
console.log(`   - Monitoring interval: ${config.MONITORING_INTERVAL}ms`);
console.log(`   - Heartbeat stale time: ${config.HEARTBEAT_STALE_TIME}ms`);
console.log(`   - Browser init timeout: ${config.BROWSER_INIT_TIMEOUT}ms`);

// Export configuration
module.exports = config;
