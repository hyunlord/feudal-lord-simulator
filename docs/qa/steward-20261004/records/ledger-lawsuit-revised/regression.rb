require_relative 'selector'
schema=JSON.parse(File.read(__dir__+'/RAW.schema.json'));base=JSON.parse(File.read(__dir__+'/FIXTURE_RESULTS.json')).first['input'];rows=[]
check=lambda{|key,value,want|r=Marshal.load(Marshal.dump(base));case key;when 'campaignId';r[key]=value;when 'claim';r['entry']['sourceRefs'][0]['id']=value;else;r['entry']['id']=value;end;i=r.select{|k,_|%w[campaignId sourceHead entry].include?(k)};got=lawsuit_variant(r,i,schema);raise "#{key}: #{value.inspect}" unless got==want;rows<<{field:key,value:value,expected:want,actual:got}}
['   ',"\n","\t",''].each{|v|check.call('campaignId',v,nil)}
['   ',"\n",'claim-0','claim-01','claim-1 ',"claim-1\n",'claim-9007199254740992','suit-1'].each{|v|check.call('claim',v,nil)}
['ledger-000000','ledger-0000001','ledger-1',"ledger-000001\n",'ledger-9007199254740992'].each{|v|check.call('ledger',v,nil)}
%w[ledger-000001 ledger-999999 ledger-1000000 ledger-9007199254740991].each{|v|check.call('ledger',v,'lawsuit.r06context.filed')}
%w[claim-1 claim-999 claim-9007199254740991].each{|v|check.call('claim',v,'lawsuit.r06context.filed')}
['campaign-test','캠페인 1'].each{|v|check.call('campaignId',v,'lawsuit.r06context.filed')}
old=JSON.parse(File.read(__dir__+'/ORIGINAL_HASHES.json'));raise 'original changed' unless old.all?{|f,h|Digest::SHA256.file(f).hexdigest==h}
raise 'copy changed' unless File.read(__dir__+'/PROPOSAL.json')==File.read('/tmp/astra-steward-r06-20261004/records/ledger-lawsuit-context/PROPOSAL.json')
File.write(__dir__+'/REGRESSION_RESULTS.json',JSON.pretty_generate({cases:rows.size,rows:rows,originalUnchanged:true,proposalByteIdentical:true,engineExecuted:false})+"\n");puts "#{rows.size} regression cases passed"
