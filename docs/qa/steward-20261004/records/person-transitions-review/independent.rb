require 'json'
require 'digest'
D=__dir__; C=D+'/replay/records/person-transitions-context'
require C+'/schema_validator'; require C+'/capture'
def clone(x);Marshal.load(Marshal.dump(x));end
fixtures=JSON.parse(File.read(C+'/FIXTURES.json')); p=JSON.parse(File.read(C+'/PROPOSAL.json')); s=JSON.parse(File.read(C+'/CONTEXT.schema.json'))
results=[]
run=->(f,label,want){c=TransitionDraft.capture(f['record'],f['before'],f['after']);got=TransitionDraft.select(p,f['record'],c,s);raise label unless got==want;results<<{'case'=>label,'selected'=>got}}
f=clone(fixtures.find{|x|x['id']=='left.false'}); f['after']['past']<<{'id'=>'moved-earlier','householdId'=>'h1','role'=>'kin','alive'=>true};run.call(f,'past_alive_same_house_is_not_current','person.left_town.r06transition.absent')
f=clone(fixtures.find{|x|x['id']=='left.true'}); f['after']['people'][0]['householdId']='other';run.call(f,'other_house_person_not_same_house','person.left_town.r06transition.absent')
f=clone(fixtures.find{|x|x['id']=='married.h1'});f['before']['people']<<{'id'=>'earlier-spouse','householdId'=>'h1','role'=>'spouse','alive'=>true};run.call(f,'existing_other_spouse_rejected',nil)
f=clone(fixtures.find{|x|x['id']=='married.manor'});f['record']['actors']=[{'type'=>'household','id'=>'manor'}];run.call(f,'manor_actor_must_match_real_emitter',nil)
f=clone(fixtures.find{|x|x['id']=='move_in.1'});f['after']['houses'][0]['residents']=9007199254740992;run.call(f,'unsafe_resident_count',nil)
f=clone(fixtures.find{|x|x['id']=='move_in.1'});f['before']['people']=[{'id'=>'oldhead','householdId'=>'h1','role'=>'head','alive'=>true}];run.call(f,'after_head_overrides_before_head','person.move_in.r06transition.one')
f=clone(fixtures.find{|x|x['id']=='move_in.1'});f['record']['actors']<<{'type'=>'person','id'=>'unrelated'};run.call(f,'extra_actor_cannot_repair_household',nil)
f=clone(fixtures.find{|x|x['id']=='left.false'});f['before']['past']=[{'id'=>'past-person','householdId'=>'other','role'=>'kin','alive'=>false}];f['after']['past'].unshift(clone(f['before']['past'][0]));run.call(f,'unchanged_existing_past_prefix','person.left_town.r06transition.absent')
# Schema+binding gate: no subject replacement can reuse a valid captured envelope.
f=fixtures.find{|x|x['id']=='left.false'};c=TransitionDraft.capture(f['record'],f['before'],f['after']);c['subject']['id']='wrong';raise 'subject mismatch' unless TransitionDraft.select(p,fixtures.find{|x|x['id']=='left.true'}['record'],c,s).nil?;results<<{'case'=>'subject_mismatch_fallback','selected'=>nil}
original='/tmp/astra-steward-r06-20261004/records/person-transitions-context'; hashes=JSON.parse(File.read(D+'/INPUT_SHA256SUMS.json'));raise 'original mutated' unless hashes.all?{|name,h|Digest::SHA256.file(original+'/'+name).hexdigest==h}
File.write(D+'/INDEPENDENT_CASES.json',JSON.pretty_generate(results)+"\n")
puts "Independent cases: #{results.size}; original files unchanged: #{hashes.size}"
