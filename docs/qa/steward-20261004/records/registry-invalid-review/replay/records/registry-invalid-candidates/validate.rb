require_relative 'schema_validator'
root=__dir__;round=File.dirname(File.dirname(root));repo='/Users/rexxa/fls-astra-steward'
canonical=round+'/chronicle/variants.ko.json';p=JSON.parse(File.read(root+'/ADDITIONS.json'));base=JSON.parse(File.read(canonical));schema=JSON.parse(File.read(root+'/variants.schema.json'))
raise 'baseline drift' unless Digest::SHA256.file(canonical).hexdigest==p.fetch('baselineSha256')
raise 'schema drift' unless File.binread(root+'/variants.schema.json')==File.binread(round+'/chronicle/variants.schema.json')
count=lambda{|doc|(doc.fetch('historyTemplates')+doc.fetch('ledgerCategories')).sum{|g|g.fetch('variants').size}}
raise 'baseline count' unless count.call(base)==647
validate_schema(base,schema,schema)
raise 'single template' unless p['additions'].size==1 && p['additions'][0]['template']=='registry.invalid'
vs=p['additions'][0]['variants'];raise 'three variants' unless vs.size==3
expected=%w[ck_evt_013 ck_evt_034 ck_evt_038]
vs.each_with_index do |v,i|
 raise 'contract' unless v['priority']==20 && v['retainFactLine']==true && v['requiredSlots']==[] && v['when']==[{'field'=>'params.entry','op'=>'eq','value'=>expected[i]}]
 raise 'unsupported prose' if v['headline'].match?(/[{}]|사망|죽|잔액|돈이 부족|해임|회수|이미 해결|집행되었다/)
 validate_schema(v,schema['$defs']['variant'],schema)
end
merged=Marshal.load(Marshal.dump(base));group=merged['historyTemplates'].find{|g|g['template']=='registry.invalid'}
raise 'baseline variants' unless group['variants'].size==1
group['variants'].concat(vs)
validate_schema(merged,schema,schema)
all=(merged['historyTemplates']+merged['ledgerCategories']).flat_map{|g|g['variants']}
raise 'ID collision' unless all.map{|v|v['id']}.uniq.size==all.size
raise 'merged count' unless count.call(merged)==650
group['variants'].slice!(-3,3);raise 'baseline preservation' unless merged==base
fixtures=JSON.parse(File.read(root+'/FIXTURES.json'))
results=fixtures.map do |f|
 params=f['params'];matches=vs.select{|v|params.is_a?(Hash) && params['entry'].is_a?(String) && params['entry']==v['when'][0]['value']}
 raise 'overlap' if matches.size>1
 selected=matches.first && matches.first['id'];raise "fixture #{f['id']}" unless selected==f['expectedVariant']
 {id:f['id'],selected:selected,fallback:selected.nil?,headline:matches.first && matches.first['headline'],baselineRetained:true}
end
sources=JSON.parse(File.read(root+'/SOURCE_EVIDENCE.json'));span_count=0
sources.each{|s|text=File.read(repo+'/'+s['path']);raise 'source drift' unless Digest::SHA256.hexdigest(text)==s['sha256'];s['spans'].each{|r|raise 'span mismatch' unless text.lines[(r['start']-1)..(r['end']-1)].join==r['text'];span_count+=1}}
raise 'canonical mutation' unless Digest::SHA256.file(canonical).hexdigest==p['baselineSha256']
File.write(root+'/FIXTURE_RESULTS.json',JSON.pretty_generate(results)+"\n")
report={status:'PASS_OFFLINE_CANDIDATE_ONLY',baselineCount:647,additions:3,hypotheticalMergedCount:650,canonicalModified:false,fixtures:results.size,fallbackFixtures:results.count{|r|r[:fallback]},sourceFiles:sources.size,sourceSpans:span_count,fullSchemaValidation:true,retainsBaselineAndFactLine:true,nameCapture:false,runtimeVerified:false,naturalOccurrenceVerified:false,independentReview:'pending',installStatus:'candidate_not_installed'}
File.write(root+'/VALIDATION.json',JSON.pretty_generate(report)+"\n")
File.write(root+'/SHA256SUMS',Dir.children(root).reject{|f|f=='SHA256SUMS'}.sort.map{|f|"#{Digest::SHA256.file(root+'/'+f).hexdigest}  #{f}"}.join("\n")+"\n")
puts JSON.pretty_generate(report)
