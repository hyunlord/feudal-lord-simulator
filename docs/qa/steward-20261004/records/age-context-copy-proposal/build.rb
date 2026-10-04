require 'json'
require 'digest'
root=File.dirname(__FILE__)
phrases={
 'person.fell_ill'=>['병을 얻었다.',true],
 'person.recovered'=>['앓던 병에서 회복했다.',true],
 'person.injured'=>['일을 하던 중 다쳤다.',false],
 'person.healed'=>['입었던 상처가 아물었다.',false],
 'person.pilgrimage'=>['순례길에 올랐다.',false],
 'person.returned'=>['순례에서 돌아왔다.',false]
}
leads={'child'=>'어린 시절, {ageAtRecord}살에 ','youth'=>'젊은 시절, {ageAtRecord}살에 ','adult'=>'{ageAtRecord}살에 ','elder'=>'나이 들어 {ageAtRecord}살에 '}
additions=phrases.map do |template,pair|
 tail,child=pair
 bands=child ? leads.keys : leads.keys.reject{|band|band=='child'}
 {template:template,variants:bands.map{|band|{id:template+'.age_proposal.'+band,priority:30,when:[{field:'context.subjectAgeBandAtRecord',op:'eq',value:band}],headline:leads[band]+tail,requiredSlots:['ageAtRecord'],retainFactLine:true}}}
end
additions.each do |group|
 minimum = %w[person.pilgrimage person.returned].include?(group[:template]) ? 18 : %w[person.injured person.healed].include?(group[:template]) ? 14 : 0
 group[:variants].each do |v|
  v[:when] << {field:'context.subjectAgeAtRecord',op:'gte',value:minimum}
  v[:when] << {field:'context.subjectAgeAtRecord',op:'lte',value:60} if %w[person.injured person.pilgrimage].include?(group[:template])
 end
end
base='/tmp/astra-steward-r05-20261004/chronicle/variants.ko.json'
payload={formatVersion:'age-context-proposal-v1',status:'NOT_INSTALLED_REQUIRES_CONTEXT_ADAPTER',baselineSha256:Digest::SHA256.file(base).hexdigest,canonicalModified:false,adapter:'../historical-age-adapter-proposal/adapter.rb',conditionSources:{'context.subjectAgeBandAtRecord'=>'known HistoricalAgeProposal.read output only; unknown never matches'},slots:{ageAtRecord:{source:'context.subjectAgeAtRecord',type:'nonnegative integer',render:'decimal integer',onMissing:'fallback to baseline'}},fallback:{renderer:'history.summary',arguments:['record','state'],required:true},additions:additions}
File.write(root+'/ADDITIONS.json',JSON.pretty_generate(payload)+"\n")
puts JSON.generate({templates:additions.size,candidateCount:additions.sum{|g|g[:variants].size}})
