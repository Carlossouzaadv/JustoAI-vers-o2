// Jest setup file for global configurations
import { jest } from '@jest/globals';

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
};

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';