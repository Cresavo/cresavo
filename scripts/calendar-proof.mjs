import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {DateTime} from 'luxon';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
const work=JSON.parse(readFileSync('docs/archive/calendar-proof/work.json'));
const personal=JSON.parse(readFileSync('docs/archive/calendar-proof/private.json'));
const client=new Client({name:'calendar-case-check',version:'1'});
const transcript=[];
await client.connect(new StdioClientTransport({command:process.execPath,args:['--import','tsx','.vercel/calendar-mcp.ts']}));
async function call(name,args){const result=await client.callTool({name,arguments:args});assert(!result.isError);transcript.push({name,args,result});return JSON.parse(result.content[0].text);}
try {
 assert.deepEqual((await client.listTools()).tools.map(t=>t.name).sort(),['get_availability','list_services']);
 const service=(await call('list_services',{})).find(s=>s.id==='massage');
 const slots=[];
 for(let d=16;d<=20;d++)slots.push(...await call('get_availability',{serviceId:'massage',staffId:'staff-demo',date:`2026-11-${d}`}));
 function compare(calendars){return slots.filter(start=>{const s=Date.parse(start),e=s+service.duration*60000;if(DateTime.fromISO(start).setZone('Europe/Stockholm').hour<16)return false;return calendars.every(c=>s>=Date.parse(c.coverageStart)&&e<=Date.parse(c.coverageEnd)&&c.busy.every(b=>!(s<Date.parse(b.end)&&e>Date.parse(b.start))));});}
 const one=compare([work,personal]);assert.deepEqual(one,['2026-11-17T15:30:00.000Z']);
 const relaxed={...personal,busy:personal.busy.filter(b=>!b.start.startsWith('2026-11-18'))};
 const two=compare([work,relaxed]);assert.deepEqual(two,['2026-11-17T15:30:00.000Z','2026-11-18T15:00:00.000Z']);
 const blocked={...personal,busy:[{start:personal.coverageStart,end:personal.coverageEnd}]};assert.deepEqual(compare([work,blocked]),[]);
 assert.equal(DateTime.fromISO('2026-03-29T01:30:00Z').setZone('Europe/Stockholm').toFormat('HH:mm ZZ'),'03:30 +02:00');
 assert.equal(DateTime.fromISO('2026-10-25T01:30:00Z').setZone('Europe/Stockholm').toFormat('HH:mm ZZ'),'02:30 +01:00');
 const result={kind:'Deterministic SDK test, NOT direct Codex MCP agent test',productRevision:'7c1407d',cases:{one,two,none:[],dst:'PASS',readOnlyCatalog:'PASS'},transcript};
 writeFileSync('docs/archive/calendar-proof/sdk-results.json',JSON.stringify(result,null,2)+'\n');
 console.log('PASS: read-only catalog, one match, two matches, no match, spring DST, autumn DST');
}finally{await client.close();}
