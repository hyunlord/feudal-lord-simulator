require 'json';require 'digest'
pkg='/tmp/astra-steward-r06-20261004/records/person-context-coverage';out=__dir__;repo='/Users/rexxa/fls-astra-steward'
require pkg+'/age_adapter'
p=JSON.parse(File.read(pkg+'/PROPOSALS.json'));src=JSON.parse(File.read(pkg+'/SOURCE_EVIDENCE.json'));src.each{|s|t=File.read(repo+'/'+s['path']);raise 'source hash' unless Digest::SHA256.hexdigest(t)==s['sha256'];s['spans'].each{|r|raise 'span' unless t.lines[r['start']-1..r['end']-1].join==r['text']}}
prior=JSON.parse(File.read('/tmp/astra-steward-r05-20261004/records/age-context-copy-proposal/ADDITIONS.json'))['additions'];raise 'counts' unless prior.sum{|v|v["variants"].size}==20&&p['variants'].size==13;raise 'template duplicate' unless (prior.map{|v|v['template']}&p['variants'].map{|v|v['template']}).empty?
# Load only pure selector definition, never the author's artifact-writing test driver.
code=File.read(pkg+'/check.rb');a=code.index('def selected(');b=code.index("\nresults=[]",a);eval(code[a...b],TOPLEVEL_BINDING,'author-pure-selector',1)
fixtures=JSON.parse(File.read(pkg+'/FIXTURE_RESULTS.json'));fixtures.each do |f|
r={'id'=>'fixture-record','tick'=>4000,'template'=>f['template'],'subject'=>{'type'=>'person','id'=>'fixture-person'}};v=selected(p['variants'],r,f['inputSnapshot'],f['capturedProposal']);raise f['id'] unless (v&&v['id'])==f['selected']
end
record={'id'=>'old','tick'=>4000,'template'=>'person.reeve','subject'=>{'type'=>'person','id'=>'p'}};s={'scenarioId'=>'core:campaign_market_town','tick'=>400000,'persons'=>{'people'=>[{'id'=>'p','birthYear'=>1275}],'past'=>[]}};age=HistoricalAgeProposal.read(record,s);raise 'current age leak' unless age['subjectAgeAtRecord']==26&&age['eventYear']==1301
s['persons']['past']<<s['persons']['people'].first.dup;raise 'duplicate' unless HistoricalAgeProposal.read(record,s)['status']=='unknown'
canonical='/tmp/astra-steward-r06-20261004/chronicle/variants.ko.json';c=JSON.parse(File.read(canonical));File.write(out+'/RESULT.json',JSON.pretty_generate({verdict:'DRAFT_PASS_WITH_EXPLICIT_INTEGRATION_BLOCKS',authorFixturesReplayed:fixtures.size,extraAgeChecks:2,sourceFilesChecked:src.size,priorAge20Reused:prior.sum{|v|v["variants"].size},newCandidates:p['variants'].size,canonicalShaNow:Digest::SHA256.file(canonical).hexdigest,authorBaselineSha:p['baselineSha256'],authorBaselineDrift:Digest::SHA256.file(canonical).hexdigest!=p['baselineSha256'],runtimeIntegration:false})+"\n")
puts File.read(out+'/RESULT.json')
