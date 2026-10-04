require 'json';require 'digest'
b='/tmp/astra-steward-r06-20261004/records/person-life-revised';o='/tmp/astra-steward-r06-20261004/records/person-life-context';repo='/Users/rexxa/fls-astra-steward'
load b+'/capture.rb'
pkg=JSON.parse(File.read(b+'/PROPOSALS.json'));vs=pkg['variants']
raise 'text altered' unless File.binread(b+'/PROPOSALS.json')==File.binread(o+'/PROPOSALS.json')
raise '125 fixture changed' unless File.binread(b+'/ORIGINAL_125_FIXTURES.json')==File.binread(o+'/FIXTURE_RESULTS.json')
rows=JSON.parse(File.read(b+'/ORIGINAL_125_FIXTURES.json'))+JSON.parse(File.read(b+'/REGRESSION_RESULTS.json'))
raise 'count' unless rows.size==136
results=rows.map do |f|
 input=JSON.generate(f);ctx=capture(f['record'],f['before'],f['after'],8000);v=pick(vs,f['record']['template'],ctx)
 raise "failed #{f['id']}" unless (v&&v['id'])==f['expected']&&ctx==f['context']&&JSON.generate(f)==input
 {id:f['id'],passed:true,selected:v&&v['id']}
end
raise 'manifest' unless File.readlines(b+'/SHA256SUMS').all?{|l|sha,path=l.strip.split(/\s+/,2);Digest::SHA256.file(b+'/'+path).hexdigest==sha}
JSON.parse(File.read(b+'/INPUT_MANIFEST.json')).each{|f|raise 'immutable input' unless Digest::SHA256.file(f['path']).hexdigest==f['sha256']}
sources=JSON.parse(File.read(b+'/SOURCE_EVIDENCE.json'));sources.each{|s|text=File.read(repo+'/'+s['path']);raise 'source hash' unless Digest::SHA256.hexdigest(text)==s['sha256'];s['spans'].each{|q|raise 'span' unless text.lines[(q['start']-1)..(q['end']-1)].join==q['text']}}
base=b+'/baseline650.ko.json';live='/tmp/astra-steward-r06-20261004/chronicle/variants.ko.json';raise 'baseline' unless Digest::SHA256.file(base).hexdigest==pkg['baselineSha256']
blocks=vs.select{|v|v['status']=='BLOCKED_BASELINE_FACT_LINE_AND_CONTEXT'}.map{|v|v['id']};raise 'blocks' unless blocks.sort==%w[person.fed.r06life.brief person.fed.r06life.long]
report={status:'PASS_OFFLINE_CAPTURE_REVISION_18_CONDITIONAL_DRAFTS_2_FACTLINE_BLOCKS',originalFixtures:125,regressionFixtures:11,passed:results.size,candidateTextByteIdentical:true,original125ByteIdentical:true,sourceFiles:sources.size,sourceSpans:sources.sum{|s|s['spans'].size},baseline650Sha:Digest::SHA256.file(base).hexdigest,currentCanonicalSha:Digest::SHA256.file(live).hexdigest,blocks:blocks,results:results,runtimeExecuted:false,immutableRuntimeProvenanceVerified:false}
File.write(__dir__+'/RESULT.json',JSON.pretty_generate(report)+"\n");puts JSON.pretty_generate(report.reject{|k,v|k==:results})
