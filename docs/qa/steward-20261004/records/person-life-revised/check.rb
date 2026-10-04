require 'json';require 'digest';require_relative 'capture'
r=__dir__;pkg=JSON.parse(File.read(r+'/PROPOSALS.json'));vs=pkg['variants'];original=JSON.parse(File.read(r+'/ORIGINAL_125_FIXTURES.json'))
canonical=File.dirname(File.dirname(r))+'/chronicle/variants.ko.json';current_sha=Digest::SHA256.file(canonical).hexdigest
raise 'frozen baseline' unless Digest::SHA256.file(r+'/baseline650.ko.json').hexdigest==pkg['baselineSha256']
raise '125 originals' unless original.size==125
results=original.map do |f|
 frozen=JSON.generate(f);ctx=capture(f['record'],f['before'],f['after'],8000);v=pick(vs,f['template'],ctx)
 raise "original mismatch #{f['id']}" unless (v&&v['id'])==f['expected']&&ctx==f['context']&&JSON.generate(f)==frozen
 {id:f['id'],passed:true,selected:v&&v['id']}
end
base=original.first;expected=base['expected'];tests=[]
add=lambda{|id,changes,exp|rec=Marshal.load(Marshal.dump(base['record']));changes.each{|k,v|v==:delete ? rec.delete(k) : rec[k]=v};tests<<{id:id,record:rec,before:base['before'],after:base['after'],expected:exp}}
add.call('wrong_household_subject_matching_actor',{'subject'=>{'type'=>'household','id'=>'wrong-house'}},nil)
add.call('empty_record_id',{'id'=>''},nil)
add.call('person_subject_actor_only_positive',{},expected)
add.call('household_subject_positive_no_actor',{'subject'=>{'type'=>'household','id'=>'fixture-house'},'actors'=>:delete},expected)
add.call('blank_record_id',{'id'=>'  '},nil)
add.call('unknown_subject_actor_must_not_rescue',{'subject'=>{'type'=>'town','id'=>'town'}},nil)
add.call('missing_subject_actor_must_not_rescue',{'subject'=>:delete},nil)
add.call('empty_person_subject_actor_must_not_rescue',{'subject'=>{'type'=>'person','id'=>''}},nil)
add.call('ambiguous_household_actors',{'actors'=>[{'type'=>'household','id'=>'fixture-house'},{'type'=>'household','id'=>'wrong-house'}]},nil)
add.call('household_subject_priority_ignores_other_actor',{'subject'=>{'type'=>'household','id'=>'fixture-house'},'actors'=>[{'type'=>'household','id'=>'wrong-house'}]},expected)
add.call('actor_id_alias_rejected',{'actors'=>[{'type'=>'household','id'=>'fixture-house-alias'}]},nil)
regression=tests.map do |f|
 frozen=JSON.generate(f);ctx=capture(f[:record],f[:before],f[:after],8000);v=pick(vs,f[:record]['template'],ctx)
 raise "regression #{f[:id]}" unless (v&&v['id'])==f[:expected]&&JSON.generate(f)==frozen
 f.merge(passed:true,selected:v&&v['id'],context:ctx)
end
sources=JSON.parse(File.read(r+'/SOURCE_EVIDENCE.json'));repo='/Users/rexxa/fls-astra-steward'
sources.each{|s|raw=File.read(repo+'/'+s['path']);raise 'sourcehash' unless Digest::SHA256.hexdigest(raw)==s['sha256'];s['spans'].each{|q|raise 'source span' unless raw.lines[(q['start']-1)..(q['end']-1)].join==q['text']}}
JSON.parse(File.read(r+'/INPUT_MANIFEST.json')).each{|f|raise "immutable input changed #{f['path']}" unless Digest::SHA256.file(f['path']).hexdigest==f['sha256']}
raise 'canonical changed' unless Digest::SHA256.file(canonical).hexdigest==current_sha
blocks=vs.select{|v|v['status']=='BLOCKED_BASELINE_FACT_LINE_AND_CONTEXT'}.map{|v|v['id']}
raise 'fed blocks' unless blocks.sort==%w[person.fed.r06life.brief person.fed.r06life.long]
File.write(r+'/REGRESSION_RESULTS.json',JSON.pretty_generate(regression)+"\n")
report={status:'AUTHOR_REVISION_CHECK_PASSED_INDEPENDENT_RECHECK_PENDING',originalFixtures:results.size,regressionFixtures:regression.size,totalFixtures:results.size+regression.size,priorIndependentReview:'18 conditional draft passes and 2 fact-line blocks; two capture defects found',wrongHouseholdSubjectRejected:true,emptyRecordIdRejected:true,actorOnlyPersonControlPassed:true,factLineBlocks:blocks,candidateTextChanged:false,canonicalModified:false,originalCandidateModified:false,canonicalShaAtCheck:current_sha,frozenBaselineSha256:pkg['baselineSha256'],runtimeExecuted:false,immutableRuntimeProvenanceVerified:false,independentRecheck:'pending'}
File.write(r+'/VALIDATION.json',JSON.pretty_generate(report)+"\n");puts JSON.pretty_generate(report)
