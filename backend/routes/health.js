const router = require('express').Router();
const prisma = require('../utils/prisma')

router.get('/', async (req, res) => {
    const startTime = Date.now();
    const healthCheck = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
            database: { status: 'unhealthy', latency: 0 },
            authentication: { status: 'unhealthy' },
            memory: {
                status: 'healthy',
                usage: { used: 0, total: 0, percentage: 0 }
            }
        },
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    };
    try {
        const dbStart = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        healthCheck.services.database.latency = Date.now() - dbStart;
        healthCheck.services.database.status = 'healthy';
    } catch (error) {
        healthCheck.services.database.status = 'unhealthy';
        healthCheck.services.database.details =
            error instanceof Error ? error.message : 'Database connection failed';
        healthCheck.status = 'unhealthy';
    }
    try {
        if (process.env.BETTER_AUTH_SECRET && process.env.BETTER_AUTH_URL) {
            healthCheck.services.authentication.status = 'healthy';
        } else {
            healthCheck.services.authentication.status = 'unhealthy';
            healthCheck.services.authentication.details =
                'Missing auth environment variables';
            healthCheck.status = 'degraded';
        }
    } catch (error) {
        healthCheck.services.authentication.status = 'unhealthy';
        healthCheck.services.authentication.details =
            error instanceof Error ? error.message : 'Auth service check failed';
        healthCheck.status = 'degraded';
    }
    try {
        const memoryUsage = process.memoryUsage();
        const used = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        const total = Math.round(memoryUsage.heapTotal / 1024 / 1024);
        const percentage = Math.round((used / total) * 100);

        healthCheck.services.memory.usage = { used, total, percentage };

        if (percentage > 90) {
            healthCheck.services.memory.status = 'unhealthy';
            healthCheck.status = 'degraded';
        }
    } catch (error) {
        healthCheck.services.memory.status = 'unhealthy';
        healthCheck.status = 'degraded';
    }
    if (healthCheck.services.database.status === 'unhealthy') {
        healthCheck.status = 'unhealthy';
    }

    const responseTime = Date.now() - startTime;

    const statusCode =
        healthCheck.status === 'healthy'
            ? 200
            : healthCheck.status === 'degraded'
                ? 200
                : 503;

    res.status(statusCode).json({
        ...healthCheck,
        responseTime: `${responseTime}ms`
    });

})

module.exports = router;