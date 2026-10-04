require 'json'
require 'digest'
root=__dir__
repo='/Users/rexxa/fls-astra-steward'
write=->(name,data){File.write(root+'/'+name,JSON.pretty_generate(data)+"\n")}
head='5fb1aebfe735592c1424c947e88388d4ffe21742'
domains={'person.move_in'=>['arrivalSize',%w[one several]],'person.married'=>['spouseHousehold',%w[manor town_house]],'person.left_town'=>['householdPeopleAfter',%w[present absent]]}
texts={
 'person.move_in'=>['비어 있던 집에 한 사람이 들었다.','비어 있던 집에 여러 사람이 들었다.'],
 'person.married'=>['영주관 가구의 배우자로 새로 기록되었다.','도시 주택의 가구에 배우자로 새로 기록되었다.'],
 'person.left_town'=>['도시를 떠날 때 같은 가구의 다른 인물이 도시 기록에 있었다.','도시를 떠난 뒤 같은 가구의 인물이 도시 기록에 남지 않았다.']}
rules={
 'person.move_in'=>'Same household building ID across before/after; old residents==0, after>0, old not abandoned. Mirror emitter early-continue for new burning/new abandonment. Household subject must be exact household with no head in before/after; person subject must equal emitter headOf (before heads then after heads overwrite), exactly one matching household actor. Count is household residentsAfter, never subject age. One versus >=2. Full normalized snapshot required; missing persons conservatively unknown although emitter may run without persons.',
 'person.married'=>'Exact new after.people person absent from before.people with role spouse, same record subject ID. Do not derive spouse identity from gender, surname or current read-time family. Proposed stricter scope: same sole head ID before/after, no prior spouse and exactly one after spouse. Household manor -> manor; otherwise require matching occupied unburnt unabandoned after house -> town_house. record actors absent for manor, exactly matching household otherwise. Event may create a spouse in an existing household: do not claim new dwelling, first marriage, love, remarriage, a new separate household, or a named partner.',
 'person.left_town'=>'Subject exists in before.people, absent after.people, appears alive in newly appended after.past slice with exact ID and unchanged householdId. before.past normalized prefix preserved; dead person must fallback. Count other after.people entries with that householdId in complete exact-event snapshot: >0 present, 0 absent. No assertion about all kin, household residents numeric count, death, motive, destination, or whether others departed simultaneously. manor actor rule as married.'}
fields=domains.map{|t,(f,vs)|{'id'=>f,'templates'=>[t],'values'=>vs,'provenance'=>'emission_snapshot','currentRecordStorage'=>'absent: proposed context field, not installed','immutableReconstruction'=>'Do not use current people/houses to reconstruct old facts. Unavailable exact emission snapshots or ambiguous IDs -> unknown.','captureRule'=>rules[t]}}
additions=domains.flat_map{|t,(f,vs)|vs.each_with_index.map{|v,i|{'template'=>t,'variant'=>{'id'=>t+'.r06transition.'+v,'priority'=>20,'when'=>[{'field'=>'context.'+f,'op'=>'eq','value'=>v}],'headline'=>texts[t][i],'requiredSlots'=>[],'retainFactLine'=>true}}}}
base=File.dirname(File.dirname(root))+'/chronicle/variants.ko.json'
package={'formatVersion'=>'person-transitions-context-v1','status'=>'DRAFT_UNINSTALLED','sourceHead'=>head,'baselineSha256'=>Digest::SHA256.file(base).hexdigest,'fields'=>fields,'fallback'=>{'unknown'=>'retain_original_fact_line','retainFactLine'=>true},'additions'=>additions}
write.call('PROPOSAL.json',package);write.call('FIELD_CONTRACTS.json',fields)
str={'type'=>'string','minLength'=>1,'pattern'=>'\\S'}
integer={'type'=>'integer','minimum'=>0,'maximum'=>9007199254740991}
obj=->(props){{'type'=>'object','required'=>props.keys,'properties'=>props,'additionalProperties'=>false}}
ref=obj.call({'type'=>{'enum'=>%w[person household]},'id'=>str})
common={'status'=>{'const'=>'known'},'recordId'=>str,'recordTick'=>integer,'template'=>{'enum'=>domains.keys},'subject'=>ref,'householdId'=>str,'sourceHead'=>{'const'=>head},'captureKind'=>{'const'=>'emission_snapshot'}}
known=domains.map{|t,(f,vs)|obj.call(common.merge('template'=>{'const'=>t},'fields'=>obj.call({f=>{'enum'=>vs}})))}
unknown=obj.call({'status'=>{'const'=>'unknown'},'recordId'=>str,'recordTick'=>integer,'template'=>{'enum'=>domains.keys},'subject'=>ref,'fields'=>obj.call({})})
context={'$schema'=>'https://json-schema.org/draft/2020-12/schema','anyOf'=>known+[unknown]};write.call('CONTEXT.schema.json',context)
rows=domains.map do |t,(f,vs)|
 cond=obj.call({'field'=>{'const'=>'context.'+f},'op'=>{'const'=>'eq'},'value'=>{'enum'=>vs}})
 variant=obj.call({'id'=>str,'priority'=>{'const'=>20},'when'=>{'type'=>'array','items'=>cond,'minItems'=>1,'maxItems'=>1},'headline'=>str,'requiredSlots'=>{'const'=>[]},'retainFactLine'=>{'const'=>true}})
 obj.call({'template'=>{'const'=>t},'variant'=>variant})
end
ps=obj.call({'formatVersion'=>{'const'=>package['formatVersion']},'status'=>{'const'=>'DRAFT_UNINSTALLED'},'sourceHead'=>{'const'=>head},'baselineSha256'=>{'const'=>package['baselineSha256']},'fields'=>{'type'=>'array','minItems'=>3,'maxItems'=>3,'uniqueItems'=>true,'items'=>{'enum'=>fields}},'fallback'=>{'const'=>package['fallback']},'additions'=>{'type'=>'array','minItems'=>6,'maxItems'=>6,'items'=>{'anyOf'=>rows}}})
write.call('PROPOSAL.schema.json',ps)
spans={'src/engine/history.ts'=>[[333,378],[386,424],[865,890]],'src/engine/persons.ts'=>[[350,367],[385,411],[608,622]],'src/engine/persons.types.ts'=>[[38,67],[84,92]],'src/content/historyCopy.ko.ts'=>[[339,340],[353,364]],'src/engine/historyNames.ts'=>[[1,20],[40,55]]}
write.call('SOURCE_EVIDENCE.json',spans.map{|path,ranges|text=File.read(repo+'/'+path);{'path'=>path,'sha256'=>Digest::SHA256.hexdigest(text),'spans'=>ranges.map{|a,b|{'start'=>a,'end'=>b,'text'=>text.lines[(a-1)..(b-1)].join}}}})
validator=File.read(File.dirname(root)+'/movement-context-revised/validate.rb').split('root=__dir__;')[0]
File.write(root+'/schema_validator.rb',validator)
write.call('ADOPTION_LIMITS.json',{'factLineHolds'=>[],'runtimeExecuted'=>false,'captureAdapterImplemented'=>false,'draftCompleteWithoutEngineInstallation'=>true,'notes'=>['move_in baseline 새 집 means newly occupied by household; do not imply newly constructed.','married baseline 가구를 이루었다 interpreted as household relationship; no new standalone household inferred. New spouse role alone is not a historical wedding ceremony audit.','left_town remaining persons are town people list at event-time, not all relatives anywhere.','Normalized oracle requires complete snapshots with extra source fields projected out; it does not prove provenance itself.','No names stored. Existing subject IDs remain IDs; renderer resolves current names. No new name formatter claimed.']})
