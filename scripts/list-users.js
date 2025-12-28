/**
 * Script to list all users in the database
 */

require('dotenv').config({ path: './env/dev.env' });
const mongoose = require('mongoose');

const MONGO_DB_CONNECTION_STRING = process.env.MONGO_DB_CONNECTION_STRING;

const UserSchema = new mongoose.Schema({
  email: String,
  password: String,
  firstName: String,
  lastName: String,
  role: String,
  dateOfBirth: Date,
  emailVerified: Boolean,
  emailVerificationToken: String,
}, { timestamps: true });

async function listUsers() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_DB_CONNECTION_STRING);
    console.log('✅ Connected to MongoDB\n');

    const User = mongoose.model('User', UserSchema);
    const users = await User.find().select('email firstName lastName role emailVerified createdAt').lean();

    if (users.length === 0) {
      console.log('📭 No users found in the database');
      console.log('\nCreate your first user by registering at:');
      console.log('   POST http://localhost:3002/auth/register');
    } else {
      console.log(`📋 Found ${users.length} user(s):\n`);
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email}`);
        console.log(`   Name: ${user.firstName || ''} ${user.lastName || ''}`);
        console.log(`   Role: ${user.role || 'user'}`);
        console.log(`   Verified: ${user.emailVerified ? 'Yes' : 'No'}`);
        console.log(`   Created: ${user.createdAt || 'N/A'}`);
        console.log('');
      });
      
      console.log('\nTo set a user as super admin, run:');
      console.log('   node scripts/set-super-admin.js <email>');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

listUsers();
