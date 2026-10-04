require 'json'
require 'digest'
require 'csv'
require_relative '../registry-invalid-candidates/schema_validator'
r=File.expand_path('../..',__dir__); c=r+'/chronicle'; candidate=r+'/records/registry-invalid-candidates'; baseline=__dir__+'/baseline647'; repo='/Users/rexxa/fls-astra-steward'
read=lambda{|f|JSON.parse(File.read(f))}; sha=lambda{|f|Digest::SHA256.file(f).hexdigest}
patch=read.call(candidate+'/ADDITIONS.json'); base=read.call(baseline+'/variants.ko.json'); schema=read.call(c+'/variants.schema.json')
raise 'baseline SHA' unless sha.call(baseline+'/variants.ko.json')==patch['baselineSha256']
%w[variants.schema.json R05D_INSTALL_BLOCKS.json].each{|f|raise 'inherited contract drift' unless File.binread(c+'/'+f)==File.binread(baseline+'/'+f)}
source=read.call(candidate+'/SOURCE_EVIDENCE.json'); source.each{|s|body=File.read(repo+'/'+s['path']);raise 'source drift' unless Digest::SHA256.hexdigest(body)==s['sha256'];s['spans'].each{|span|raise 'span mismatch' unless body.lines[(span['start']-1)...span['end']].join==span['text']}}
raise 'source scope' unless source.size==7 && source.sum{|s|s['spans'].size}==11
Dir.children(candidate).select{|f|File.file?(candidate+'/'+f)}.each{|f|raise 'candidate changed after review' unless File.binread(candidate+'/'+f)==File.binread(__dir__+'/replay/records/registry-invalid-candidates/'+f)}
merged=Marshal.load(Marshal.dump(base)); additions=patch.fetch('additions');raise 'scope' unless additions.size==1 && additions.first['template']=='registry.invalid'
variants=additions.first['variants'];raise 'count' unless variants.size==3
expected=%w[ck_evt_013 ck_evt_034 ck_evt_038]
variants.each_with_index{|v,i|raise 'conditions' unless v['when']==[{'field'=>'params.entry','op'=>'eq','value'=>expected[i]}] && v['requiredSlots']==[] && v['retainFactLine']==true && v['priority']==20}
group=merged['historyTemplates'].find{|g|g['template']=='registry.invalid'};raise 'baseline template' unless group['variants'].size==1
group['variants'].concat(variants);ids=variants.map{|v|v['id']}
all=(merged['historyTemplates']+merged['ledgerCategories']).flat_map{|g|g['variants']};raise 'unique650' unless all.size==650 && all.map{|v|v['id']}.uniq.size==650
reverted=Marshal.load(Marshal.dump(merged));reverted['historyTemplates'].each{|g|g['variants'].reject!{|v|ids.include?(v['id'])}};raise 'baseline modification' unless reverted==base
validate_schema(merged,schema,schema)
fixtures=read.call(candidate+'/FIXTURES.json'); fixtures.each do |f|
 params=f['params']; matches=group['variants'].select{|v|v['when'].empty? || (params.is_a?(Hash) && params['entry'].is_a?(String) && v['when'].all?{|q|params['entry']==q['value']})};selected=matches.select{|v|v['priority']==matches.map{|v|v['priority']}.max}
 expected_id=f['expectedVariant'] || base['historyTemplates'].find{|g|g['template']=='registry.invalid'}['variants'].first['id'];raise 'fixture '+f['id'] unless selected.size==1 && selected.first['id']==expected_id
end
blocks=read.call(c+'/R05D_INSTALL_BLOCKS.json')['blocks'];raise 'install blocks' unless blocks.size==6 && blocks.all?{|b|all.any?{|v|v['id']==b['variantId']}}
if ARGV==['--merge']
 raise 'canonical not baseline' unless sha.call(c+'/variants.ko.json')==patch['baselineSha256']
 File.write(c+'/variants.ko.json',JSON.pretty_generate(merged)+"\n")
 File.write(c+'/R06_REVIEWED_PATCH.json',JSON.pretty_generate(patch)+"\n")
 coverage=CSV.read(c+'/COVERAGE.csv',headers:true);coverage.each{|row|groups=row['domain']=='history' ? merged['historyTemplates'] : merged['ledgerCategories'];g=groups.find{|x|(x['template']||x['category'])==row['id']};row['authored_headlines']=g['variants'].size;row['conditional_variants']=g['variants'].count{|v|!v['when'].empty?}};File.write(c+'/COVERAGE.csv',coverage.to_csv)
 lines=["id\twhen\theadline"];all.each{|v|lines<<[v['id'],JSON.generate(v['when']),v['headline']].join("\t") unless v['when'].empty?};File.write(c+'/conditional-lines.tsv',lines.join("\n")+"\n")
end
raise 'canonical mismatch' unless read.call(c+'/variants.ko.json')==merged
coverage=CSV.read(c+'/COVERAGE.csv',headers:true);raise 'coverage count' unless coverage.size==228
coverage.each{|row|g=(merged['historyTemplates']+merged['ledgerCategories']).find{|x|(x['template']||x['category'])==row['id']};raise 'coverage mismatch' unless row['authored_headlines'].to_i==g['variants'].size && row['conditional_variants'].to_i==g['variants'].count{|v|!v['when'].empty?}}
expected_lines=["id\twhen\theadline"];all.each{|v|expected_lines<<[v['id'],JSON.generate(v['when']),v['headline']].join("\t") unless v['when'].empty?}
raise 'conditional table mismatch' unless File.read(c+'/conditional-lines.tsv')==expected_lines.join("\n")+"\n"
result={status:'PASS_INDEPENDENT_OFFLINE_MERGE_WITH_INHERITED_BLOCKS',baselinePreserved:647,added:3,total:650,templates:1,historyTypes:merged['historyTemplates'].size,ledgerCategories:merged['ledgerCategories'].size,singleHistoryTypes:merged['historyTemplates'].count{|g|g['variants'].size==1},fixtures:fixtures.size,fallbackFixtures:fixtures.count{|f|f['expectedVariant'].nil?},sourceFiles:7,sourceSpans:11,schemaPassed:true,installBlocks:6,numericGuard:'inherited proposed adapter only',runtimeInstalled:false,runtimeSelected:false,naturalOccurrenceVerified:false,review:'../records/registry-invalid-review/REVIEW.md',sha256:sha.call(c+'/variants.ko.json'),candidateSha256:sha.call(candidate+'/ADDITIONS.json'),baselineSha256:patch['baselineSha256']}
%w[R06_VALIDATION.json VALIDATION.json].each{|f|File.write(c+'/'+f,JSON.pretty_generate(result)+"\n")};File.write(__dir__+'/RESULT.json',JSON.pretty_generate(result)+"\n");puts JSON.pretty_generate(result)
