const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function renameInUser() {
    return prisma.$runCommandRaw({
        update: "User",
        updates: [
            {
                q: { uid: { $exists: true } },
                u: {
                    $rename: {
                        uid: "pid"
                    }
                },
                multi: true
            }
        ]
    });
}

async function renameInAccessLogs() {
    return prisma.$runCommandRaw({
        update: "access_logs",
        updates: [
            {
                q: { uid: { $exists: true } },
                u: {
                    $rename: {
                        uid: "pid"
                    }
                },
                multi: true
            }
        ]
    });
}

async function main() {
    try {
        console.log("Renaming uid -> pid in User...");
        const userResult = await renameInUser();
        console.log("Done User:", userResult);

        console.log("Renaming uid -> pid in access_logs...");
        const logsResult = await renameInAccessLogs();
        console.log("Done access_logs:", logsResult);

    } catch (err) {
        console.error("Error renaming uid to pid:", err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
