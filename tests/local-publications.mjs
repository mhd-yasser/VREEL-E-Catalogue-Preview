import assert from 'node:assert/strict';
import {isLocalPublication,publishLocal,asLocalDraft} from '../local-publications.js';
const blob=new Blob(['model']),draft={name:'BARI',model:{blob},groups:[{name:'Color'}]},old={id:'catalogue:orka-bari',draft,published:structuredClone(draft)};
assert(!isLocalPublication(old));assert.equal(old.published.name,'BARI');assert.equal(old.draft.model.blob,blob);
publishLocal(old,draft,'2026-10-14T12:00:00Z');assert(isLocalPublication(old));draft.name='Edited';assert.equal(old.published.name,'BARI');
const imported=asLocalDraft(structuredClone(old));assert(!isLocalPublication(imported));assert.equal(imported.published,null);assert.equal(imported.draft.name,'Edited');assert.equal(await imported.draft.model.blob.text(),'model');
publishLocal(imported,imported.draft);assert(isLocalPublication(imported));
console.log('PASS: old/seeded publications do not appear; drafts/files retained; only explicit republishing enters the client-demo gallery; imported copies start as drafts.');
