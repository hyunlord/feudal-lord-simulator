require 'json'; require 'digest'
src='/tmp/astra-steward-r06-20261004/records/fixed-context-revised'
out=__dir__
before=Dir[src+'/*'].select{|f|File.file?(f)}.map{|f|[f,Digest::SHA256.file(f).hexdigest]}.to_h
script=File.read(src+'/validate.rb')
%w[FIXTURE_RESULTS NEGATIVE_RESULTS VALIDATION PARENT_CAPTURE_RESULTS].each{|name|script=script.gsub("File.write(r+'/#{name}.json'", "File.write('#{out}/REPLAY_#{name}.json'")}
eval(script,TOPLEVEL_BINDING,src+'/validate.rb',1)
raise 'candidate changed' unless before.all?{|f,sha|Digest::SHA256.file(f).hexdigest==sha}
proposal=JSON.parse(File.read(src+'/PROPOSAL.json'));schema=JSON.parse(File.read(src+'/CONTEXT.schema.json')); fixtures=JSON.parse(File.read(src+'/FIXTURES.json')).select{|f|f['expected']}
ind=[]
fixtures.each do |f|
 {'extra'=>1,'recordTick'=>9007199254740992,'sourceHead'=>'0'*40}.each do |key,value|
 c=Marshal.load(Marshal.dump(f['context'])); c[key]=value
 raise 'unsafe selected' unless select(proposal,c,f['identity'],schema).nil?
 ind << {id:f['id']+'.'+key,result:'fallback'}
 end
 c=Marshal.load(Marshal.dump(f['context'])); c['fields'][c['fields'].keys.first]='not_an_enum'
 raise 'unknown enum selected' unless select(proposal,c,f['identity'],schema).nil?
 ind << {id:f['id']+'.unknown_enum',result:'fallback'}
end
File.write(out+'/INDEPENDENT_RESULTS.json',JSON.pretty_generate({cases:ind.size,results:ind,candidateUnchanged:true,candidateHashes:before})+"\n")
