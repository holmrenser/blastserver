import { PrismaClient } from '@prisma/client';

declare global {
  var prisma: PrismaClient
}

let prisma: PrismaClient;

const prismaConfig = {
  errorFormat: 'pretty',
  // log: ['query', 'info', 'warn', 'error']
  log: ['info', 'warn', 'error']
} as any;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient(prismaConfig);
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient(prismaConfig);
  }
  prisma = global.prisma
}

export default prisma;