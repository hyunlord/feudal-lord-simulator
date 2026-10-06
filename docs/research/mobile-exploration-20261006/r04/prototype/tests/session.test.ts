import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, dispatch, encodeRecording, decodeRecording } from '../model/session.js';
import { policyPreset } from '../model/rules.js';
test('saved command recording reproduces policy, trade, spatial battle and continuation',async()=>{
 const first=createSession(2,'forest');
 dispatch(first,{kind:'policy',policy:policyPreset(['craft','agriculture'])});dispatch(first,{kind:'advance',steps:48});
 dispatch(first,{kind:'offer'});dispatch(first,{kind:'advance',steps:3});dispatch(first,{kind:'battle',mode:'raid',entry:'east',defending:false});
 const second=await decodeRecording(await encodeRecording(first));assert.deepEqual(second,first);
 dispatch(first,{kind:'advance',steps:12});dispatch(second,{kind:'advance',steps:12});assert.deepEqual(second,first);
});
test('recording rejects changed input, initial seed and claimed result',async()=>{
 const s=createSession(1,'river');dispatch(s,{kind:'advance',steps:12});const text=await encodeRecording(s);
 await assert.rejects(()=>decodeRecording(text.replace('"steps":12','"steps":13')),/inputs were changed/);
 await assert.rejects(()=>decodeRecording(text.replace('"seed":1','"seed":2')),/initial state mismatch/);
 await assert.rejects(()=>decodeRecording(text.replace('"resultHash":"','"resultHash":"0')),/result mismatch/);
});
test('recording binds actual compiled simulation source identity',async()=>{
 // Given a current recording; When a foreign source or content identity is substituted; Then replay refuses before execution.
 const text=await encodeRecording(createSession(1,'river'));
 assert.match(text,/"sourceHash":"[a-f0-9]{64}"/);
 await assert.rejects(()=>decodeRecording(text.replace(/"sourceHash":"[a-f0-9]{64}"/,'"sourceHash":"foreign-build"')),/identity mismatch/);
 await assert.rejects(()=>decodeRecording(text.replace(/"contentHash":"[a-f0-9]{64}"/,'"contentHash":"foreign-content"')),/identity mismatch/);
});
test('recording refuses substituted rules and initial-state identities',async()=>{
 // Given a recording; When either rules or initial state identity is substituted; Then replay rejects the mismatch.
 const text=await encodeRecording(createSession(1,'river'));
 await assert.rejects(()=>decodeRecording(text.replace(/"rulesHash":"[a-f0-9]{64}"/,'"rulesHash":"foreign-rules"')),/identity mismatch/);
 await assert.rejects(()=>decodeRecording(text.replace(/"initialStateHash":"[a-f0-9]{64}"/,'"initialStateHash":"foreign-state"')),/initial state mismatch/);
});
