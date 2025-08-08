const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateRoles() {
  try {
    // Update semua user dengan role 'USER' menjadi 'PENGHUNI'
    const result = await prisma.$runCommandRaw({
      update: "User",
      updates: [
        {
          q: { role: "USER" },
          u: { $set: { role: "PENGHUNI" } },
          multi: true
        }
      ]
    });
    
    console.log('Updated roles:', result);
  } catch (error) {
    console.error('Error updating roles:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateRoles();