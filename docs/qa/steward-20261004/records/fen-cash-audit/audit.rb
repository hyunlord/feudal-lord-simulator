require 'json'
require 'digest'
ROOT='/tmp/astra-steward-r08-20261004'
OUT=File.join(ROOT,'records/fen-cash-audit')
paths={fen:'long-run/seed3-fen-fixed-growth',open:'inherited/R07/long-run/seed3-open-fixed-growth'}
inputs=[]
data=paths.to_h do |name,dir|
 states=%w[start final].to_h do |stage|
  path=File.join(ROOT,dir,"#{stage}.fls.json"); inputs << {path:path,sha256:Digest::SHA256.file(path).hexdigest}
  [stage,JSON.parse(File.read(path)).fetch('state')]
 end
 s=states['start']; f=states['final']; ledger=f.fetch('ledger'); es=ledger.fetch('entries').select{|e|e['account']=='cash'}; rs=ledger.fetch('rollups').select{|r|r['account']=='cash'}
 ec=Hash.new(0); rc=Hash.new(0)
 es.each{|e| ec[e['category']]+=e['amount']}; rs.each{|r|r['byCategory'].each{|c,a|rc[c]+=a}}
 cats=(ec.keys|rc.keys).sort.to_h{|c|[c,{retainedEntryNet:ec[c],rollupNet:rc[c],totalNet:ec[c]+rc[c],retainedPositive:es.select{|e|e['category']==c&&e['amount']>0}.sum{|e|e['amount']},retainedNegative:es.select{|e|e['category']==c&&e['amount']<0}.sum{|e|e['amount']}}]}
 estate=es.select{|e|e['category']=='estate_income'}.group_by{|e|JSON.generate(e['sourceRefs'])}.map{|refs,rows|{sourceRefs:JSON.parse(refs),net:rows.sum{|e|e['amount']},count:rows.size}}
 checks={entryIdsUnique:ledger['entries'].map{|e|e['id']}.uniq.size==ledger['entries'].size,rollupIntervalsValid:rs.all?{|r|r['periodStart']<r['periodEnd']},rollupOverlapAbsent:rs.combination(2).none?{|a,b|a['periodStart']<b['periodEnd']&&b['periodStart']<a['periodEnd']},entryRollupOverlapAbsent:es.none?{|e|rs.any?{|r|e['tick']>=r['periodStart']&&e['tick']<r['periodEnd']}},integerAmounts:es.all?{|e|e['amount'].is_a?(Integer)}&&rs.all?{|r|r['byCategory'].values.all?{|v|v.is_a?(Integer)}},cashEqualsTreasury:cats.values.sum{|c|c[:totalNet]}==f['treasuryCoin'],startLedgerAbsent:!s.key?('ledger'),openingMatchesStart:cats.fetch('opening_balance')[:totalNet]==s['treasuryCoin'],sameFinalTick:f['tick']==600000}
 raise checks.inspect unless checks.values.all?
 [name,{startTick:s['tick'],finalTick:f['tick'],seed:f['seed'],archetypeId:f['archetypeId'],startTreasury:s['treasuryCoin'],finalTreasury:f['treasuryCoin'],netChange:f['treasuryCoin']-s['treasuryCoin'],entryCount:es.size,entryTickRange:es.map{|e|e['tick']}.minmax,rollupCount:rs.size,rollupRange:[rs.map{|r|r['periodStart']}.min,rs.map{|r|r['periodEnd']}.max],categories:cats,estateRetainedBySources:estate,cashEntries:es,cashRollups:rs,checks:checks}]
end
cats=(data[:fen][:categories].keys|data[:open][:categories].keys).sort
rows=cats.map{|c|f=data[:fen][:categories].dig(c,:totalNet)||0;o=data[:open][:categories].dig(c,:totalNet)||0;{category:c,fenNet:f,openNet:o,difference:f-o}}
delta=data[:fen][:finalTreasury]-data[:open][:finalTreasury]
raise 'delta mismatch' unless rows.sum{|r|r[:difference]}==delta
result={scope:'cash account entries + signed rollups; no engine execution',runs:data,comparison:{direction:'fen minus open',treasuryDifference:delta,categoryDifferenceSum:rows.sum{|r|r[:difference]},unassignedDifference:delta-rows.sum{|r|r[:difference]},categories:rows}}
File.write(File.join(OUT,'DATA.json'),JSON.pretty_generate(result)+"\n")
File.write(File.join(OUT,'INPUT_SHA256.json'),JSON.pretty_generate(inputs)+"\n")
puts JSON.pretty_generate(result[:comparison]); puts data.transform_values{|d|d.reject{|k,_|[:categories,:cashEntries,:cashRollups].include?(k)}}.to_json
