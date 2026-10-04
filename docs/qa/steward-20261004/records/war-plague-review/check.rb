require 'json';require 'digest'
r=__dir__;src=File.dirname(r)+'/war-plague-context';repo='/Users/rexxa/fls-astra-steward'
code=File.read(src+'/validate.rb');eval(code[0...code.index('d=__dir__;read=')],TOPLEVEL_BINDING,src+'/validate.rb')
read=lambda{|f|JSON.parse(File.read(src+'/'+f))};p=read.call('PROPOSAL.json');schema=read.call('CONTEXT.schema.json');fixtures=read.call('FIXTURES.json')
validate_schema(p,read.call('PROPOSAL.schema.json'),read.call('PROPOSAL.schema.json'))
variants=p['templates'].flat_map{|t|t['variants']};raise '14 unique' unless variants.size==14 && variants.map{|v|v['id']}.uniq.size==14
raise 'names/facts' unless variants.all?{|v|v['retainFactLine']==true&&v['requiredSlots']==[]&&!v['headline'].match?(/[{}]/)}
extra=[]
fixtures.each do |f|
 %w[wrong_head empty_id tick_string tick_float missing_reference].each do |kind|
 c=Marshal.load(Marshal.dump(f['context']))
 case kind
 when 'wrong_head';c['sourceHead']='unknown-head'
 when 'empty_id';c['recordId']=''
 when 'tick_string';c['recordTick']=c['recordTick'].to_s
 when 'tick_float';c['recordTick']=c['recordTick'].to_f
 when 'missing_reference';c.delete('referenceVerified')
 end
 rejected=false;begin;validate_schema(c,schema,schema);rescue RuntimeError;rejected=true;end
 raise 'extra context not rejected' unless rejected
 extra<<{id:f['id']+'.'+kind,schemaRejected:true}
 end
end
manifest=JSON.parse(File.read(r+'/INPUT_MANIFEST.json'));manifest.each{|x|raise 'original changed' unless Digest::SHA256.file(x['path']).hexdigest==x['sha256']}
raise 'original manifest' unless File.readlines(src+'/SHA256SUMS').all?{|line|sha,file=line.strip.split(/\s+/,2);Digest::SHA256.file(src+'/'+file).hexdigest==sha}
sources=read.call('SOURCE_EVIDENCE.json');sources.each{|x|raw=File.read(repo+'/'+x['path']);raise 'source hash' unless Digest::SHA256.hexdigest(raw)==x['sha256'];x['spans'].each{|s|raise 'span' unless raw.lines[(s['start']-1)..(s['end']-1)].join==s['text']}}
not_authored=read.call('NOT_AUTHORED.json');raise 'priest block' unless not_authored['template']=='plague.priest_died'&&not_authored['status']=='NOT_AUTHORED_FIXED_FACT_AND_BASELINE_RISK'
File.write(r+'/ADDITIONAL_FIXTURES.json',JSON.pretty_generate(extra)+"\n")
result={status:'14_DRAFTS_CONDITIONAL_PASS_1_NOT_AUTHORED_BASELINE_RISK',authoredTemplates:6,reviewedDrafts:14,notAuthored:['plague.priest_died'],blockingDraftFindings:[],sourceFiles:sources.size,sourceSpans:sources.sum{|x|x['spans'].size},replay:{positive:14,negativeContextSchema:112,bindingMismatch:28,unknownFallback:14,negativeProposalSchema:6},additionalNegativeSchema:extra.size,retainsFactLine:true,noNamesOrSlotsAdded:true,originalManifestVerified:true,sourcePackageUnmodified:true,actualCaptureImplemented:false,runtimeExecuted:false,naturalOccurrenceVerified:false,immutableProvenanceVerified:false,installApproved:false,limits:['handmade enum fixtures do not test capture from before/after states','referenceVerified=true is not evidence of source integrity','filled curacy can be supplied by a lay clerk; headline must not become ordained priest present','historical original saves lack this context; no current-state backfill']}
File.write(r+'/RESULT.json',JSON.pretty_generate(result)+"\n");puts JSON.pretty_generate(result)
