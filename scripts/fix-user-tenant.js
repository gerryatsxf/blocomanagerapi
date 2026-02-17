const mongoose = require('mongoose');
require('dotenv').config({ path: './env/dev.env' });

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  role: String,
  tenant: String,
  firstName: String,
  lastName: String,
  emailVerified: Boolean,
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function createDuplicateUser() {
  try {
    const mongoUrl = process.env.MONGODB_URI || 'mongodb://admin_root:admin_root@localhost:27020/blocomanager?authSource=admin';
    await mongoose.connect(mongoUrl);
    console.log('Connected to MongoDB');
    
    const email = 'test.lps.emails@gmail.com';
    const newTenant = 'blocomanager';
    
    // Find existing user
    const existingUser = await User.findOne({ email });
    
    if (!existingUser) {
      console.log(`❌ User not found: ${email}`);
      process.exit(1);
    }
    
    console.log(`\nExisting user:`);
    console.log(`  Email: ${existingUser.email}`);
    console.log(`  Tenant: ${existingUser.tenant}`);
    console.log(`  Role: ${existingUser.role}`);
    
    // Check if user already exists for blocomanager tenant
    const blocomanagerUser = await User.findOne({ email, tenant: newTenant });
    
    if (blocomanagerUser) {
      console.log(`\n✅ User already exists for tenant ${newTenant}`);
      process.exit(0);
    }
    
    console.log(`\n📝 Creating duplicate user for tenant: ${newTenant}`);
    
    // Create new user with same credentials but different tenant
    const newUser = new User({
      email: existingUser.email,
      password: existingUser.password, // Same password hash
      role: existingUser.role,
      tenant: newTenant,
      firstName: existingUser.firstName,
      lastName: existingUser.lastName,
      emailVerified: existingUser.emailVerified,
    });
    
    await newUser.save();
    
    console.log(`✅ Created duplicate user successfully!`);
    console.log(`\nNew user details:`);
    console.log(`  Email: ${newUser.email}`);
    console.log(`  Tenant: ${newUser.tenant}`);
    console.log(`  Role: ${newUser.role}`);
    console.log(`\n📌 Now ${email} can log into both tenants:`);
    console.log(`  - ${existingUser.tenant}`);
    console.log(`  - ${newTenant}`);
    
    await mongoose.disconnect();
    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

createDuplicateUser();
