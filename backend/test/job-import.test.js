import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import request from 'supertest';
import {app} from '../src/app.js';
import {parseJobWorkbook,parseImportDate,normalizeImportRow,classifyRows,duplicateKeys} from '../src/job-import.js';
test('Excel rows normalize status, tags, reply flags, dates, remote roles, and missing values',()=>{
 const row=normalizeImportRow({company:' Example ',role:'Backend',workMode:'remote',status:'applied',replied:'YES',tags:'Node.js; MongoDB, Node.js',appliedAt:'2026-10-20'});
 assert.equal(row.company,'Example');assert.equal(row.workMode,'Remote');assert.equal(row.status,'Applied');assert.equal(row.replied,true);assert.deepEqual(row.tags,['Node.js','MongoDB']);assert.equal(row.appliedAt,'2026-10-20');assert.equal(row.followUpAt,null);
 const blank=normalizeImportRow({company:'X',role:'Y'});assert.equal(blank.status,'Saved');assert.equal(blank.appliedAt,null);assert.equal(blank.replied,false);
 assert.throws(()=>normalizeImportRow({company:'X',role:'Y',workMode:'Hybrid'}),/City/);
 assert.throws(()=>normalizeImportRow({company:'X',role:'Y',email:'invalid'}),/email/);
 assert.throws(()=>normalizeImportRow({company:'X',role:'Y',replied:'maybe'}),/Replied/);
 assert.throws(()=>normalizeImportRow({company:'X',role:'Y',status:'invented'}),/Status/);
});
test('Excel dates support both date systems and reject ambiguous or impossible text dates',()=>{
 assert.equal(parseImportDate(1,'date'),'1900-01-01');assert.equal(parseImportDate(0,'date',true),'1904-01-01');
 assert.equal(parseImportDate(new Date('2026-10-21T00:00:00Z'),'date'),'2026-10-21');
 assert.throws(()=>parseImportDate('2026-02-30','date'),/invalid calendar/);assert.throws(()=>parseImportDate('21/10/2026','date'),/YYYY-MM-DD/);
});
test('duplicates are detected by normalized posting URLs and company/role/location/arrangement without blocking distinct roles',()=>{
 const job={company:'Acme',role:'Developer',location:'Pune',workMode:'Hybrid',url:'https://example.com/job?id=1&utm_source=linkedin#details'};
 assert.ok(duplicateKeys(job).includes('url:https://example.com/job?id=1'));
 const rows=classifyRows([{rowNumber:2,data:{...job,company:'  ACME '},errors:[]},{rowNumber:3,data:{company:'Other',role:'X',url:'https://example.com/job?id=1'},errors:[]},{rowNumber:4,data:{...job,role:'QA',url:''},errors:[]}],[job]);
 assert.deepEqual(rows.map(r=>r.state),['duplicate','duplicate','ready']);
});
test('real .xlsx parsing preserves Excel row numbers, rejects formula cells, and validates calendar dates',async()=>{
 const parsed=await parseJobWorkbook(await readFile(new URL('../integration/fixtures/job-import.xlsx',import.meta.url)));
 const rows=classifyRows(parsed.rows);assert.equal(parsed.sheetName,'Applications');assert.deepEqual(rows.map(r=>r.state),['ready','duplicate','invalid','ready','invalid','invalid']);
 assert.equal(rows[0].rowNumber,2);assert.equal(rows[0].data.appliedAt,'2026-10-20');assert.match(rows[2].errors[0],/City/);assert.match(rows[4].errors[0],/calendar/);assert.match(rows[5].errors[0],/Formula/);
 await assert.rejects(()=>parseJobWorkbook(Buffer.from('not an excel file')),/Unable to read/);
 await assert.rejects(async()=>parseJobWorkbook(await readFile(new URL('../assets/job-import-template.xlsx',import.meta.url))),/No application rows/);
});
test('import endpoints reject cross-origin requests, missing uploads, and invalid row selections',async()=>{
 await request(app).post('/api/job-import/preview').expect(403);
 await request(app).post('/api/job-import/preview').set('X-Requested-With','ApplicationDesk').expect(400);
 await request(app).post('/api/job-import/commit').set('X-Requested-With','ApplicationDesk').send({batchId:'invalid',selectedRows:[2]}).expect(400);
 await request(app).post('/api/job-import/preview').set('X-Requested-With','ApplicationDesk').set('Origin','https://untrusted.example').expect(403);
});
