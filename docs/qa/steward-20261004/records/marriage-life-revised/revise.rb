require 'json';require 'digest';require 'fileutils'
r=__dir__;orig=File.dirname(r)+'/marriage-life-context'
Dir.children(orig).reject{|f|%w[build.rb SHA256SUMS].include?(f)}.each{|f|FileUtils.cp(orig+'/'+f,r+'/'+f)}
FileUtils.cp(orig+'/SHA256SUMS',r+'/ORIGINAL_SHA256SUMS')
s=File.read(r+'/validate.rb');s.sub!("def select_candidate(package,template,context)\n", <<~CODE)
def select_candidate(package,template,context,context_schema)
 # Reject malformed adapter output before any conditional headline selection.
 begin
  validate_schema(context,context_schema,context_schema)
 rescue RuntimeError
  return nil
 end
CODE
s.gsub!("select_candidate(p,f['template'],f['context'])", "select_candidate(p,f['template'],f['context'],context_schema)")
s.gsub!("select_candidate(p,f['template'],c)", "select_candidate(p,f['template'],c,context_schema)")
s.sub!("# Name resolution contract fixture: frozen identity remains unchanged while display name is supplied at reading.", <<~CODE)
# Regression: the strict schema rejects extra historical causes before selection, for every positive enum branch.
gate_results=[]
fixtures.select{|f|f['expected']}.each do |f|
 %w[unexpected_field unexpected_envelope].each do |kind|
  c=Marshal.load(Marshal.dump(f['context']))
  if kind=='unexpected_field';c['fields']['unexpectedHistoricalCause']='invented';else;c['unexpectedHistoricalCause']='invented';end
  schema_rejected=false
  begin;validate_schema(c,context_schema,context_schema);rescue RuntimeError;schema_rejected=true;end
  selected=select_candidate(p,f['template'],c,context_schema)
  raise 'schema gate regression' unless schema_rejected && selected.nil?
  gate_results<<{id:f['id']+'.'+kind,schemaRejected:true,selectorSelected:selected,fallback:true}
 end
end
%w[PROPOSAL.json FIELD_CONTRACTS.json FIXTURES.json ADOPTION_LIMITS.json CONTEXT.schema.json PROPOSAL.schema.json negative_schema_checks.rb].each do |file|
 raise 'frozen draft changed' unless Digest::SHA256.file(root+'/'+file).hexdigest==Digest::SHA256.file(File.dirname(root)+'/marriage-life-context/'+file).hexdigest
end
File.write(root+'/SCHEMA_GATE_REGRESSION.json',JSON.pretty_generate({count:gate_results.size,results:gate_results,scope:'Pure reference selector with strict schema gate; engine adapter not executed'})+"\\n")
# Name resolution contract fixture
CODE
s.sub!("independentReview:'not_performed_author_only'", "independentReview:'Original review schema-gate gap addressed; revised independent review pending',strictSchemaGate:true,schemaGateRegressionCases:gate_results.size")
File.write(r+'/validate.rb',s)
File.write(r+'/PATCH_LOG.md', <<~MD)
# 혼인 문맥 선택기 최소 수정

독립 marriage-life-review에서 원래 schema는 추가 unexpectedHistoricalCause를 거부했으나 참조 선택기가 schema를 거치지 않아 후보를 골랐다. 별도 수정본의 select_candidate는 네 번째 인자로 CONTEXT.schema.json을 받고 가장 먼저 validate_schema를 실행한다. 실패는 nil/baseline fallback이며 후보 조건에 도달하지 않는다.

원래 문장20개·필드6개·fixture166개·schema 및 schema 음성검사114개·사실줄 차단3건은 원본 SHA와 비교하여 보존한다. 회귀52개는 양성 enum26개마다 fields 내부와 envelope 바깥에 허구의 추가필드를 넣는다. 모두 schema 거부와 selector fallback을 함께 요구한다.

SCHEMA_GATE_REGRESSION.json 및 VALIDATION.json은 작성자 로컬 Ruby 결과다. 독립 재검수는 아직이며 엔진·정본·원본·다른 검수 폴더는 수정하지 않았다. strict schema가 실제 event record와의 관계 또는 캡처의 사실성을 증명하지는 않는다. 원래 h-test/1000 모델의 한계와 사용차단3건은 유지한다.
MD
File.open(r+'/README.md','a'){|f|f.write("\n## 독립 검수 뒤 선택기 수정\n\nPATCH_LOG.md 참조. 참조 선택기가 CONTEXT schema를 먼저 검증하도록 연결했다. 추가필드 회귀52건을 더하며 기존166 fixture/114 schema 음성검사는 그대로다. 문장과 사실줄 차단3건도 그대로 유지했다. 수정본 독립 재검수는 아직이다.\n")}
