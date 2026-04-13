/**
 * Script to set a user as Platform Owner
 * 
 * Usage:
 *   node scripts/set-platform-owner.js <email>
 * 
 * Example:
 *   node scripts/set-platform-owner.js your@email.com
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

async function setPlatformOwner(email) {
  if (!email) {
    console.error('❌ Error: Email is required');
    console.log('Usage: node scripts/set-platform-owner.js <email>');
    process.exit(1);
  }

  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_DB_CONNECTION_STRING);
    console.log('✅ Connected to MongoDB');

    const User = mongoose.model('User', UserSchema);

    const user = await User.findOne({ email });

    if (!user) {
      console.error(`❌ User with email "${email}" not found`);
      process.exit(1);
    }

    console.log(`\n👤 User found:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Current Role: ${user.role || 'user'}`);
    console.log(`   Name: ${user.firstName || ''} ${user.lastName || ''}`);

    if (user.role === 'platformOwner') {
      console.log('\n✅ User is already a Platform Owner!');
    } else {
      user.role = 'platformOwner';
      await user.save();
      console.log('\n✅ User role updated to Platform Owner!');
    }

    console.log('\n🎉 Success! You can now login to the admin panel at:');
    console.log('   https://admin.blocomanager.com/admin/panel');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Get email from command line arguments
const email = process.argv[2];
setPlatformOwner(email);
