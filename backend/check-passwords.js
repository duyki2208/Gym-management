const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI;

const testPasswords = ['123456', '12345678', 'admin', 'staff', 'manager', 'pt', 'HaiHung', 'JOHNFILLER', 'HUNGDUY', 'ANHTHO', 'PT'];

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected!');

    const users = await User.find({});
    console.log(`Found ${users.length} users in database.`);

    for (const user of users) {
      let matchedPass = null;
      for (const pass of testPasswords) {
        const isMatch = await bcrypt.compare(pass, user.password);
        if (isMatch) {
          matchedPass = pass;
          break;
        }
      }

      if (matchedPass) {
        console.log(`User: ${user.username} (${user.role}) - Password matches: "${matchedPass}"`);
      } else {
        console.log(`User: ${user.username} (${user.role}) - Password unknown, resetting to "123456"...`);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('123456', salt);
        user.password = hashedPassword;
        await user.save();
        console.log(`-> Reset successfully to "123456"`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected!');
  }
}

run();
