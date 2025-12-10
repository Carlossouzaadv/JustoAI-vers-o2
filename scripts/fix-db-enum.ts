import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Attempting to clean up Plan_old type...');

    try {
        // 1. Check usage (optional, just logging)
        // 2. Force drop
        await prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS "Plan_old" CASCADE;`);
        console.log('Successfully dropped "Plan_old" (CASCADE).');
    } catch (e) {
        console.error('Error dropping Plan_old:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
