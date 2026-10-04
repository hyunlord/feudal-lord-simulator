require_relative 'schema_validator'
r=__dir__;read=lambda{|f|JSON.parse(File.read(r+'/'+f))};p=read.call('PROPOSAL.json');ps=read.call('PROPOSAL.schema.json');cs=read.call('CONTEXT.schema.json');validate_schema(p,ps,ps)
base=read.call('BASELINE_REF.json');canonical=File.expand_path(base['path'],r);raise 'canonical drift' unless Digest::SHA256.file(canonical).hexdigest==base['sha256']
existing=JSON.parse(File.read(canonical));old=(existing['historyTemplates']+existing['ledgerCategories']).flat_map{|g|g['variants']};ids=p['additions'].map{|a|a['variant']['id']};raise 'ID' unless ids.size==15&&ids.uniq.size==15&&(ids&old.map{|v|v['id']}).empty?
p['additions'].each{|a|raise 'names' unless a['variant']['requiredSlots']==[]&&!a['variant']['headline'].match?(/[{}]/)&&a['variant']['retainFactLine']==true}
def select(p,context,identity,schema)
 return nil unless schema_ok(context,schema,schema)
 return nil unless context['status']=='known' && context['referenceVerified']==true
 return nil unless %w[recordId recordTick campaignId template sourceHead].all?{|k|identity.is_a?(Hash)&&identity[k]==context[k]}
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
source=read.call('SOURCE_EVIDENCE.json');source.each{|s|body=File.read('/Users/rexxa/fls-astra-steward/'+s['path']);raise 'source drift' unless Digest::SHA256.hexdigest(body)==s['sha256'];s['spans'].each{|x|raise 'span' unless body.lines[(x['start']-1)...x['end']].join==x['text']}}
limits=read.call('ADOPTION_LIMITS.json');raise 'holds' unless limits['compositionHolds'].size==6
raise 'canonical changed' unless Digest::SHA256.file(canonical).hexdigest==base['sha256']
result={status:'AUTHOR_PROPOSAL_OFFLINE_PASS',templates:6,variants:15,fields:6,selectorFixtures:fixtures.size,selectorFallbacks:results.count{|x|x[:fallback]},negativeSchemaCases:negatives.size,positiveSchemaCases:fixtures.count{|x|x['expected']},sourceFiles:source.size,sourceSpans:source.sum{|x|x['spans'].size},compositionHolds:6,canonicalModified:false,canonicalSha256:base['sha256'],captureAdapterImplemented:false,engineExecuted:false,historyFormatterExecuted:false,independentReview:'pending'}
File.write(r+'/FIXTURE_RESULTS.json',JSON.pretty_generate(results)+"\n");File.write(r+'/NEGATIVE_RESULTS.json',JSON.pretty_generate(negatives)+"\n");File.write(r+'/VALIDATION.json',JSON.pretty_generate(result)+"\n");puts JSON.pretty_generate(result)
