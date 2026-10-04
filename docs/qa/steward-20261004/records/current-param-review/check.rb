require 'json';require 'digest'
root='/tmp/astra-steward-r06-20261004/records/current-param-candidates';repo='/Users/rexxa/fls-astra-steward';read=lambda{|f|JSON.parse(File.read(root+'/'+f))};proposal=read.call('ADDITIONS.json');guards=read.call('GUARD_CONTRACT.json')['preconditions']
select=lambda do |template,params|
 g=guards.find{|x|x['templates'].include?(template)};next nil unless g&&params.is_a?(Hash)
 value=params[g['field'].split('.').last]
 valid=g['type']=='string' ? value.is_a?(String) : value.is_a?(Numeric)&&value.finite?&&value>=g['minimum']&&value<=g['maximum']&&value.to_i==value
 next nil unless valid
 found=proposal['additions'].find{|x|x['template']==template}['variants'].select do |v|
 v['when'].all? do |c|
 x=params[c['field'].split('.').last];case c['op'];when 'eq';x==c['value'];when 'gt';x>c['value'];when 'neq';x.is_a?(String)&&c['value'].is_a?(String)&&x!=c['value'];else;raise 'operator';end
 end
 end
 raise 'overlap' if found.size>1;found.first&&found.first['id']
end
fixtures=read.call('FIXTURES.json');fixtures.each{|f|raise f['id'] unless select.call(f['template'],f['params'])==f['expectedVariant']}
nonfinite=[Float::NAN,Float::INFINITY,-Float::INFINITY];%w[plague.new_graves plague.empty_streets].each{|t|f=t=='plague.new_graves'?'dead':'houses';nonfinite.each{|x|raise 'finite' unless select.call(t,{f=>x}).nil?}}
require root+'/schema_validator';current=read.call('CURRENT_VARIANTS.schema.json');proposed=read.call('PROPOSED_VARIANTS.schema.json');compat=[]
proposal['additions'].each{|a|a['variants'].each{|v|validate_schema(v,proposed['$defs']['variant'],proposed);ok=true;begin;validate_schema(v,current['$defs']['variant'],current);rescue RuntimeError;ok=false;end;compat<<{id:v['id'],currentShape:ok}}}
raise 'shape' unless compat.count{|x|x[:currentShape]}==5
read.call('SOURCE_EVIDENCE.json').each{|s|text=File.read(repo+'/'+s['path']);raise 'hash' unless Digest::SHA256.hexdigest(text)==s['sha256'];s['spans'].each{|x|raise 'span' unless text.lines[x['start']-1...x['end']].join==x['text']}}
File.write(__dir__+'/RESULT.json',JSON.pretty_generate({verdict:'SAFE_AS_BLOCKED_DRAFT_NOT_DIRECT_MERGE',fixtureCount:fixtures.size,nonfiniteCases:6,actualProposalConditionsEvaluated:true,compatibility:compat,runtimeExecuted:false,sourceFiles:read.call('SOURCE_EVIDENCE.json').size,canonicalSha256:Digest::SHA256.file('/tmp/astra-steward-r06-20261004/chronicle/variants.ko.json').hexdigest})+"\n")
