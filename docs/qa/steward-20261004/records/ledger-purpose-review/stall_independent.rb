require 'json';require_relative '../ledger-purpose-context/selector'
d=File.dirname(__FILE__);s=JSON.parse(File.read(File.expand_path('../ledger-purpose-context/RAW.schema.json',d)));results=[]
b={'status'=>'known','sourceHead'=>'5fb1aebfe735592c1424c947e88388d4ffe21742','campaignId'=>'independent-stalls','entry'=>{'id'=>'ledger-000020','tick'=>20,'account'=>'cash','category'=>'stall_fee','amount'=>1,'sourceRefs'=>[{'type'=>'building','id'=>'historic-building:odd-id','detail'=>'alehouse:1'}]}}
copy=->(x){Marshal.load(Marshal.dump(x))};run=->(label,x,want,identity=nil){identity||=x.select{|k,_|%w[campaignId sourceHead entry].include?(k)};got=purpose_variant(x,identity,s);results<<{case:label,actual:got,expected:want};raise label unless want==got}
run.call('alehouse-positive',b,'stall_fee.r06purpose.alehouse')
m=copy.call(b);m['entry']['sourceRefs'][0]['detail']='stalls:9';run.call('market-positive',m,'stall_fee.r06purpose.market')
[0,1,999].each{|rate|x=copy.call(m);x['entry']['sourceRefs']<<{'type'=>'right','id'=>'old/right(id)','detail'=>"stall_fee:#{rate}"};run.call("right-rate#{rate}",x,'stall_fee.r06purpose.market');x['entry']['sourceRefs'].reverse!;run.call("right-reverse#{rate}",x,'stall_fee.r06purpose.market')}
[-1,0,0.5,9007199254740992,'1',nil,false].each_with_index{|v,i|x=copy.call(b);x['entry']['amount']=v;run.call("amount#{i}",x,nil)}
%w[alehouse:0 alehouse:-1 alehouse:01 alehouse:1.5 alehouse:9007199254740992 stalls:0 stalls:+1 alehouse:1junk unknown:1].each{|v|x=copy.call(b);x['entry']['sourceRefs'][0]['detail']=v;run.call(v,x,nil)}
%w[stall_fee:1000 stall_fee:-1 stall_fee:01 stall_fee:2.5].each{|v|x=copy.call(m);x['entry']['sourceRefs']<<{'type'=>'right','id'=>'r','detail'=>v};run.call(v,x,nil)}
x=copy.call(b);x['entry']['sourceRefs']<<{'type'=>'right','id'=>'r','detail'=>'stall_fee:100'};run.call('alehouse-with-market-right',x,nil)
[{},[],nil].each_with_index{|v,i|x=copy.call(b);x['entry']['sourceRefs']=v;run.call("bad-ref-container#{i}",x,nil)}
x=copy.call(b);x['entry']['sourceRefs']*=2;run.call('duplicate-building',x,nil)
binding=copy.call(b).select{|k,_|%w[campaignId sourceHead entry].include?(k)};binding['campaignId']='other';run.call('crosscampaign',b,nil,binding)
File.write(d+'/STALL_INDEPENDENT.json',JSON.pretty_generate(results)+"\n");puts "#{results.length} independent stall checks passed"
