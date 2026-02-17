const mongoose = require('mongoose');

// User schema
const userSchema = new mongoose.Schema({
  email: String,
  tenant: String,
  role: String,
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function checkUser() {
  try {
    await mongoose.connect('mongodb://localhost/blocomanager');
    console.log('Connected to MongoDB');
    
    const users = await User.find({ email: 'test.lps.emails@gmail.com' });
    console.log('\nFound users:');
    users.forEach(user => {
      console.log(`  - Email: ${user.email}, Tenant: ${user.tenant}, Role: ${user.role}`);
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkUser();
