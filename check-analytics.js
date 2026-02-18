/**
 * Quick diagnostic script for analytics
 * Run this in your terminal: node check-analytics.js
 */

// Set your database connection
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in environment');
  console.log('Run: export DATABASE_URL="your-database-url"');
  process.exit(1);
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAnalytics() {
  try {
    console.log('🔍 Checking analytics setup...\n');

    // Get all timers
    const timers = await prisma.timer.findMany({
      select: {
        id: true,
        shop: true,
        name: true,
        status: true,
        type: true,
        impressions: true,
        clicks: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (timers.length === 0) {
      console.log('❌ No timers found in database');
      return;
    }

    console.log(`✅ Found ${timers.length} timer(s)\n`);

    timers.forEach((timer, index) => {
      console.log(`Timer ${index + 1}:`);
      console.log(`  ID: ${timer.id}`);
      console.log(`  Name: ${timer.name}`);
      console.log(`  Shop: ${timer.shop}`);
      console.log(`  Status: ${timer.status}`);
      console.log(`  Type: ${timer.type}`);
      console.log(`  Impressions: ${timer.impressions}`);
      console.log(`  Clicks: ${timer.clicks}`);
      console.log(`  Last Updated: ${timer.updatedAt.toISOString()}`);
      console.log('');
    });

    // Check for active timers with zero analytics
    const activeWithZero = timers.filter(
      t => t.status === 'ACTIVE' && t.impressions === 0 && t.clicks === 0
    );

    if (activeWithZero.length > 0) {
      console.log(`⚠️  ${activeWithZero.length} active timer(s) with zero analytics:`);
      activeWithZero.forEach(timer => {
        console.log(`  - ${timer.name} (${timer.id})`);
      });
      console.log('\nThis suggests analytics tracking is not reaching the database.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAnalytics();
