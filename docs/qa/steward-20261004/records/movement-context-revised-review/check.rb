require 'json'
require 'digest'
review_out=__dir__
input=File.dirname(__dir__)+'/movement-context-revised'
review_original=File.dirname(__dir__)+'/movement-context'
canonical=File.dirname(File.dirname(__dir__))+'/chronicle/variants.ko.json'
hashes=lambda{|d|Dir.glob(d+'/**/*').select{|p|File.file?(p)}.sort.to_h{|p|[p,Digest::SHA256.file(p).hexdigest]}}
review_before=hashes.call(input).merge(hashes.call(review_original))
canonical_before=Digest::SHA256.file(canonical).hexdigest
code=File.read(input+'/validate.rb')
code=code.sub('root=__dir__;','root='+input.inspect+';')
code=code.gsub('File.write(root+', 'File.write(review_out+')
code=code.sub("require_relative 'negative_schema_checks'",'require '+(input+'/negative_schema_checks.rb').inspect)
eval(code,binding,input+'/validate.rb')
raise 'author artifact modified' unless review_before==hashes.call(input).merge(hashes.call(review_original))
raise 'canonical modified' unless Digest::SHA256.file(canonical).hexdigest==canonical_before
validation=JSON.parse(File.read(review_out+'/VALIDATION.json'))
verdicts=[
 {'id'=>'house.withdrew.r06move.family_extinct','verdict'=>'CONDITIONAL_DRAFT_APPROVED','reason'=>'도시의 현재 인물 목록에 가문 태그 인물이 없고 대기 후계 후보가 없다는 범위로 한정. 지도 밖 친족 전체 소멸·전원 역병 사망 주장 제거. lordship.ts:47-53 및 실제 seasonal 경로 캡처 조건과 정합.'},
 {'id'=>'house.withdrew.r06move.decline_elapsed','verdict'=>'CONDITIONAL_DRAFT_APPROVED','reason'=>'정해진 기한을 삭제하고 쇠퇴 지속 뒤 교체만 서술. lordship.ts:188-190의 내부 경과 tick을 대외 약속으로 만들지 않음.'},
 {'id'=>'house.resettled.r06move.split','verdict'=>'CONDITIONAL_DRAFT_APPROVED','reason'=>'집집마다를 이주민 가구로 바꾸어 모든 집에 배분했다는 주장 제거. lordship.ts:244-250은 남은 빵이 있는 동안 일부 가구에만 배분할 수 있음.'}
]
result={'status'=>'13_CONDITIONAL_DRAFT_PASSES_0_EDITORIAL_HOLDS','templates'=>5,'variants'=>13,'resolvedHolds'=>verdicts,'unchangedOtherHeadlines'=>10,'onlyHeadlineChanges'=>3,'selectionFixtures'=>validation['fixtures'],'schemaNegative'=>validation['negativeSchemaCases'],'extraFieldCases'=>validation['schemaGateRegressionCases'],'envelopeCases'=>validation['adversarialEnvelope'],'nameContractCases'=>validation['nameContractCases'],'sourceFiles'=>validation['sourceFiles'],'sourceSpans'=>validation['sourceSpans'],'canonicalSha256'=>canonical_before,'canonicalUnchanged'=>true,'authorArtifactsUnchanged'=>true,'runtimeExecuted'=>false,'captureAdapterImplemented'=>false,'draftCompletionRequiresEngineInstallation'=>false}
File.write(review_out+'/RESULT.json',JSON.pretty_generate(result)+"\n")
File.write(review_out+'/INPUT_HASHES.json',JSON.pretty_generate(review_before)+"\n")
puts JSON.pretty_generate(result)
