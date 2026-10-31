import crypto from 'node:crypto';
import readline from 'node:readline/promises';
const reader=readline.createInterface({input:process.stdin,output:process.stdout});
try{const password=await reader.question('Choose a workspace password: ');if(password.length<10)throw Error('Use at least 10 characters.');const confirm=await reader.question('Repeat password: ');if(password!==confirm)throw Error('Passwords did not match.');const salt=crypto.randomBytes(16).toString('hex');console.log('APP_PASSWORD_HASH=scrypt$'+salt+'$'+crypto.scryptSync(password,salt,32).toString('hex'));console.log('APP_SESSION_SECRET='+crypto.randomBytes(32).toString('hex'));}finally{reader.close();}
