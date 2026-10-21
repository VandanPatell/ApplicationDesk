import mongoose from 'mongoose';
import { app, Job, Template, Settings } from './app.js';
import {initializeDefaults} from './defaults.js';
import {SentEmail} from './mail.js';
import {initializeProfileLinks} from './profile-links.js';
try {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/application-desk');
  await initializeDefaults(Template,Settings);
  await initializeProfileLinks(Template,Settings);
  await SentEmail.init();
  await Job.init();
  app.listen(process.env.PORT || 4000,()=>console.log('Application Desk API ready'));
} catch(error) { console.error('MongoDB connection failed:',error.message); process.exit(1); }
