require_relative 'selector'
d=__dir__;schema=JSON.parse(File.read(d+'/RAW.schema.json'));rows=[]
def copy(x);Marshal.load(Marshal.dump(x));end
base={'status'=>'known','sourceHead'=>'5fb1aebfe735592c1424c947e88388d4ffe21742','campaignId'=>'campaign-test','entry'=>{'id'=>'ledger-000041','tick'=>2400,'account'=>'cash','category'=>'lawsuit','amount'=>-60,'sourceRefs'=>[{'type'=>'claim','id'=>'claim-7','detail'=>'suit-3:filed'}]}}
run=lambda{|id,raw,want,identity=nil|identity||=raw.is_a?(Hash) ? raw.select{|k,_|%w[campaignId sourceHead entry].include?(k)} : {};got=lawsuit_variant(raw,identity,schema);raise id unless got==want;rows<<{id:id,input:raw,identity:identity,expected:want,actual:got}}
%w[filed hearing evidence:charter evidence:deed evidence:court_roll evidence:witnesses enforcing:1 enforcing:12].each{|detail|r=copy(base);r['entry']['sourceRefs'][0]['detail']='suit-3:'+detail;run.call(detail,r,'lawsuit.r06context.'+detail.split(':').first)}
%w[evidence patronage judged closed evidence:possession_years evidence:unknown enforcing:0 enforcing:-1 enforcing:01 enforcing:1.0 enforcing:9007199254740992].each{|detail|r=copy(base);r['entry']['sourceRefs'][0]['detail']='suit-3:'+detail;run.call('unknown_'+detail,r,nil)}
['suit-0:filed','suit-03:filed',"suit-3:filed\n",'suit-9007199254740992:filed','filed'].each{|detail|r=copy(base);r['entry']['sourceRefs'][0]['detail']=detail;run.call(detail,r,nil)}
[0,1,-1.5,-9007199254740992,'-60',nil,false].each_with_index{|amount,i|r=copy(base);r['entry']['amount']=amount;run.call('amount'+i.to_s,r,nil)}
%w[status sourceHead campaignId entry].each{|k|r=copy(base);r.delete(k);run.call('missing_'+k,r,nil)}
base['entry'].keys.each{|k|r=copy(base);r['entry'].delete(k);run.call('entry_missing_'+k,r,nil)}
[[],nil,[base['entry']['sourceRefs'][0]]*2].each_with_index{|refs,i|r=copy(base);r['entry']['sourceRefs']=refs;run.call('refs'+i.to_s,r,nil)}
%w[campaignId sourceHead].each{|k|identity=copy(base).select{|key,_|%w[campaignId sourceHead entry].include?(key)};identity[k]='other';run.call('binding_'+k,copy(base),nil,identity)}
%w[id tick amount sourceRefs].each{|k|identity=copy(base).select{|key,_|%w[campaignId sourceHead entry].include?(key)};identity['entry'][k]=nil;run.call('binding_entry_'+k,copy(base),nil,identity)}
%w[cash restricted arrears in_kind].each{|account|next if account=='cash';r=copy(base);r['entry']['account']=account;run.call(account,r,nil)}
r=copy(base);r['unexpected']=true;run.call('extra',r,nil)
r=copy(base);r['entry']['sourceRefs'][0]['type']='actor';run.call('wrong_ref',r,nil)
r=copy(base);r['entry']['sourceRefs'][0]['id']='';run.call('empty_claim',r,nil)
r=copy(base);r['status']='unknown';run.call('unknown',r,nil)
source=JSON.parse(File.read(d+'/SOURCE_EVIDENCE.json'));source.each{|s|body=File.read('/Users/rexxa/fls-astra-steward/'+s['path']);raise 'source' unless Digest::SHA256.hexdigest(body)==s['sha256'];s['spans'].each{|x|raise 'span' unless body.lines[(x['start']-1)...x['end']].join==x['text']}}
b=JSON.parse(File.read(d+'/BASELINE_REF.json'));raise 'baseline' unless Digest::SHA256.file(b['path']).hexdigest==b['sha256']
File.write(d+'/FIXTURE_RESULTS.json',JSON.pretty_generate(rows)+"\n")
File.write(d+'/VALIDATION.json',JSON.pretty_generate({cases:rows.size,positive:rows.count{|r|r[:actual]},fallback:rows.count{|r|r[:actual].nil?},sourceFiles:source.size,sourceSpans:source.sum{|s|s['spans'].size},runtimeExecuted:false,canonicalModified:false})+"\n")
puts "#{rows.size} reference selector cases passed"
