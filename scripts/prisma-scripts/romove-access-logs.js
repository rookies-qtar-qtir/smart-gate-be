const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteAllAccessLogs() {
    console.log("Deleting all data in access_logs...");
    const result = await prisma.accessLog.deleteMany({});
    console.log(`Deleted ${result.count} documents`);
}

async function main() {
    try {
        await deleteAllAccessLogs();
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
