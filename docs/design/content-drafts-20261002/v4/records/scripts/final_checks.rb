require 'json'
require 'digest'
ROOT=File.expand_path('../..',__dir__).freeze
read=lambda{|p|JSON.parse(File.read(File.join(ROOT,p)))}
reg=read.call('registry-v4.json');a=read.call('records/inputs/A-registry.json')
adapter=read.call('ADAPTER_CONTRACTS.json');errors=[];checks=0
check=lambda{|ok,msg|checks+=1;errors<<msg unless ok}
central=adapter['centralGroups'].to_h{|g|[g['group']['id'],g['group']]}
reg['entries'].each do |r|
 old=a['entries'].find{|e|e['id']==r['id']}
 (old['unsupportedFilters']||[]).each{|f|check.call((r['unsupportedFilters']||[]).include?(f),"#{r['id']}: original unsupported filter removed")}
 old['choices'].each do |choice|
   next if choice['execution']=='existing_handler_after_binding'
   current=r['choices'].find{|c|c['id']==choice['id']}
   check.call(current && current['execution']==choice['execution'],"#{r['id']}/#{choice['id']}: block removed")
 end
 group_ref=r.dig('dedup','groupRef')
 check.call(central.key?(group_ref),"#{r['id']}: missing central group #{group_ref}") if group_ref
 check.call(File.directory?(File.join(ROOT,reg['sourceScopes'][r['id']])) ,"#{r['id']}: missing scope")
end
adapter['scopedContracts'].each do |doc|
 local=read.call("contracts/#{doc['scope']}/#{File.basename(doc['file'])}")
 check.call(local==doc['document'],"#{doc['scope']}: exported contract mismatch")
 (doc['document']['groups']||[]).each{|g|check.call(central[g['id']]==g,"central mirror mismatch #{g['id']}")}
end
manifest=read.call('records/SOURCE_MANIFEST.json')
manifest['files'].each{|f|check.call(Digest::SHA256.file(File.join(ROOT,f['archivedAs'])).hexdigest==f['sha256'],"source hash mismatch #{f['archivedAs']}")}
%w[a c].each do |id|
 r=reg['entries'].find{|e|e['id']=='ck_evt_013'}
 check.call(r['choices'].find{|c|c['id']==id}.dig('commands',0,'args','replacementId','binding')=='bound.successor.personId',"IR02 unresolved #{id}")
end
result={'status'=>errors.empty? ? 'PASS':'FAIL','assertions'=>checks,'errors'=>errors}
File.write(File.join(ROOT,'records/FINAL_CHECKS.json'),JSON.pretty_generate(result)+"\n")
puts JSON.pretty_generate(result)
exit(errors.empty? ? 0:1)
