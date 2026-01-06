const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

function toCSV(data) {
    if (!data.length) return '';

    const headers = Object.keys(data[0]).join(',');

    const rows = data.map(row =>
        Object.values(row)
            .map(value => {
                if (value === null || value === undefined) return '';
                if (value instanceof Date) return `"${value.toISOString()}"`;
                if (typeof value === 'object') return `"${JSON.stringify(value)}"`;
                return `"${String(value).replace(/"/g, '""')}"`;
            })
            .join(',')
    );

    return [headers, ...rows].join('\n');
}

async function exportAccessLogsToCSV() {
    console.log("Fetching access_logs data...");

    const logs = await prisma.accessLog.findMany();

    if (logs.length === 0) {
        console.log("No data found in access_logs");
        return;
    }

    const csv = toCSV(logs);
    const filePath = path.join(__dirname, 'access_logs.csv');

    fs.writeFileSync(filePath, csv, 'utf8');

    console.log(`CSV file created: ${filePath}`);
}

async function main() {
    try {
        await exportAccessLogsToCSV();
    } catch (err) {
        console.error("Error exporting access_logs:", err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
