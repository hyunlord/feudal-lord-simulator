require 'json'
require 'digest'
require 'time'
B='/tmp/astra-steward-r08-20261004'; R=B+'/long-run/seed3-fen-fixed-growth'; L=B+'/records/fen-run-lifecycle'; O=B+'/records/fen-run-review'; REPO='/Users/rexxa/fls-astra-steward'; OFFICIAL=REPO+'/.remote-runs/astra-steward-seed3-fen-growth-r08-5fb1aeb'
def json(p); JSON.parse(File.read(p)); end
def rows(p); File.readlines(p).reject{|l|l.strip.empty?}.map{|l|JSON.parse(l)}; end
def sha(p); Digest::SHA256.file(p).hexdigest; end
def manifest(p); File.readlines(p).map{|l|l.chomp.split(/\s+/,2)}; end
checks=[]
check=lambda{|name,ok,detail=nil|checks<<{name:name,pass:ok,detail:detail}}
manifest(R+'/SHA256SUMS').each{|h,p|check.call('frozen:'+p,sha(R+'/'+p)==h)}
summary=json(R+'/summary.json'); meta=json(R+'/metadata.json'); annual=rows(R+'/years.jsonl'); commands=rows(R+'/commands.jsonl'); saves=rows(R+'/save-checks.jsonl'); controls=json(R+'/controls.json')['frozen']
check.call('metadata equals summary provenance',meta.all?{|k,v|summary[k]==v})
check.call('config identity',summary['head']=='5fb1aebfe735592c1424c947e88388d4ffe21742' && summary['config'].values_at('seed','land','mode','policy','years')==[3,'core:fen_drainage','fixed','growth',150])
check.call('target complete',summary.values_at('stoppedFor','completedTarget','targetYear')==['target_year',true,1450] && summary['final'].values_at('tick','year','population')==[600000,1450,470])
check.call('annual continuous',annual.size==150 && annual.each_with_index.all?{|r,i|r.values_at('periodYear','year','tick','throughTickExclusive')==[1300+i,1301+i,4000*(i+1),4000*(i+1)]})
check.call('annual controls fixed',annual.all?{|r|r.values_at('policy','dues','subsidies')==['growth',1000,[]]})
check.call('commands ordered bounded',commands.each_cons(2).all?{|a,b|a['tick']<=b['tick']} && commands.all?{|c|c['tick']>=0 && c['tick']<600000})
check.call('commands before after controls',commands.all?{|c|c['controlsBefore']==controls && c['controlsAfter']==controls})
annual.each_with_index do |a,i|
  cs=commands.select{|c|c['tick']>=i*4000 && c['tick']<(i+1)*4000}; changed=cs.select{|c|c['stateReferenceChanged']}; kinds=changed.each_with_object(Hash.new(0)){|c,h|h[c['kind']]+=1}
  check.call('year command arithmetic:'+a['periodYear'].to_s,a['attemptedCommands']==cs.size && a['changedStateCommands']==changed.size && a['decisionsByKind']==kinds && a['asked']+a['own']==changed.size)
end
check.call('last annual all summary fields',summary['final'].all?{|k,v|annual.last[k]==v})
check.call('codec logs38',saves.size==38 && saves.all?{|r|r['exactJsonRoundTrip']==true && r['stateHash'].match?(/\A[0-9a-f]{64}\z/) && r['stateHash']==r['decodedHash']})
expected=[['start',0]]+(1..30).flat_map{|n|y=1300+n*5; [['latest',n*20000]]+([1325,1350,1375,1400,1425,1450].include?(y) ? [['year-'+y.to_s,n*20000]] : [])}+[['final',600000]]
check.call('codec schedule exact',saves.map{|r|[r['label'],r['tick']]}==expected)
states={}; artifacts=[]
Dir.glob(R+'/*.fls.json').sort.each do |p|
  bytes=File.read(p); envelope=JSON.parse(bytes); raw=bytes[/,"state":(.*)\}\s*\z/m,1]; raise 'state raw extraction failed' unless raw && JSON.parse(raw)==envelope['state']; state=envelope['state']; h=Digest::SHA256.hexdigest(raw); label=File.basename(p,'.fls.json'); states[label]=state
  log=saves.reverse.find{|r|r['label']==label}
  check.call('saved state hash/bytes:'+label,log && h==log['stateHash'] && File.size(p)==log['bytes'] && envelope['tick']==state['tick'] && log['tick']==state['tick'])
  check.call('save controls/identity:'+label,state['seed']==3 && state['archetypeId']=='core:fen_drainage' && state['scenarioId']=='core:campaign_market_town' && state['agency'].values_at('policy','duesPermille','subsidies')==['growth',1000,[]])
  artifacts<<{file:File.basename(p),tick:state['tick'],fileSha256:sha(p),stateRawSha256:h,createdAt:envelope['createdAt'],savedAt:envelope['savedAt'],checksum:envelope['checksum']}
end
check.call('opening tick zero',states['start']['tick']==0)
check.call('summary raw final hash',artifacts.find{|a|a[:file]=='final.fls.json'}[:stateRawSha256]==summary['stateSha256'])
check.call('same final state distinct envelopes',%w[latest year-1450].all?{|k|states[k]==states['final'] && sha(R+'/'+k+'.fls.json')!=sha(R+'/final.fls.json')})
s=states['final']; rawmetrics={'population'=>s['population'],'treasury'=>s['treasuryCoin'],'timber'=>s['treasuryTimber'],'houseRecords'=>s['houses'].size,'inhabited'=>s['houses'].count{|h|h['residents']>0},'livingTownPeople'=>s['persons']['people'].count{|p|p['householdId']!='manor'},'historyRecordsRetained'=>s['history']['records'].size,'historyNextOrdinal'=>s['history']['nextOrdinal']}
rawmetrics['retainedDeathsByCause']=s['persons']['past'].reject{|p|p['alive']}.each_with_object(Hash.new(0)){|p,h|h[p['deathCause']||'unspecified']+=1}
rawmetrics['stocks']=s['buildings'].each_with_object(Hash.new(0)){|b,h|b['inventory'].each{|k,v|h[k]+=v}}
rawmetrics['buildings']=s['buildings'].each_with_object(Hash.new(0)){|b,h|h[b['kind']]+=1}
check.call('summary selected independent state metrics',rawmetrics.all?{|k,v|summary['final'][k]==v},rawmetrics)
check.call('house residents population',s['houses'].sum{|h|h['residents']}==470)
check.call('final cash ledger entries and rollups',s['ledger']['entries'].select{|e|e['account']=='cash'}.sum{|e|e['amount']}+s['ledger']['rollups'].select{|r|r['account']=='cash'}.sum{|r|r['byCategory'].values.sum}==s['treasuryCoin'])
progress=File.readlines(R+'/run.log').select{|l|l.start_with?('{"tick"')}.map{|l|JSON.parse(l)}
check.call('1000tick progress600',progress.size==600 && progress.each_with_index.all?{|p,i|p['tick']==(i+1)*1000 && p['findings']==0})
%w[exit-code timing.env run.log].each{|f|check.call('official fetched '+f,sha(R+'/'+f)==sha(OFFICIAL+'/'+f))}
check.call('official exit0',File.read(OFFICIAL+'/exit-code').strip=='0')
check.call('official nice19 command',File.read(OFFICIAL+'/run.log').include?('nice -n 19 node_modules/.bin/tsx output/steward-probe-v3/stewardProbe.ts --seed 3 --land core:fen_drainage --mode fixed --policy growth --years 150'))
check.call('scope dead recorded',File.read(L+'/END_SCOPE.txt').include?('ActiveState=inactive') && File.read(L+'/END_SCOPE.txt').include?('SubState=dead'))
{'EXECUTION_INPUT_SHA256SUMS'=>25,'FULL_SOURCE_DURING_SHA256SUMS'=>1095,'SOURCE_BEFORE_SHA256SUMS'=>26}.each do |f,n|
  ms=manifest(L+'/'+f); bad=ms.reject{|h,p|File.file?(REPO+'/'+p) && sha(REPO+'/'+p)==h};check.call('local current pins:'+f,ms.size==n && bad.empty?,{count:ms.size,mismatch:bad})
end
{'REMOTE_INPUT_CHECK.txt'=>25,'REMOTE_INPUT_AFTER_CHECK.txt'=>25,'REMOTE_FULL_SOURCE_DURING_CHECK.txt'=>1095,'REMOTE_FULL_SOURCE_AFTER_CHECK.txt'=>1095}.each{|f,n|ls=File.readlines(L+'/'+f);check.call('recorded remote checks:'+f,ls.size==n && ls.all?{|l|l.end_with?(": OK\n")})}
summary['verifiedSource']['sourceSha256'].each{|p,h|check.call('summary source:'+p,sha(REPO+'/'+p)==h)}
File.write(O+'/CHECKS.json',JSON.pretty_generate({at:Time.now.iso8601,checks:checks,pass:checks.all?{|c|c[:pass]},artifacts:artifacts,commands:commands.size,changedCommands:commands.count{|c|c['stateReferenceChanged']},progressRows:progress.size,observerSeconds:summary['seconds'],codecLogCount:saves.size,sourceScope:'26 prelaunch pins,25 execution inputs;1095 full-src inventory first captured during run, then after. No in-memory module trace.',limits:['codec not independently executed','hash extracted original raw JSON not Ruby reserialization','only9 retained save envelopes cover38 logged checkpoints','no second deterministic run','invariant sampling at1000ticks not everytick']})+"\n")
inputs=Dir.glob(R+'/*').select{|p|File.file?(p)}+Dir.glob(L+'/*').select{|p|File.file?(p)}+[REPO+'/output/steward-probe-v3/stewardProbe.ts',REPO+'/output/steward-probe-v3/probeMetrics.ts']
File.write(O+'/INPUT_PINS.json',JSON.pretty_generate(inputs.map{|p|{path:p,bytes:File.size(p),sha256:sha(p)}})+"\n")
puts JSON.generate({pass:checks.all?{|c|c[:pass]},checks:checks.size,fail:checks.reject{|c|c[:pass]},commands:commands.size,changed:commands.count{|c|c['stateReferenceChanged']},artifacts:artifacts.size})
