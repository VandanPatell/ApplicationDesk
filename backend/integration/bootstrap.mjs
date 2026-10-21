import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import {Template,Settings} from '../src/app.js';
import {initializeDefaults,defaultTemplates} from '../src/defaults.js';
import {initializeProfileLinks} from '../src/profile-links.js';
await mongoose.connect(process.env.MONGO_URI||'mongodb://mongo:27017/application-desk',{dbName:'app-bootstrap-test-'+crypto.randomUUID()});
try{
 await initializeDefaults(Template,Settings);await initializeProfileLinks(Template,Settings);
 assert.equal(await Template.countDocuments(),defaultTemplates.length);
 let profile=await Settings.findById('profile');assert.ok([...profile.variables.values()].every(value=>value===''));
 const first=await Template.findOne();await Template.updateOne({_id:first._id},{body:'My edited template'});
 await Settings.updateOne({_id:'profile'},{$set:{'variables.candidate-name':'Example Candidate','variables.portfolio-url':'https://example.com/me'}});
 await initializeDefaults(Template,Settings);await initializeProfileLinks(Template,Settings);
 assert.equal(await Template.countDocuments(),defaultTemplates.length);assert.equal((await Template.findById(first._id)).body,'My edited template');
 assert.equal((await Settings.findById('profile')).variables.get('portfolio-url'),'https://example.com/me');
 // A workspace created before public starter templates must retain its data.
 await Template.deleteMany({});await Settings.deleteMany({});
 await Settings.create({_id:'profile',resumeDefaultsVersion:'vandan-v1',profileLinksVersion:'vandan-links-v1',variables:{'candidate-name':'Existing Candidate','portfolio-url':'https://example.com/existing'}});
 await Template.create({name:'Existing personal template',body:'Keep this exact text'});
 await initializeDefaults(Template,Settings);await initializeProfileLinks(Template,Settings);
 assert.equal(await Template.countDocuments(),1);assert.equal((await Template.findOne()).body,'Keep this exact text');
 profile=await Settings.findById('profile');assert.equal(profile.variables.get('candidate-name'),'Existing Candidate');assert.equal(profile.variables.get('portfolio-url'),'https://example.com/existing');
 console.log('PASS: generic fresh-install templates, blank profile values, idempotent initialization, preserved edits, and unchanged legacy workspace.');
}finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();console.log('Disposable bootstrap test database removed.');}
