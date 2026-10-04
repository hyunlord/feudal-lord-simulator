require 'json'
require 'digest'
root=__dir__;round=File.dirname(File.dirname(root));repo='/Users/rexxa/fls-astra-steward'
write=lambda{|name,data|File.write(root+'/'+name,JSON.pretty_generate(data)+"\n")}
rows=[['ck_evt_013','audit','清'],['ck_evt_034','precedent','同'],['ck_evt_038','enforcement','判']]
texts=['清','同','判'].zip(['감사 처분을 묻던 안건은 사정이 달라져 거두어졌다.','반복 청원을 선례대로 처리할지 묻던 안건은 사정이 달라져 거두어졌다.','판결에 따른 점유 집행을 묻던 안건은 사정이 달라져 거두어졌다.']).to_h
variants=rows.map{|entry,id,key|{'id'=>'registry.invalid.r06.'+id,'priority'=>20,'when'=>[{'field'=>'params.entry','op'=>'eq','value'=>entry}],'headline'=>texts[key],'requiredSlots'=>[],'retainFactLine'=>true}}
write.call('ADDITIONS.json',{'schemaVersion'=>1,'status'=>'candidate_not_installed','sourceHead'=>`git -C #{repo} rev-parse HEAD`.strip,'baselineSha256'=>Digest::SHA256.file(round+'/chronicle/variants.ko.json').hexdigest,'additions'=>[{'template'=>'registry.invalid','variants'=>variants}]})
fixtures=[]
rows.each_with_index do |(entry,id,_),n|
 [{ 'entry'=>entry },{'entry'=>entry,'choice'=>''},{'entry'=>entry,'choice'=>'punish'},{'entry'=>entry,'reason'=>'death','lordId'=>'person-unverified','lord'=>'DO_NOT_CAPTURE_NAME'}].each_with_index{|params,i|fixtures<<{'id'=>"known_#{n}_#{i}",'params'=>params,'expectedVariant'=>'registry.invalid.r06.'+id}}
end
[{},nil,[],false,{'entry'=>nil},{'entry'=>13},{'entry'=>true},{'entry'=>[]},{'entry'=>{}},{'entry'=>''},{'entry'=>'ck_evt_999'},{'entry'=>'ck_evt_052'},{'entry'=>'ck_evt_013 '},{'entry'=>'CK_EVT_013'},{'entry'=>'ck_evt_013x'},{'entry'=>['ck_evt_013']}].each_with_index{|params,i|fixtures<<{'id'=>"fallback_#{i}",'params'=>params,'expectedVariant'=>nil}}
write.call('FIXTURES.json',fixtures)
spans={'src/engine/history.ts'=>[[1129,1144]],'src/engine/registry.ts'=>[[420,434]],'src/content/historyCopy.ko.ts'=>[[236,239]],'src/content/registry/draftEvents.ts'=>[[31,36],[57,67]],'src/content/registry/registryCopy.ko.ts'=>[[15,16],[23,26]],'src/engine/historyNames.ts'=>[[1,18],[43,54]],'docs/design/glossary.md'=>[[19,23],[191,191]]}
write.call('SOURCE_EVIDENCE.json',spans.map{|path,ranges|text=File.read(repo+'/'+path);{'path'=>path,'sha256'=>Digest::SHA256.hexdigest(text),'spans'=>ranges.map{|a,b|{'start'=>a,'end'=>b,'text'=>text.lines[(a-1)..(b-1)].join}}}})
File.write(root+'/variants.schema.json',File.read(round+'/chronicle/variants.schema.json'))
old=File.read('/tmp/astra-steward-r05-20261004/records/next-context-candidates/validate.rb');File.write(root+'/schema_validator.rb',old.split("root=__dir__;round=").first)
