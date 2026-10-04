require 'json';require 'digest';require '/tmp/astra-steward-r06-20261004/records/current-param-candidates/schema_validator'
p=__dir__;pkg=JSON.parse(File.read(p+'/ADDITIONS.json'));schema=JSON.parse(File.read(p+'/PROPOSAL.schema.json'));validate_schema(pkg,schema,schema)
def safe(v,min,max);v.is_a?(Numeric)&&v.finite?&&v.to_i==v&&v>=min&&v<=max;end
def pick(vs,r,c=nil)
 return nil unless r.is_a?(Hash)&&r['id'].is_a?(String)&&!r['id'].empty?&&safe(r['tick'],0,9007199254740991)
 t=r['template'];case t
 when 'milestone.chapter_start','milestone.chapter_end','person.grew'
  return nil unless r['params'].is_a?(Hash);f=t=='person.grew'?'residents':'chapter';v=r['params'][f];min=t=='milestone.chapter_start'?2:t=='person.grew'?2:1;max=t=='person.grew'?9007199254740991:5;return nil unless safe(v,min,max)
 when 'milestone.market_town','milestone.first_l4'
  return nil unless c.is_a?(Hash)&&c.keys.sort==%w[version recordId capturedAtTick source era l4Count].sort&&c['version']==1&&c['recordId']==r['id']&&c['capturedAtTick']==r['tick']&&c['source']=='milestone_emitter_after'&&%w[hamlet market_town stone_town].include?(c['era'])&&safe(c['l4Count'],0,9007199254740991)
  f=t=='milestone.market_town'?'era':'l4Count';v=c[f];return nil if (t=='milestone.market_town'&&v=='hamlet')||(t=='milestone.first_l4'&&v<1)
 else;return nil
 end
 found=vs.select{|x|x['template']==t&&(x['op']=='eq'?v==x['value']:v>x['value'])};raise 'overlap' if found.size>1;found.first&&found.first['id']
end
results=[];vs=pkg['variants'];vs.each do |v|
 value=v['op']=='gt'?v['value']+1:v['value'];r={'id'=>'r','tick'=>100,'template'=>v['template'],'params'=>{v['field']=>value}};c=v['axis']=='capture'?{'version'=>1,'recordId'=>'r','capturedAtTick'=>100,'source'=>'milestone_emitter_after','era'=>'market_town','l4Count'=>1}.merge(v['field']=>value):nil
 raise 'positive' unless pick(vs,r,c)==v['id'];results<<{id:v['id'],selected:v['id'],record:r,capture:c}
 bad=[nil,'1',false,{},[],0,-1,1.5,9007199254740992]
 bad.each do |x|
  rr=Marshal.load(Marshal.dump(r));cc=c&&Marshal.load(Marshal.dump(c));v['axis']=='capture'?cc[v['field']]=x:rr['params'][v['field']]=x
  raise 'invalid unexpectedly selected' unless pick(vs,rr,cc).nil?
  results<<{id:v['id']+'.invalid.'+x.inspect,selected:nil}
 end
 if c
  %w[recordId capturedAtTick source version].each{|f|cc=c.reject{|k,_|k==f};raise 'missingcapture' unless pick(vs,r,cc).nil?;results<<{id:v['id']+'.missing.'+f,selected:nil}}
 end
end
# Unknown valid chapter routes to baseline rather than arbitrary wording.
raise 'chapter fallback' unless pick(vs,{'id'=>'r','tick'=>100,'template'=>'milestone.chapter_start','params'=>{'chapter'=>3}}).nil?
source=JSON.parse(File.read(p+'/SOURCES.json'));source.each{|s|body=File.read('/Users/rexxa/fls-astra-steward/'+s['file']);raise 'source drift' unless Digest::SHA256.hexdigest(body)==s['sha256'];s['spans'].each{|x|raise 'span' unless body.lines[x['start']-1..x['end']-1].join==x['text']}}
File.write(p+'/FIXTURES.json',JSON.pretty_generate(results)+"\n");File.write(p+'/VALIDATION.json',JSON.pretty_generate({status:'AUTHOR_DRAFT_ONLY',variants:10,coveredTypes:5,notDraftedTypes:3,fixtures:results.size,strictProposalSchema:true,canonicalSchemaCompatible:false,captureImplemented:false,runtimeExecuted:false,canonicalModified:false,sourceFiles:source.size,independentReview:'pending'})+"\n")
