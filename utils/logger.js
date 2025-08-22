const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Configure Winston logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'haxball-tournament' },
    transports: [
        // Write all logs with level 'error' and below to error.log
        new winston.transports.File({ 
            filename: path.join(logsDir, 'error.log'), 
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        
        // Write all logs with level 'info' and below to combined.log
        new winston.transports.File({ 
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
});

// If we're not in production, log to the console as well
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf(({ level, message, timestamp, ...meta }) => {
                const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
                return `${timestamp} [${level}]: ${message} ${metaString}`;
            })
        )
    }));
} else {
    // In production, also log to console but with simpler format
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.simple(),
            winston.format.printf(({ level, message, timestamp }) => {
                return `${timestamp} [${level.toUpperCase()}]: ${message}`;
            })
        )
    }));
}

// Add custom methods for specific log types
logger.haxball = (message, data = {}) => {
    logger.info(`[HAXBALL] ${message}`, { type: 'haxball', ...data });
};

logger.puppeteer = (message, data = {}) => {
    logger.info(`[PUPPETEER] ${message}`, { type: 'puppeteer', ...data });
};

logger.discord = (message, data = {}) => {
    logger.info(`[DISCORD] ${message}`, { type: 'discord', ...data });
};

logger.room = (message, data = {}) => {
    logger.info(`[ROOM] ${message}`, { type: 'room', ...data });
};

module.exports = logger;
