require 'json'
require 'digest'
require 'open3'
out=__dir__
input=File.dirname(out)+'/ledger-lawsuit-revised'
original=File.dirname(out)+'/ledger-lawsuit-context'
hashes=->(d){Dir.children(d).sort.to_h{|f|[f,Digest::SHA256.file(d+'/'+f).hexdigest]}}
before=hashes.call(input)
original_before=hashes.call(original)
logs=[]
%w[validate.rb regression.rb].each do |file|
 code=File.read(input+'/'+file).sub("require_relative 'selector'",'require '+(input+'/selector.rb').inspect)
 code=code.gsub('__dir__',input.inspect)
 code=code.gsub('File.write(d+', 'File.write('+out.inspect+'+')
 code=code.gsub('File.write('+input.inspect+'+', 'File.write('+out.inspect+'+')
 stdout,stderr,status=Open3.capture3('ruby','-e',code)
 logs<<{'script'=>file,'exit'=>status.exitstatus,'stdout'=>stdout,'stderr'=>stderr}
 raise file unless status.success?
end
require input+'/selector'
schema=JSON.parse(File.read(input+'/RAW.schema.json'))
prior=JSON.parse(File.read(File.dirname(out)+'/ledger-lawsuit-review/ADVERSARIAL_RESULTS.json'))
results=prior.map do |entry|
 raw=entry['input']; identity=raw.select{|k,_|%w[campaignId sourceHead entry].include?(k)}
 got=lawsuit_variant(raw,identity,schema)
 raise 'prior malformed allowed '+entry['id'] unless got.nil?
 {'id'=>entry['id'],'selected'=>got,'reason'=>entry['id']=='claim_equals_suit' ? 'New claim-N restriction grounded in estates.ts producers; arbitrary suit-3 claim ID now deliberately falls back' : 'Previous negative input rejected'}
end
raise 'proposal altered' unless File.binread(input+'/PROPOSAL.json')==File.binread(original+'/PROPOSAL.json')
raise 'revised altered' unless hashes.call(input)==before
raise 'original altered' unless hashes.call(original)==original_before
validation=JSON.parse(File.read(out+'/VALIDATION.json'))
regression=JSON.parse(File.read(out+'/REGRESSION_RESULTS.json'))
result={'status'=>'4_CONDITIONAL_DRAFT_PASSES_0_REVIEW_HOLDS','draftApproved'=>4,'selectorFindingsResolved'=>['BLANK_CAMPAIGN_OR_CLAIM_ID','ZERO_LEDGER_ORDINAL'],'originalFixtures'=>validation['cases'],'originalPositive'=>validation['positive'],'originalFallback'=>validation['fallback'],'regressionCases'=>regression['cases'],'priorAdversarialCasesReplayed'=>results.size,'sourceFiles'=>validation['sourceFiles'],'sourceSpans'=>validation['sourceSpans'],'proposalByteIdentical'=>true,'proposalSha256'=>Digest::SHA256.file(input+'/PROPOSAL.json').hexdigest,'authorArtifactsUnchanged'=>true,'runtimeExecuted'=>false,'engineInstalled'=>false,'moneyFormatterExecuted'=>false}
{'RESULT.json'=>result,'RERUN_LOG.json'=>logs,'PRIOR_COUNTEREXAMPLES.json'=>results,'INPUT_HASHES.json'=>before}.each{|f,d|File.write(out+'/'+f,JSON.pretty_generate(d)+"\n")}
puts JSON.pretty_generate(result)
