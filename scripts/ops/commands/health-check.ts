import { PrismaClient } from '../../../node_modules/.prisma/shared-kernel';
import chalk from 'chalk';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

interface HealthCheckOptions {
  verbose?: boolean;
}

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  details?: any;
}

export async function healthCheck(options: HealthCheckOptions) {
  console.log(chalk.blue('\n🏥 Running health checks...\n'));

  const services: ServiceHealth[] = [];
  
  // Check database
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;
    
    services.push({
      name: 'Database',
      status: latency < 100 ? 'healthy' : 'degraded',
      message: `Connected (${latency}ms)`,
      details: { latency },
    });
  } catch (error) {
    services.push({
      name: 'Database',
      status: 'unhealthy',
      message: 'Connection failed',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
  }

  // Check API Gateway
  try {
    const start = Date.now();
    const response = await fetch('http://localhost:3000/health', { 
      timeout: 5000,
      signal: AbortSignal.timeout(5000),
    });
    const latency = Date.now() - start;
    
    if (response.ok) {
      const data = await response.json();
      services.push({
        name: 'API Gateway',
        status: 'healthy',
        message: `Healthy (${latency}ms)`,
        details: { ...data, latency },
      });
    } else {
      services.push({
        name: 'API Gateway',
        status: 'degraded',
        message: `HTTP ${response.status}`,
        details: { status: response.status, latency },
      });
    }
  } catch (error) {
    services.push({
      name: 'API Gateway',
      status: 'unhealthy',
      message: 'Not accessible',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
  }

  // Check Frontend
  try {
    const start = Date.now();
    const response = await fetch('http://localhost:4200', {
      timeout: 5000,
      signal: AbortSignal.timeout(5000),
    });
    const latency = Date.now() - start;
    
    if (response.ok) {
      services.push({
        name: 'Frontend',
        status: 'healthy',
        message: `Accessible (${latency}ms)`,
        details: { latency },
      });
    } else {
      services.push({
        name: 'Frontend',
        status: 'degraded',
        message: `HTTP ${response.status}`,
        details: { status: response.status, latency },
      });
    }
  } catch (error) {
    services.push({
      name: 'Frontend',
      status: 'unhealthy',
      message: 'Not accessible',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
  }

  // Check Redis if configured
  if (process.env.REDIS_URL) {
    try {
      const redis = require('redis');
      const client = redis.createClient({ url: process.env.REDIS_URL });
      
      await client.connect();
      const start = Date.now();
      await client.ping();
      const latency = Date.now() - start;
      await client.quit();
      
      services.push({
        name: 'Redis',
        status: 'healthy',
        message: `Connected (${latency}ms)`,
        details: { latency },
      });
    } catch (error) {
      services.push({
        name: 'Redis',
        status: 'unhealthy',
        message: 'Connection failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
    }
  }

  // Display results
  const allHealthy = services.every(s => s.status === 'healthy');
  const hasUnhealthy = services.some(s => s.status === 'unhealthy');
  
  for (const service of services) {
    const icon = service.status === 'healthy' ? '✓' : 
                 service.status === 'degraded' ? '⚠' : '✗';
    const color = service.status === 'healthy' ? chalk.green :
                  service.status === 'degraded' ? chalk.yellow : chalk.red;
    
    console.log(color(`${icon} ${service.name}: ${service.message}`));
    
    if (options.verbose && service.details) {
      console.log(chalk.gray(`  Details: ${JSON.stringify(service.details)}`));
    }
  }

  console.log('');
  
  if (allHealthy) {
    console.log(chalk.green.bold('✅ All systems operational\n'));
  } else if (hasUnhealthy) {
    console.log(chalk.red.bold('❌ Some services are unhealthy\n'));
    process.exit(1);
  } else {
    console.log(chalk.yellow.bold('⚠️  Some services are degraded\n'));
  }

  await prisma.$disconnect();
}