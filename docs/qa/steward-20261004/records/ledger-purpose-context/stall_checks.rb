require_relative 'selector'
s=JSON.parse(File.read(__dir__+'/RAW.schema.json'));base=JSON.parse(File.read(__dir__+'/FIXTURE_RESULTS.json')).first['input'];base['entry']['category']='stall_fee';base['entry']['amount']=12;rows=[]
run=lambda{|id,r,want|i=r.select{|k,_|%w[campaignId sourceHead entry].include?(k)};got=purpose_variant(r,i,s);raise id unless got==want;rows<<{id:id,input:r,expected:want,actual:got}}
[ ['alehouse:2',nil,'alehouse'],['stalls:4',nil,'market'],['stalls:4',{'type'=>'right','id'=>'market-charter','detail'=>'stall_fee:500'},'market'] ].each_with_index do |(detail,right,key),i|
 r=Marshal.load(Marshal.dump(base));r['entry']['sourceRefs']=[{'type'=>'building','id'=>'building-original','detail'=>detail}];r['entry']['sourceRefs']<<right if right;run.call('positive'+i.to_s,r,'stall_fee.r06purpose.'+key)
 [0,-1,1.5,9007199254740992].each_with_index{|v,j|x=Marshal.load(Marshal.dump(r));x['entry']['amount']=v;run.call("amount#{i}-#{j}",x,nil)}
 ['alehouse:0','stalls:0','alehouse:1.5','stalls:01',"stalls:4\n",'unknown:1'].each_with_index{|v,j|x=Marshal.load(Marshal.dump(r));x['entry']['sourceRefs'][0]['detail']=v;run.call("detail#{i}-#{j}",x,nil)}
 x=Marshal.load(Marshal.dump(r));x['entry']['sourceRefs'][0]['id']=' ';run.call('blank'+i.to_s,x,nil)
end
File.write(__dir__+'/STALL_RESULTS.json',JSON.pretty_generate({cases:rows.size,rows:rows,engineExecuted:false})+"\n");puts "#{rows.size} stall cases passed"
