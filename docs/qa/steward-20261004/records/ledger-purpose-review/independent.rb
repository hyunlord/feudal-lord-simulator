require 'json'
require 'digest'
root=File.dirname(__FILE__); draft=File.expand_path('../ledger-purpose-context',root)
require File.join(draft,'selector')
schema=JSON.parse(File.read(File.join(draft,'RAW.schema.json')))
base={'status'=>'known','sourceHead'=>'5fb1aebfe735592c1424c947e88388d4ffe21742','campaignId'=>'review-campaign','entry'=>{'id'=>'ledger-000001','tick'=>1,'account'=>'cash','category'=>'promise_payment','amount'=>-120,'sourceRefs'=>[{'type'=>'claim','id'=>'claim-1','detail'=>'will_favour'},{'type'=>'actor','id'=>'estate:estate-neighbour-3'}]}}
copy=->(x){Marshal.load(Marshal.dump(x))};results=[]
run=->(id,x,want,identity=nil){identity||=x.select{|k,_|%w[campaignId sourceHead entry].include?(k)};got=purpose_variant(x,identity,schema);results<<{id:id,expected:want,actual:got,pass:got==want};raise id unless got==want}
valid=[]
valid<<[copy.call(base),'promise_payment.r06purpose.will_favour']
%w[pension debt_assumption debt_after_inheritance].each{|term|x=copy.call(base);x['entry']['sourceRefs'][0]={'type'=>'claim','id'=>'promise-123','detail'=>term};valid<<[x,'promise_payment.r06purpose.kept']}
%w[confirmation tenth_and_fifteenth].each{|purpose|x=copy.call(base);x['entry']['category']='royal_subsidy';x['entry']['sourceRefs']=[{'type'=>'claim','id'=>'royal_subsidy','detail'=>purpose},{'type'=>'actor','id'=>'crown'}];valid<<[x,"royal_subsidy.r06purpose.#{purpose=='confirmation' ? 'confirmation' : 'tax'}"]}
valid.each_with_index do |(x,want),n|
 run.call("valid-#{n}",x,want)
 x.keys.each{|key|v=copy.call(x);v.delete(key);run.call("missing-root-#{n}-#{key}",v,nil)}
 x['entry'].keys.each{|key|v=copy.call(x);v['entry'].delete(key);run.call("missing-entry-#{n}-#{key}",v,nil)}
 [nil,[],false,'known',{}].each_with_index{|bad,j|run.call("wrong-root-#{n}-#{j}",bad,nil,{})}
 [nil,[],false,'entry',{}].each_with_index{|bad,j|v=copy.call(x);v['entry']=bad;run.call("wrong-entry-#{n}-#{j}",v,nil)}
 [-1,0.5,9007199254740992,'1',nil,false].each_with_index{|bad,j|v=copy.call(x);v['entry']['tick']=bad;run.call("bad-tick-#{n}-#{j}",v,nil)}
 %w[ledger-000000 ledger-1 ledger-0000001 ledger-9007199254740992].each{|bad|v=copy.call(x);v['entry']['id']=bad;run.call("bad-id-#{n}-#{bad}",v,nil)}
 %w[campaignId sourceHead].each{|field|v=copy.call(x);binding=copy.call(v).select{|k,_|%w[campaignId sourceHead entry].include?(k)};binding[field]='other';run.call("cross-binding-#{n}-#{field}",v,nil,binding)}
 %w[id tick amount sourceRefs].each{|field|binding=copy.call(x).select{|k,_|%w[campaignId sourceHead entry].include?(k)};binding['entry'][field]=nil;run.call("cross-record-#{n}-#{field}",x,nil,binding)}
 v=copy.call(x);v['entry']['extra']=true;run.call("extra-entry-#{n}",v,nil)
 v=copy.call(x);v['entry']['sourceRefs'][0]['extra']=true;run.call("extra-ref-#{n}",v,nil)
 v=copy.call(x);v['entry']['category']='stall_fee';run.call("unsupported-stall-#{n}",v,nil)
 v=copy.call(x);v['status']='unknown';run.call("unknown-#{n}",v,nil)
end
# Partial confirmation payment must not be interpreted as the nominal 200d payment.
x=copy.call(valid[4][0]);x['entry']['amount']=-1;run.call('one-penny-partial-confirmation',x,'royal_subsidy.r06purpose.confirmation')
File.write(File.join(root,'INDEPENDENT_FIXTURES.json'),JSON.pretty_generate(results)+"\n")
puts "#{results.length} independent selector checks passed"
