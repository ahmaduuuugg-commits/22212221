// Keepalive script to prevent server from sleeping
const https = require('https');
const http = require('http');

class KeepAlive {
    constructor(url, interval = 300000) { // 5 minutes default
        this.url = url;
        this.interval = interval;
        this.timer = null;
        this.isRunning = false;
    }

    start() {
        if (this.isRunning) {
            console.log('KeepAlive is already running');
            return;
        }

        this.isRunning = true;
        console.log(`KeepAlive started for ${this.url} with ${this.interval}ms interval`);
        
        this.timer = setInterval(() => {
            this.ping();
        }, this.interval);

        // Initial ping
        this.ping();
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.isRunning = false;
        console.log('KeepAlive stopped');
    }

    ping() {
        const protocol = this.url.startsWith('https') ? https : http;
        
        const startTime = Date.now();
        
        protocol.get(this.url, (res) => {
            const responseTime = Date.now() - startTime;
            console.log(`KeepAlive ping: ${res.statusCode} (${responseTime}ms)`);
        }).on('error', (error) => {
            console.error('KeepAlive ping failed:', error.message);
        });
    }
}

module.exports = KeepAlive;

// Self-ping if this file is run directly
if (require.main === module) {
    const port = process.env.PORT || 5000;
    const url = process.env.KEEPALIVE_URL || `http://localhost:${port}/health`;
    
    const keepAlive = new KeepAlive(url);
    keepAlive.start();
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('Shutting down KeepAlive...');
        keepAlive.stop();
        process.exit(0);
    });
}
