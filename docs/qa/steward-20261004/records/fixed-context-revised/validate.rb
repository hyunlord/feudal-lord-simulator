require_relative 'schema_validator'
r=__dir__;read=lambda{|f|JSON.parse(File.read(r+'/'+f))};p=read.call('PROPOSAL.json');ps=read.call('PROPOSAL.schema.json');cs=read.call('CONTEXT.schema.json');validate_schema(p,ps,ps)
base=read.call('BASELINE_REF.json');canonical=File.expand_path(base['path'],r);raise 'canonical drift' unless Digest::SHA256.file(canonical).hexdigest==base['sha256']
existing=JSON.parse(File.read(canonical));old=(existing['historyTemplates']+existing['ledgerCategories']).flat_map{|g|g['variants']};ids=p['additions'].map{|a|a['variant']['id']};raise 'ID' unless ids.size==10&&ids.uniq.size==10&&(ids&old.map{|v|v['id']}).empty?
p['additions'].each{|a|raise 'names' unless a['variant']['requiredSlots']==[]&&!a['variant']['headline'].match?(/[{}]/)&&a['variant']['retainFactLine']==true}
def select(p,context,identity,schema)
 return nil unless schema_ok(context,schema,schema)
 return nil unless context['status']=='known' && context['referenceVerified']==true
 return nil unless %w[recordId recordTick campaignId template sourceHead].all?{|k|identity.is_a?(Hash)&&identity[k]==context[k]}
if identity['template']=='ledger.l4'
 params=identity['params'];return nil unless params.is_a?(Hash)
 values=%w[from to].map{|k|params[k]};return nil unless values.all?{|v|v.is_a?(Numeric)&&v.finite?&&v==v.to_i&&v>=0&&v<=9007199254740991}
 direction=values[1]>values[0] ? 'increased' : values[1]<values[0] ? 'decreased' : 'unchanged'
 return nil unless context['fields']['archivedL4Direction']==direction
end
 matches=p['additions'].select{|a|a['template']==identity['template'] && a['variant']['when'].all?{|q|context['fields'][q['field'].sub('context.','')]==q['value']}}
 raise 'ambiguous' if matches.size>1
 matches.first && matches.first['variant']['id']
end
fixtures=read.call('FIXTURES.json');results=fixtures.map{|f|selected=select(p,f['context'],f['identity'],cs);raise 'fixture '+f['id'] unless selected==f['expected'];{id:f['id'],selected:selected,schemaAccepted:schema_ok(f['context'],cs,cs),fallback:selected.nil?}}
negatives=[]
fixtures.select{|f|f['expected']}.each do |f|
 %w[recordId recordTick campaignId template sourceHead captureKind status referenceVerified fields].each do |key|
  value=Marshal.load(Marshal.dump(f['context']));value.delete(key);raise 'missing field accepted' if schema_ok(value,cs,cs);negatives<<{id:f['id']+'.missing.'+key,rejected:true}
 end
 [nil,false,1,[],{'wrong'=>'field'}].each_with_index{|bad,i|v=Marshal.load(Marshal.dump(f['context']));v['fields']=bad;raise 'bad fields' if schema_ok(v,cs,cs);negatives<<{id:f['id']+'.badfields.'+i.to_s,rejected:true}}
end
archive_cases=[];af=fixtures.find{|f|f['identity']['template']=='ledger.l4'&&f['expected']}
[nil,{}, {'from'=>-1,'to'=>1},{'from'=>0,'to'=>1.5},{'from'=>'0','to'=>1},{'from'=>0,'to'=>9007199254740992},{'from'=>false,'to'=>1},{'from'=>Float::NAN,'to'=>1},{'from'=>0,'to'=>Float::INFINITY},{'from'=>2,'to'=>0}].each_with_index do |params,i|
 identity=Marshal.load(Marshal.dump(af['identity']));identity['params']=params;raise 'archive bad input selected' unless select(p,af['context'],identity,cs).nil?;archive_cases<<{id:i,fallback:true}
end
source=read.call('SOURCE_EVIDENCE.json');source.each{|s|body=File.read('/Users/rexxa/fls-astra-steward/'+s['path']);raise 'source drift' unless Digest::SHA256.hexdigest(body)==s['sha256'];s['spans'].each{|x|raise 'span' unless body.lines[(x['start']-1)...x['end']].join==x['text']}}
limits=read.call('ADOPTION_LIMITS.json');raise 'holds' unless limits['compositionHolds'].size==7
raise 'canonical changed' unless Digest::SHA256.file(canonical).hexdigest==base['sha256']
require_relative 'parent_capture_checks'
parent_results=parent_capture_checks
File.write(r+'/PARENT_CAPTURE_RESULTS.json',JSON.pretty_generate(parent_results)+"\n")
result={parentCaptureReferenceCases:parent_results.size,status:'AUTHOR_PROPOSAL_OFFLINE_PASS',templates:4,variants:10,fields:4,selectorFixtures:fixtures.size,selectorFallbacks:results.count{|x|x[:fallback]},negativeSchemaCases:negatives.size,archiveParamNegativeCases:archive_cases.size,positiveSchemaCases:fixtures.count{|x|x['expected']},sourceFiles:source.size,sourceSpans:source.sum{|x|x['spans'].size},compositionHolds:7,canonicalModified:false,canonicalSha256:base['sha256'],captureAdapterImplemented:false,engineExecuted:false,historyFormatterExecuted:false,independentReview:'pending'}
File.write(r+'/FIXTURE_RESULTS.json',JSON.pretty_generate(results)+"\n");File.write(r+'/NEGATIVE_RESULTS.json',JSON.pretty_generate(negatives)+"\n");File.write(r+'/VALIDATION.json',JSON.pretty_generate(result)+"\n");puts JSON.pretty_generate(result)
