/**
 * Migration: Rename superAdmin → platformOwner
 * 
 * This script migrates all users with role 'superAdmin' to 'platformOwner'
 * as part of the platform-tenant separation refactor.
 * 
 * Usage:
 *   node scripts/migrate-platform-roles.js
 *   
 *   # With specific env file:
 *   NODE_ENV=production node scripts/migrate-platform-roles.js
 * 
 * What it does:
 *   1. Updates all users with role 'superAdmin' → 'platformOwner'
 *   2. Reports how many records were modified
 */

const envFile = process.env.NODE_ENV === 'production' 
  ? './env/prod.env' 
  : process.env.NODE_ENV === 'qa' 
    ? './env/qa.env' 
    : './env/dev.env';

require('dotenv').config({ path: envFile });
const mongoose = require('mongoose');

const MONGO_DB_CONNECTION_STRING = process.env.MONGO_DB_CONNECTION_STRING;

async function migratePlatformRoles() {
  try {
    console.log(`🔌 Connecting to MongoDB using env: ${envFile}...`);
    await mongoose.connect(MONGO_DB_CONNECTION_STRING);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Check current state
    const superAdmins = await usersCollection.find({ role: 'superAdmin' }).toArray();
    const platformOwners = await usersCollection.find({ role: 'platformOwner' }).toArray();
    
    console.log(`\n📊 Current state:`);
    console.log(`   Users with role 'superAdmin': ${superAdmins.length}`);
    console.log(`   Users with role 'platformOwner': ${platformOwners.length}`);

    if (superAdmins.length === 0) {
      console.log('\n✅ No users with superAdmin role found. Migration already complete or not needed.');
      return;
    }

    console.log(`\n👤 Users to migrate:`);
    superAdmins.forEach(u => {
      console.log(`   - ${u.email} (${u.firstName || ''} ${u.lastName || ''})`);
    });

    // Perform migration
    const result = await usersCollection.updateMany(
      { role: 'superAdmin' },
      { $set: { role: 'platformOwner' } }
    );

    console.log(`\n✅ Migration complete!`);
    console.log(`   Matched: ${result.matchedCount}`);
    console.log(`   Modified: ${result.modifiedCount}`);

    // Verify
    const remaining = await usersCollection.countDocuments({ role: 'superAdmin' });
    const newOwners = await usersCollection.countDocuments({ role: 'platformOwner' });
    console.log(`\n📊 After migration:`);
    console.log(`   Users with role 'superAdmin': ${remaining}`);
    console.log(`   Users with role 'platformOwner': ${newOwners}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

migratePlatformRoles();
