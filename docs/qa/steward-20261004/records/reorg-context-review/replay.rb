require 'digest'
source='/tmp/astra-steward-r06-20261004/records/reorg-context/validate.rb';original=File.read(source);before=Dir[File.dirname(source)+'/*'].select{|f|File.file?(f)}.map{|f|[f,Digest::SHA256.file(f).hexdigest]}.to_h
code=original.gsub("File.write(d+'/FIXTURE_RESULTS.json'", "File.write('/tmp/astra-steward-r06-20261004/records/reorg-context-review/REPLAY_FIXTURE_RESULTS.json'").gsub("File.write(d+'/VALIDATION.json'", "File.write('/tmp/astra-steward-r06-20261004/records/reorg-context-review/REPLAY_VALIDATION.json'")
raise 'wrapper' unless code!=original
eval(code,TOPLEVEL_BINDING,source,1)
raise 'source mutated' unless before.all?{|f,h|Digest::SHA256.file(f).hexdigest==h}
