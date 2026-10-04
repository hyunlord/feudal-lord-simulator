require 'json';require 'digest'
def schema_ok(v,s,root)
 supported=%w[$schema $id title description $ref type required properties additionalProperties const enum pattern items uniqueItems minItems maxItems minLength minimum maximum anyOf $defs]
 raise 'unsupported keyword' unless (s.keys-supported).empty?
 return false if s['$ref'] && !schema_ok(v,s['$ref'].sub('#/','').split('/').reduce(root){|h,k|h.fetch(k)},root)
 if s['type']
  ok=Array(s['type']).any?{|t|case t;when 'object';v.is_a?(Hash);when 'array';v.is_a?(Array);when 'string';v.is_a?(String);when 'number';v.is_a?(Numeric);when 'integer';v.is_a?(Integer);when 'boolean';[true,false].include?(v);when 'null';v.nil?;else;raise 'type';end};return false unless ok
 end
 return false if s.key?('const') && v!=s['const'];return false if s['enum'] && !s['enum'].include?(v)
 if v.is_a?(Numeric)
  return false if s['minimum'] && v<s['minimum'];return false if s['maximum'] && v>s['maximum']
 elsif v.is_a?(String)
  return false if s['minLength'] && v.size<s['minLength'];return false if s['pattern'] && !Regexp.new(s['pattern']).match?(v)
 elsif v.is_a?(Array)
  return false if s['minItems'] && v.size<s['minItems'];return false if s['maxItems'] && v.size>s['maxItems'];return false if s['uniqueItems'] && v.uniq!=v
  return false if s['items'] && !v.all?{|x|schema_ok(x,s['items'],root)}
 elsif v.is_a?(Hash)
  return false unless (Array(s['required'])-v.keys).empty?
  props=s['properties']||{};return false if s['additionalProperties']==false && !(v.keys-props.keys).empty?
  return false unless props.all?{|k,sub|!v.key?(k)||schema_ok(v[k],sub,root)}
 end
 return false if s['anyOf'] && !s['anyOf'].any?{|sub|schema_ok(v,sub,root)}
 true
end
def validate_schema(v,s,root);raise 'schema rejected' unless schema_ok(v,s,root);true;end
r=__dir__;a=File.expand_path('../event-context-wave2-revised',r);o=File.expand_path('../event-context-wave2',r);canon=File.expand_path('../../chronicle/variants.ko.json',r);sha=lambda{|f|Digest::SHA256.file(f).hexdigest};read=lambda{|name|JSON.parse(File.read(a+'/'+name))}
before=Dir.children(a).to_h{|f|[f,sha.call(a+'/'+f)]};canonical_sha=sha.call(canon)
preserved=%w[PROPOSAL.json FIELD_CONTRACTS.json FIXTURES.json SOURCE_EVIDENCE.json READ_TIME_NAMES.md NOT_AUTHORED.json baseline647.ko.json];preserved.each{|f|raise 'original changed '+f unless File.binread(a+'/'+f)==File.binread(o+'/'+f)}
File.readlines(a+'/SHA256SUMS').each{|line|h,f=line.chomp.split('  ',2);raise 'manifest' unless sha.call(a+'/'+f)==h}
p=read.call('PROPOSAL.json');s=read.call('PROPOSAL.schema.json');c=read.call('CONTEXT.schema.json');fixtures=read.call('FIXTURES.json');validate_schema(p,s,s)
selector_source=File.read(a+'/validate.rb').split('def select_candidate',2).last.split("\nraise 'original fixture",2).first
eval('def select_candidate'+selector_source,binding)
fixtures.each{|f|raise 'selection '+f['id'] unless select_candidate(p,f['template'],f['context'])==f['expected']}
# Reuse author mutation inputs, but evaluate them using independently written schema_ok above.
load a+'/negative_schema_checks.rb';negative=negative_schema_checks(p,s,c,fixtures)
raise 'negative count' unless negative[:negativeCount]==127 && negative[:knownPositiveCount]==22 && negative[:safeTickBoundaryPositiveCases]==2
# Independent mutations covering each of the five originally reported schema holes for all nine templates.
extra=[];fixtures.select{|f|f['expected']}.group_by{|f|f['template']}.each do |template,fs|
 {'negative_tick'=>lambda{|x|x['recordTick']=-1},'unsafe_tick'=>lambda{|x|x['recordTick']=9007199254740992},'missing_field'=>lambda{|x|x['fields']={}},'wrong_field'=>lambda{|x|x['fields']=template=='decision.rebuild' ? {'finalEndingAxis'=>'town'} : {'rebuildOccupancyAtStart'=>'empty'}},'empty_head'=>lambda{|x|x['sourceHead']=''}}.each do |label,mutation|
  value=Marshal.load(Marshal.dump(fs.first['context']));mutation.call(value);raise 'regression '+template+label if schema_ok(value,c,c);extra<<{template:template,case:label,rejected:true}
 end
end
limits=read.call('ADOPTION_LIMITS.json');expected=%w[legacy.charter_refused.r06ctx2.expired decision.market_town.r06ctx2.water_reach decision.market_town.r06ctx2.land_ring];raise 'composition scope' unless limits['compositionReviewRequired'].sort==expected.sort && limits['blocks'].map{|x|x['variantId']}.sort==expected.sort
raise 'composition unclear' unless limits['blocks'].all?{|b|b['engineModified']==false && b['requires'].is_a?(String) && b['originalFactLine'] && b['proposedFactLine']}
source=read.call('SOURCE_EVIDENCE.json');source.each{|f|body=File.read('/Users/rexxa/fls-astra-steward/'+f['path']);raise 'source' unless Digest::SHA256.hexdigest(body)==f['sha256'];f['spans'].each{|x|raise 'span' unless body.lines[(x['start']-1)...x['end']].join==x['text']}}
raise 'candidate modified' unless before==Dir.children(a).to_h{|f|[f,sha.call(a+'/'+f)]};raise 'canonical modified' unless canonical_sha==sha.call(canon)
result={status:'PASS_REVISED_DRAFT_WITH_COMPOSITION_HOLDS',templates:9,variants:22,fields:9,originalFixtureCount:fixtures.size,byteIdenticalFiles:preserved,independentSchemaNegativeCount:127,knownPositiveCount:22,safeTickPositiveCount:2,independentRegressionProbeCount:extra.size,unknownEmptyAccepted:negative[:unknownEmptyAccepted],compositionHolds:expected,sourceFiles:source.size,sourceSpans:source.sum{|x|x['spans'].size},candidateUnchanged:true,canonicalUnchanged:true,canonicalSha256:canonical_sha,runtimeExecuted:false,captureAdapterImplemented:false,fullJsonSchemaConformance:false}
File.write(r+'/RESULT.json',JSON.pretty_generate(result)+"\n");File.write(r+'/SCHEMA_RESULTS.json',JSON.pretty_generate({authorMutationInputsIndependentValidator:negative,independentFiveHoleRegressions:extra})+"\n");File.write(r+'/INPUT_SHA256SUMS',before.sort.map{|f,h|"#{h}  ../event-context-wave2-revised/#{f}"}.join("\n")+"\n");puts JSON.pretty_generate(result)
