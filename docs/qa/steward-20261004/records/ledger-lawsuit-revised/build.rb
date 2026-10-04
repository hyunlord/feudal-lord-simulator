require 'json';require 'digest'
D=__dir__;ROOT='/Users/rexxa/fls-astra-steward';HEAD='5fb1aebfe735592c1424c947e88388d4ffe21742';MAX=9007199254740991
def put(n,v);File.write(D+'/'+n,JSON.pretty_generate(v)+"\n");end
def obj(p);{'type'=>'object','required'=>p.keys,'additionalProperties'=>false,'properties'=>p};end
def str;{'type'=>'string','minLength'=>1};end
def integer(min,max);{'type'=>'integer','minimum'=>min,'maximum'=>max};end
ref=obj({'type'=>{'const'=>'claim'},'id'=>str,'detail'=>str})
entry=obj({'id'=>str,'tick'=>integer(0,MAX),'account'=>{'const'=>'cash'},'category'=>{'const'=>'lawsuit'},'amount'=>integer(-MAX,-1),'sourceRefs'=>{'type'=>'array','minItems'=>1,'maxItems'=>1,'items'=>ref}})
schema=obj({'status'=>{'const'=>'known'},'sourceHead'=>{'const'=>HEAD},'campaignId'=>str,'entry'=>entry})
schema['$schema']='https://json-schema.org/draft/2020-12/schema';put('RAW.schema.json',schema)
texts={'filed'=>'소송을 제기하는 비용으로 금고에서 {amountAbsExact} 나갔다.','evidence'=>'소송 증거를 마련하는 비용으로 금고에서 {amountAbsExact} 나갔다.','hearing'=>'소송 심리 단계의 비용으로 금고에서 {amountAbsExact} 나갔다.','enforcing'=>'판결에 따른 점유 집행을 시도하는 비용으로 금고에서 {amountAbsExact} 나갔다.'}
put('PROPOSAL.json',{'status'=>'DRAFT_UNINSTALLED','category'=>'lawsuit','sourceHead'=>HEAD,'variants'=>texts.map{|k,t|{'id'=>'lawsuit.r06context.'+k,'phase'=>k,'text'=>t,'requiredSlots'=>['amountAbsExact'],'fallback'=>'existing lawsuit cash_out/general account selector'}}})
spans={'src/engine/estateSuits.ts'=>[[39,45],[70,96],[144,156],[172,190]],'src/content/estateConfig.ts'=>[[81,91]],'src/ledger/ledger.types.ts'=>[[53,75]],'src/ledger/ledger.ts'=>[[85,98],[115,138]],'src/engine/historyNames.ts'=>[[43,54]]}
put('SOURCE_EVIDENCE.json',spans.map{|p,ss|body=File.read(ROOT+'/'+p);{'path'=>p,'sha256'=>Digest::SHA256.hexdigest(body),'spans'=>ss.map{|a,b|{'start'=>a,'end'=>b,'text'=>body.lines[(a-1)...b].join}}}})
base='/tmp/astra-steward-r06-20261004/chronicle/variants.ko.json';put('BASELINE_REF.json',{'path'=>base,'sha256'=>Digest::SHA256.file(base).hexdigest,'modified'=>false})
