require 'json';require 'digest'
p=__dir__;write=lambda{|f,o|File.write(p+'/'+f,JSON.pretty_generate(o)+"\n")}
rows=[
 ['milestone.chapter_start','second','params','chapter','eq',2,'最初の章を経て、第二章が始まった。'],
 ['milestone.chapter_start','last','params','chapter','eq',5,'가문의 마지막 장이 시작되었다.'],
 ['milestone.chapter_end','first','params','chapter','eq',1,'도시가 거쳐 온 첫 장의 기록을 마쳤다.'],
 ['milestone.chapter_end','last','params','chapter','eq',5,'다음 장을 열지 않고 가문의 마지막 장을 마쳤다.'],
 ['milestone.market_town','market','capture','era','eq','market_town','시장도시 단계에서 도시의 이정표가 기록되었다.'],
 ['milestone.market_town','stone','capture','era','eq','stone_town','석벽 도시 단계에서 시장도시 이정표가 기록되었다.'],
 ['milestone.first_l4','one','capture','l4Count','eq',1,'도시 대가옥 한 채가 처음 이정표에 올랐다.'],
 ['milestone.first_l4','several','capture','l4Count','gt',1,'도시 대가옥 여러 채가 있는 때에 첫 이정표가 기록되었다.'],
 ['person.grew','two','params','residents','eq',2,'식구가 늘어 두 사람이 한집에 살게 되었다.'],
 ['person.grew','several','params','residents','gt',2,'식구가 늘어 세 사람 이상이 한집에 살게 되었다.']]
rows[0][6]='첫 장을 지나 두 번째 장이 시작되었다.'
a=rows.map{|t,k,axis,f,op,v,h|{id:t+'.r06stage.'+k,template:t,axis:axis,field:f,op:op,value:v,headline:h,retainFactLine:true,requiredSlots:[],status:axis=='capture'?'BLOCKED_NEW_CAPTURE_FIELD':'BLOCKED_TYPED_INPUT_GUARD'}}
write.call('ADDITIONS.json',{formatVersion:1,status:'DRAFT_NOT_CANONICAL',variants:a})
write.call('COVERAGE.json',{requestedTypes:8,newVariants:10,coveredTypes:5,notDrafted:[{template:'milestone.stone_town',reason:'No raw params. Emitter only proves era stone_town. Arbitrary city count/wealth splits would add unrelated decoration; need meaningful recorded transition cause first.'},{template:'ledger.l4',reason:'Legacy copy retained, current producer not found. Do not conflate with monetary ledger category; from/to compare and trustworthy producer require separate contract.'},{template:'person.came_of_age',reason:'Record emitted for crossing fixed14. No meaningful age branching; prior occupation/current role cannot be projected backward. No new fields invented solely for count.'}],legacyProducer:'person.grew only when after.persons is undefined; no birth or immigration cause asserted'})
repo='/Users/rexxa/fls-astra-steward/';sources={'src/engine/history.ts'=>[[375,383],[400,404],[451,466],[580,585],[788,798]],'src/engine/politics.ts'=>[[342,369]],'src/content/historyCopy.ko.ts'=>[[327,336],[355,357],[371,371]],'src/engine/historyNames.ts'=>[[43,54]]}
write.call('SOURCES.json',sources.map{|f,r|s=File.read(repo+f);{file:f,sha256:Digest::SHA256.hexdigest(s),spans:r.map{|x,y|{start:x,end:y,text:s.lines[x-1..y-1].join}}}})
props={'id'=>{'type'=>'string'},'template'=>{'type'=>'string'},'axis'=>{'enum'=>%w[params capture]},'field'=>{'type'=>'string'},'op'=>{'enum'=>%w[eq gt]},'value'=>{'type'=>%w[string integer]},'headline'=>{'type'=>'string','minLength'=>1},'retainFactLine'=>{'const'=>true},'requiredSlots'=>{'type'=>'array','maxItems'=>0},'status'=>{'enum'=>%w[BLOCKED_NEW_CAPTURE_FIELD BLOCKED_TYPED_INPUT_GUARD]}}
write.call('PROPOSAL.schema.json',{'type'=>'object','additionalProperties'=>false,'required'=>%w[formatVersion status variants],'properties'=>{'formatVersion'=>{'const'=>1},'status'=>{'const'=>'DRAFT_NOT_CANONICAL'},'variants'=>{'type'=>'array','minItems'=>10,'maxItems'=>10,'items'=>{'type'=>'object','additionalProperties'=>false,'required'=>props.keys,'properties'=>props}}}})
