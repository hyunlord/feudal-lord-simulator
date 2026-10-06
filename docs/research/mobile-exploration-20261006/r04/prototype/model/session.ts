import { BUILD_IDENTITY } from './build-identity.js';
import { advanceCity, createCity, setPolicy } from './economy.js';
import { policyPreset, RULE_VERSION, validPolicy } from './rules.js';
import { AXES, TERRAINS, type City, type Policy, type Terrain } from './types.js';
import { simulateBattle, type BattleResult, type BattleCommand } from './battle.js';
import { autoOffer, answerContract, advanceContracts, createDiplomacy, recordAvoidedRaid, type DiplomacyState } from './contracts.js';
export type SessionCommand =
 | { readonly kind:'policy'; readonly policy:Policy }
 | { readonly kind:'advance'; readonly steps:number }
 | { readonly kind:'offer' }
 | { readonly kind:'battle'; readonly mode:BattleCommand['mode']; readonly entry:BattleCommand['entry']; readonly defending:boolean };
/** Mutable local command accumulator, separate from any server authority. */
export type Session = {
 readonly seed:number; readonly terrain:Terrain; player:City; neighbor:City;
 diplomacy:DiplomacyState; battle:BattleResult|null; commands:SessionCommand[]; message:string;
};
export function createSession(seed:number,terrain:Terrain):Session {
 const neighbor=createCity(seed,terrain);setPolicy(neighbor,policyPreset(['military','faith']));
 return {seed,terrain,player:createCity(seed,terrain),neighbor,diplomacy:createDiplomacy(),battle:null,commands:[],message:''};
}
export function sessionContext(session:Session) {return {cities:{player:session.player,neighbor:session.neighbor},diplomacy:session.diplomacy,now:session.player.tick};}
export function dispatch(session:Session,command:SessionCommand):boolean {
 switch(command.kind) {
  case 'policy':
   if(!setPolicy(session.player,command.policy))return false;
   session.message='방침을 적용했습니다.';break;
  case 'advance':
   if(!Number.isSafeInteger(command.steps)||command.steps<0||command.steps>144) return false;
   for(let i=0;i<command.steps;i++){advanceCity(session.player);advanceCity(session.neighbor);advanceContracts(sessionContext(session));}
   session.message=`${session.player.tick}일 정산을 마쳤습니다.`;break;
  case 'offer':{
   const ctx=sessionContext(session),proposal=autoOffer(ctx,'player','neighbor');
   if(!proposal.ok){session.message=`지금은 교역 조건을 맞추지 못했습니다 (${proposal.reason}).`;break;}
   const response=answerContract(ctx,proposal.contract.id,true);
   session.message=response.ok?`계약 응답: ${response.contract.status}. 재고와 비용을 장부에 반영했습니다.`:response.reason;
   break;
  }
  case 'battle':{
   const ctx=sessionContext(session);
   if(recordAvoidedRaid(ctx,command.defending?'neighbor':'player',command.defending?'player':'neighbor')){session.message='불가침 계약으로 출정을 보류했습니다.';break;}
   session.battle=simulateBattle(command.defending?session.neighbor:session.player,command.defending?session.player:session.neighbor,{seed:session.seed+session.player.tick,mode:command.mode,entry:command.entry});
   session.player=command.defending?session.battle.defender:session.battle.attacker;
   session.neighbor=command.defending?session.battle.attacker:session.battle.defender;
   session.message=session.battle.reason;break;
  }
  default:return assertNever(command);
 }
 session.commands.push(structuredClone(command));return true;
}
function assertNever(value:never):never{throw new TypeError(`Unknown command ${String(value)}`);}
function object(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value);}
function parseCommand(raw:unknown):SessionCommand {
 if(!object(raw))throw new TypeError('Invalid command object');
 switch(raw['kind']) {
  case 'policy':{
   const input=raw['policy'];if(!object(input))throw new TypeError('Invalid policy');
   const policy=policyPreset([]);
   for(const axis of AXES){const v=input[axis];if(typeof v!=='number')throw new TypeError('Invalid policy value');policy[axis]=v;}
   if(!validPolicy(policy))throw new RangeError('Invalid policy budget');return {kind:'policy',policy};
  }
  case 'advance':{
   const steps=raw['steps'];if(typeof steps!=='number'||!Number.isSafeInteger(steps)||steps<0||steps>144)throw new RangeError('Invalid steps');return {kind:'advance',steps};
  }
  case 'offer':return {kind:'offer'};
  case 'battle':{
   const mode=raw['mode'],defending=raw['defending'];
   const entry=(['north','east','south','west'] as const).find(v=>v===raw['entry']);
   if((mode!=='raid'&&mode!=='siege')||!entry||typeof defending!=='boolean')throw new TypeError('Invalid battle command');
   return {kind:'battle',mode,entry,defending};
  }
  default:throw new TypeError('Unsupported command');
 }
}
async function digest(value:unknown):Promise<string>{
 const bytes=new TextEncoder().encode(JSON.stringify(value));
 const hash=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
function outcome(session:Session){return {player:session.player,neighbor:session.neighbor,diplomacy:session.diplomacy,battle:session.battle};}
export async function encodeRecording(session:Session):Promise<string>{
 const initialStateHash=await digest(outcome(createSession(session.seed,session.terrain)));
 const input={version:RULE_VERSION,identity:BUILD_IDENTITY,initialStateHash,seed:session.seed,terrain:session.terrain,commands:session.commands};
 return JSON.stringify({...input,inputHash:await digest(input),resultHash:await digest(outcome(session))});
}
export async function decodeRecording(text:string):Promise<Session>{
 const raw:unknown=JSON.parse(text);
 if(!object(raw)||raw['version']!==RULE_VERSION||typeof raw['seed']!=='number'||!Number.isSafeInteger(raw['seed'])||!Array.isArray(raw['commands'])||raw['commands'].length>10000)throw new TypeError('Invalid recording header');
 const terrain=TERRAINS.find(v=>v===raw['terrain']);if(!terrain)throw new TypeError('Invalid terrain');
 const identity=raw['identity'];
 if(!object(identity)||identity['format']!==BUILD_IDENTITY.format||identity['sourceHash']!==BUILD_IDENTITY.sourceHash||identity['rulesHash']!==BUILD_IDENTITY.rulesHash||identity['contentHash']!==BUILD_IDENTITY.contentHash)throw new TypeError('Recording build identity mismatch');
 const commands=raw['commands'].map(parseCommand);
 const session=createSession(raw['seed'],terrain);
 const initialStateHash=await digest(outcome(session));
 if(initialStateHash!==raw['initialStateHash'])throw new TypeError('Recording initial state mismatch');
 const input={version:RULE_VERSION,identity:BUILD_IDENTITY,initialStateHash,seed:raw['seed'],terrain,commands};
 if(await digest(input)!==raw['inputHash'])throw new TypeError('Recording inputs were changed');
 for(const command of commands)if(!dispatch(session,command))throw new TypeError('Recording command rejected');
 if(await digest(outcome(session))!==raw['resultHash'])throw new TypeError('Recording result mismatch');
 return session;
}
