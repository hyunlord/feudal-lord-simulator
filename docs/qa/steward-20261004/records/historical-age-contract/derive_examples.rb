require 'json'
require 'digest'
repo='/Users/rexxa/fls-astra-steward'
out=File.dirname(__FILE__)
path=repo+'/.remote-runs/astra-steward-N04-r03-5fb1aeb/N04-chalk-2-full/year-1450.fls.json'
s=JSON.parse(File.read(path))['state']
raise 'scenario mismatch' unless s['scenarioId']=='core:campaign_market_town'
allow=%w[born married arrived steward came_of_age occupation reeve bailiff fell_ill injured expecting pilgrimage recovered healed returned died left_town].map{|x|'person.'+x}
deny=%w[burnt rebuilt left resettled leaving move_in emptied level_up level_down stayed hungry fed water water_lost grew shrank].map{|x|'person.'+x}
pools={'people'=>s.dig('persons','people'),'past'=>s.dig('persons','past'),'factions'=>s.dig('factions','people'),'estates'=>s.dig('estates','people')}
people=pools.flat_map{|pool,ps|(ps||[]).map{|p|[pool,p]}}
rows=s['history']['records'].select{|r|allow.include?(r['template']) && r.dig('subject','type')=='person'}.map do |r|
 matches=people.select{|_,p|p['id']==r['subject']['id']}
 next unless matches.size==1
 pool,p=matches.first
 year=1300+r['tick'].floor/4000
 age=year-p['birthYear']
 next unless age>=0 && (!p['deathYear'] || year<=p['deathYear'])
 band=age<14 ? 'child' : age<=29 ? 'youth' : age<55 ? 'adult' : 'elder'
 {'record'=>r,'personEvidence'=>p.select{|k,_|%w[id birthYear deathYear leftYear alive].include?(k)},'pool'=>pool,'derived'=>{'eventYear'=>year,'ageAtRecord'=>age,'ageBandAtRecord'=>band},'biographyHeaderAgeWouldBe'=>(p['deathYear']||p['leftYear']||1450)-p['birthYear']}
end.compact
first=rows.find{|x|x['record']['template']=='person.fell_ill' && x['derived']['ageAtRecord']!=x['biographyHeaderAgeWouldBe']}
second=rows.find{|x|x['record']['template']=='person.came_of_age'} || rows.find{|x|x['record']['template']=='person.died'}
raise 'examples missing' unless first && second
house=s['history']['records'].find{|r|deny.include?(r['template'])&&r.dig('subject','type')=='person'}
result={'status'=>'offline JSON arithmetic only; not runtime adapter verification','sourceHead'=>'5fb1aebfe735592c1424c947e88388d4ffe21742','sourceSave'=>path,'sha256'=>Digest::SHA256.file(path).hexdigest,'scenario'=>'core:campaign_market_town','calendarEvidence'=>['src/engine/scenarioState.ts:67','src/content/scenario/coreScenarios.ts:100','src/content/balanceConfig.ts:35'],'examples'=>[first,second],'rejectedHouseholdExample'=>house,'individualAllowlist'=>allow,'householdDenylist'=>deny,'candidateRuntimeInstalled'=>false,'rawSaveEngineDecodedThisTask'=>false}
File.write(out+'/EXAMPLES.json',JSON.pretty_generate(result)+"\n")
puts JSON.generate({'examples'=>[first,second].map{|x|[x['record']['id'],x['record']['template'],x['derived'],x['biographyHeaderAgeWouldBe']]},'householdRejected'=>house && house['template'],'eligibleRetainedRecordCount'=>rows.size})
