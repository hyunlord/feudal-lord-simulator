require 'json';require 'digest'
b='/tmp/astra-steward-r06-20261004/records/marriage-life-revised';o='/tmp/astra-steward-r06-20261004/records/marriage-life-context'
code=File.read(b+'/validate.rb');eval(code[code.index('def validate_schema')...code.index('root=__dir__')],TOPLEVEL_BINDING,b+'/validate.rb');eval(code[code.index('def select_candidate')...code.index('fixtures=JSON.parse')],TOPLEVEL_BINDING,b+'/validate.rb')
p=JSON.parse(File.read(b+'/PROPOSAL.json'));old=JSON.parse(File.read(o+'/PROPOSAL.json'));s=JSON.parse(File.read(b+'/PROPOSAL.schema.json'));c=JSON.parse(File.read(b+'/CONTEXT.schema.json'));f=JSON.parse(File.read(b+'/FIXTURES.json'));validate_schema(p,s,s)
raise '20 altered' unless p['additions']==old['additions']
p['fields'].each{|field|prior=old['fields'].find{|x|x['id']==field['id']};if field['id']=='willAllowedRoute';raise 'guard' unless field['captureRule'].start_with?(prior['captureRule'])&&field['captureRule'].include?('ADDED DEATH/IDENTITY GUARD');raise 'extra change' unless field.reject{|k,v|k=='captureRule'}==prior.reject{|k,v|k=='captureRule'};else;raise 'field changed' unless field==prior;end}
raise 'contract mismatch' unless p['fields']==JSON.parse(File.read(b+'/FIELD_CONTRACTS.json'))
f.each{|x|raise 'fixture' unless select_candidate(p,x['template'],x['context'],c)==x['expected']}
load b+'/negative_schema_checks.rb';n=negative_schema_checks(p,s,c,f)
gates=[];f.select{|x|x['expected']}.each do |x|
 ['unexpected_field','unexpected_envelope'].each do |kind|
  ctx=Marshal.load(Marshal.dump(x['context']));target=kind=='unexpected_field' ? ctx['fields'] : ctx;target['unexpectedHistoricalCause']='invented'
  rejected=false;begin;validate_schema(ctx,c,c);rescue RuntimeError;rejected=true;end
  selected=select_candidate(p,x['template'],ctx,c);raise 'gate failed' unless rejected&&selected.nil?;gates<<{id:x['id']+'.'+kind,rejected:true,selected:selected}
 end
end
source=JSON.parse(File.read(b+'/SOURCE_EVIDENCE.json'));source.each{|x|raw=File.read('/Users/rexxa/fls-astra-steward/'+x['path']);raise 'source' unless Digest::SHA256.hexdigest(raw)==x['sha256'];x['spans'].each{|sp|raise 'span' unless raw.lines[(sp['start']-1)..(sp['end']-1)].join==sp['text']}}
raise 'manifest' unless File.readlines(b+'/SHA256SUMS').all?{|l|sha,path=l.strip.split(/\s+/,2);Digest::SHA256.file(b+'/'+path).hexdigest==sha}
blocks=JSON.parse(File.read(b+'/ADOPTION_LIMITS.json'));raise 'blocks changed' unless blocks==JSON.parse(File.read(o+'/ADOPTION_LIMITS.json'))&&blocks['blocks'].size==3
base='/tmp/astra-steward-r06-20261004/records/marriage-life-review/baseline650.ko.json';raise 'frozen baseline' unless Digest::SHA256.file(base).hexdigest==p['baselineSha256']
r={status:'PASS_REVISED_DRAFT_17_CONDITIONAL_3_FACTLINE_BLOCKS',selectionFixtures:f.size,schemaNegatives:n[:negativeCount],schemaGateRegressions:gates.size,original20Unchanged:true,original3FactLineBlocksUnchanged:true,fieldContractChangeOnly:'willAllowedRoute.captureRule death/identity guard expanded',deathGuardImplemented:false,deathGuardStatus:'DECLARATIVE_ADAPTER_CONTRACT_ONLY',sourceFiles:source.size,sourceSpans:source.sum{|x|x['spans'].size},baselinePath:base,baselineSha256:p['baselineSha256'],currentCanonicalSha256:Digest::SHA256.file('/tmp/astra-steward-r06-20261004/chronicle/variants.ko.json').hexdigest,runtimeExecuted:false,regressionResults:gates}
File.write(__dir__+'/RESULT.json',JSON.pretty_generate(r)+"\n");puts JSON.pretty_generate(r.reject{|k,v|k==:regressionResults})
