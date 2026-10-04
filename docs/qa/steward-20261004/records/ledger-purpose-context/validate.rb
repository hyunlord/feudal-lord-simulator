require_relative 'selector'
d=__dir__;schema=JSON.parse(File.read(d+'/RAW.schema.json'));results=[]
base={'status'=>'known','sourceHead'=>'5fb1aebfe735592c1424c947e88388d4ffe21742','campaignId'=>'campaign-test','entry'=>{'id'=>'ledger-000001','tick'=>1,'account'=>'cash','category'=>'promise_payment','amount'=>-120,'sourceRefs'=>[{'type'=>'claim','id'=>'claim-1','detail'=>'will_favour'},{'type'=>'actor','id'=>'estate:estate-neighbour-3'}]}}
run=lambda{|id,r,want,identity=nil|identity||=r.select{|k,_|%w[campaignId entry sourceHead].include?(k)};got=purpose_variant(r,identity,schema);raise id unless got==want;results<<{id:id,input:r,identity:identity,expected:want,actual:got}}
def cp(v);Marshal.load(Marshal.dump(v));end
positive=[base]
%w[pension debt_assumption debt_after_inheritance].each{|term|r=cp(base);r['entry']['sourceRefs'][0]={'type'=>'claim','id'=>'promise-2','detail'=>term};positive<<r}
%w[tenth_and_fifteenth confirmation].each{|detail|r=cp(base);r['entry']['category']='royal_subsidy';r['entry']['sourceRefs']=[{'type'=>'actor','id'=>'crown'},{'type'=>'claim','id'=>'royal_subsidy','detail'=>detail}];positive<<r}
positive.each_with_index do |r,i|
 want=['promise_payment.r06purpose.will_favour']+['promise_payment.r06purpose.kept']*3+['royal_subsidy.r06purpose.tax','royal_subsidy.r06purpose.confirmation'];run.call('positive'+i.to_s,r,want[i])
 reverse=cp(r);reverse['entry']['sourceRefs'].reverse!;run.call('reordered'+i.to_s,reverse,want[i])
 [0,1,-1.5,-9007199254740992,'-120',nil,false].each_with_index{|amount,j|x=cp(r);x['entry']['amount']=amount;run.call("amount#{i}-#{j}",x,nil)}
 %w[campaignId sourceHead entry].each{|k|identity=cp(r).select{|key,_|%w[campaignId entry sourceHead].include?(key)};identity[k]=nil;run.call("binding#{i}-#{k}",r,nil,identity)}
 ['','   ',"\n"].each_with_index{|v,j|x=cp(r);x['campaignId']=v;run.call("campaign#{i}-#{j}",x,nil)}
 x=cp(r);x['entry']['id']='ledger-000000';run.call('zeroid'+i.to_s,x,nil)
 x=cp(r);x['entry']['sourceRefs']*=2;run.call('duplicate'+i.to_s,x,nil)
 x=cp(r);x['entry']['sourceRefs'].find{|q|q['type']=='claim'}['detail']='unknown';run.call('detail'+i.to_s,x,nil)
 x=cp(r);x['entry']['sourceRefs'].find{|q|q['type']=='actor'}['id']='crown-other';run.call('actor'+i.to_s,x,nil)
 x=cp(r);x['entry']['sourceRefs'].find{|q|q['type']=='claim'}['id']=' ';run.call('claim'+i.to_s,x,nil)
end
[['claim-0','will_favour'],['promise-1','will_favour'],['claim-1','pension'],['promise-1','political_support'],['promise-01','pension']].each_with_index{|(id,detail),i|x=cp(base);x['entry']['sourceRefs'][0]={'type'=>'claim','id'=>id,'detail'=>detail};run.call('crosspurpose'+i.to_s,x,nil)}
source=JSON.parse(File.read(d+'/SOURCE_EVIDENCE.json'));source.each{|s|body=File.read('/Users/rexxa/fls-astra-steward/'+s['path']);raise 'sha' unless Digest::SHA256.hexdigest(body)==s['sha256'];s['spans'].each{|sp|raise 'span' unless body.lines[(sp['start']-1)...sp['end']].join==sp['text']}}
b=JSON.parse(File.read(d+'/BASELINE_REF.json'));raise 'baseline' unless Digest::SHA256.file(b['path']).hexdigest==b['sha256']
File.write(d+'/FIXTURE_RESULTS.json',JSON.pretty_generate(results)+"\n");File.write(d+'/VALIDATION.json',JSON.pretty_generate({cases:results.size,positive:results.count{|r|r[:actual]},fallback:results.count{|r|r[:actual].nil?},sourceFiles:source.size,sourceSpans:source.sum{|s|s['spans'].size},engineExecuted:false,canonicalModified:false})+"\n");puts "#{results.size} passed"
