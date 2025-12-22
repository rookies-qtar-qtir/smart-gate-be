const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateRoles() {
  try {
    const result = await prisma.$runCommandRaw({
      update: "User",
      updates: [
        {
          q: { role: "ADMIN" },
          u: { $set: { role: "OPERATOR" } },
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