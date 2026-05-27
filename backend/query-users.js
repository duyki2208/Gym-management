const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI;

async function run() {
  try {
    console.log('Connecting to', MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log('Connected!');
    const users = await User.find({}, 'username role fullName').lean();
    console.log('--- USERS IN DATABASE ---');
    console.log(JSON.stringify(users, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
