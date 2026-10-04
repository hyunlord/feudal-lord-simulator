require 'json';require 'digest';require 'csv'
OUT=File.dirname(__FILE__);R07='/tmp/astra-steward-r07-20261004'
def j(p);JSON.parse(File.read(p));end
runs=[['N02-v3-open-1-growth','/tmp/astra-steward-r04-20261003'],['N03-v3-open-1-stability','/tmp/astra-steward-r04-20261003'],['N04-chalk-2-full','/tmp/astra-steward-r03-20261003'],['seed3-open-fixed-growth',R07],['seed3-open-fixed-stability',R07]]
@files=[]
def add(src,rel,tier,why)
 raise "missing #{src}" unless File.file?(src) && !File.symlink?(src)
 raise 'unsafe destination' if rel.start_with?('/') || rel.split('/').include?('..')
 @files<<{source:src,destination:'inherited/R07/'+rel,bytes:File.size(src),sha256:Digest::SHA256.file(src).hexdigest,tier:tier,rationale:why}
end
coverage=[];omitted=[]
runs.each do |id,root|
 dir=root+'/long-run/'+id;m=j(dir+'/metadata.json');start=j(dir+'/start.fls.json');final=j(dir+'/final.fls.json');annual=File.readlines(dir+'/years.jsonl').map{|l|JSON.parse(l)}
 raise 'annual period coverage' unless annual.map{|x|x['periodYear']}==(1300..1449).to_a && annual.map{|x|x['tick']}==(1..150).map{|n|n*4000}
 raise 'run bounds' unless start['tick']==0 && final['tick']==600000 && m.dig('config','years')==150
 past=final.dig('state','persons','past');dead=past.select{|p|p['alive']==false};raise 'duplicate death ID' unless dead.map{|p|p['id']}.uniq.size==dead.size
 policyCommands=File.readlines(dir+'/commands.jsonl').map{|l|JSON.parse(l)}.select{|r|r.to_json.include?('estate_policy') || r.to_json.include?('town_policy')}
 coverage<<{run:id,originRound:root==R07 ? 'R07' : File.basename(root),inheritedNotR08Execution:true,head:m['head'],config:m['config'].reject{|k,v|k=='output'},protocol:m['protocol'],policyArgumentApplied:m['policyArgumentApplied'],initialActualPolicy:start.dig('state','townAgency','policy') || start.dig('state','agency','policy'),finalActualPolicy:final.dig('state','townAgency','policy') || final.dig('state','agency','policy'),startTick:start['tick'],finalTick:final['tick'],annualRows:annual.size,periodYears:[1300,1449],boundaryYears:[1301,1450],population:final.dig('state','population'),recordedDeaths:dead.size,deathCauses:dead.group_by{|p|p['deathCause']}.transform_values(&:size),sourcePins:m.dig('verifiedSource','sourceSha256'),policyCommandSearchRows:policyCommands.size}
 %w[metadata.json summary.json years.jsonl commands.jsonl controls.json save-checks.jsonl start.fls.json final.fls.json runner-exit-code runner-timing.env SHA256SUMS].each{|f|add(dir+'/'+f,'long-run/'+id+'/'+f,'core','Exact run identity, boundaries, annual observations, command density, retained final persons/ledger and completion provenance; historical manifest may name omitted duplicates/checkpoints')}
 %w[registry-selections.jsonl registry-waits.jsonl registry-wait-outcomes.jsonl].each{|f|add(dir+'/'+f,'long-run/'+id+'/'+f,'core','Registry wait/selection evidence underlying command semantics') if File.exist?(dir+'/'+f)}
 [1325,1350,1375,1400,1425].each{|year|f="year-#{year}.fls.json";add(dir+'/'+f,'long-run/'+id+'/'+f,'checkpoint_extension','Needed only to independently repeat intermediate death-ID retention/land-holder checkpoint claims, not annual final cumulative recount')}
 %w[latest.fls.json year-1450.fls.json].each do |f|
  omitted<<{source:dir+'/'+f,bytes:File.size(dir+'/'+f),sha256:Digest::SHA256.file(dir+'/'+f).hexdigest,sameBytesAsFinal:Digest::SHA256.file(dir+'/'+f).hexdigest==Digest::SHA256.file(dir+'/final.fls.json').hexdigest,reason:'Duplicate terminal snapshot candidate; final retained; different envelope bytes not assumed same'}
 end
end
sets={
 'analysis/seed3-policy-comparison-r07'=>%w[REPORT.md DATA.json VALIDATION.json INPUT_SHA256.json SOURCE_SHA256.json SOURCE_FILES.json],
 'analysis/seed3-cash-attribution-r07'=>%w[REPORT.md DATA.json VALIDATION.json INPUT_SHA256.json SOURCE_SHA256.json],
 'analysis/seed3-growth-r07'=>%w[REPORT.md RESULT.json ANNUAL.json],
 'analysis/recorded-deaths-r07'=>%w[REPORT.md ANNUAL_CAUSES.csv ANNUAL_CAUSES.json SUMMARY.json EVENT_WINDOWS.json VALIDATION.json INPUT_SHA256SUMS.json],
 'analysis/decision-density'=>%w[README.md RESULT.json YEARS.tsv],
 'analysis/long-run-surfaces'=>%w[README.md RESULT.json PARENT_CHECK.json],
 'records/death-coverage-inventory'=>%w[REPORT.md RESULT.json INVENTORY.json SOURCE_EVIDENCE.json N02-v3-open-1-growth-deaths.json N03-v3-open-1-stability-deaths.json N04-chalk-2-full-deaths.json N02-v3-open-1-growth-annual.json N03-v3-open-1-stability-annual.json N04-chalk-2-full-annual.json],
 'records/death-coverage-review-r07'=>%w[REPORT.md REVIEW.json VALIDATION.json FINAL_EQUIVALENCE.json INPUT_SHA256SUMS ADDITIONAL_SOURCE_SHA256SUMS],
 'records/seed3-stability-completion-review-r07'=>%w[REPORT.md REVIEW.json CHECKS.json],
 'records/long-run-completion-r07'=>%w[CHECKER_SCOPE.md SEED3_GROWTH_RESULT.json SEED3_STABILITY_RESULT.json REVIEW_V2_PARENT_CHECK.json],
 'records/long-run-completion-r07/review-v2'=>%w[REPORT.md REVIEW.json COUNTEREXAMPLES.json],
 'graphs'=>%w[recorded-deaths-r07.svg seed3-policy-comparison-r07.svg seed3-growth-seed-comparison-r07.svg N02-annual-observations.svg README.md INHERITED_PROVENANCE.json],
 'records'=>%w[POLICY_COMPARISON_PARENT_CHECK_R07.json],
 'long-run-summary'=>%w[R06_INHERITED_PROVENANCE.json]
}
sets.each{|dir,names|names.each{|f|add(R07+'/'+dir+'/'+f,dir+'/'+f,'core','Curated report/table/vector graph/check and its scope/provenance; not a new execution')}}
raise 'destination collision' unless @files.map{|r|r[:destination]}.uniq.size==@files.size
pins=coverage.map{|r|r[:sourcePins]};raise 'source pin sets differ' unless pins.uniq.size==1
coverage.each{|r|r.delete(:sourcePins)}
File.write(OUT+'/COVERAGE.json',JSON.pretty_generate({status:'INHERITED_FIVE_COMPLETED_RUNS_NOT_R08_EXECUTION',runs:coverage,distinctSeeds:coverage.map{|r|r[:config]['seed']}.uniq,distinctLands:coverage.map{|r|r[:config]['land']}.uniq,annualRows:coverage.sum{|r|r[:annualRows]},nineSourcePinsIdentical:pins.first.size==9,sourcePins:pins.first})+"\n")
File.write(OUT+'/COPY_CANDIDATES.json',JSON.pretty_generate(@files)+"\n")
CSV.open(OUT+'/COPY_CANDIDATES.csv','w'){|csv|csv<<%w[source destination tier bytes sha256 rationale];@files.each{|r|csv<<%i[source destination tier bytes sha256 rationale].map{|k|r[k]}}}
File.write(OUT+'/OMITTED_DUPLICATES.json',JSON.pretty_generate(omitted)+"\n")
result={copied:false,engineExecuted:false,tiers:@files.group_by{|r|r[:tier]}.transform_values{|a|{files:a.size,bytes:a.sum{|r|r[:bytes]}}},fiveRuns:coverage.size,annualRows:coverage.sum{|r|r[:annualRows]},coverageChecksPassed:true}
File.write(OUT+'/RESULT.json',JSON.pretty_generate(result)+"\n");puts JSON.pretty_generate(result)
