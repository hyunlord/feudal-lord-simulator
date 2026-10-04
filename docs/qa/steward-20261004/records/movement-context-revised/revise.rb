require 'json';require 'fileutils';require 'digest'
r=__dir__;orig=File.dirname(r)+'/movement-context';Dir.children(orig).reject{|f|%w[build.rb SHA256SUMS].include?(f)}.each{|f|FileUtils.cp(orig+'/'+f,r+'/'+f)};FileUtils.cp(orig+'/SHA256SUMS',r+'/ORIGINAL_SHA256SUMS')
replacements={
'house.withdrew.r06move.family_extinct'=>'역병으로 식구를 잃었던 가문의 식구가 현재 도시 기록에 남아 있지 않고 대기 중인 후계 후보도 없어, 새 가문으로 교체되었다.',
'house.withdrew.r06move.decline_elapsed'=>'쇠퇴가 이어진 끝에 종전 가문이 영지에서 물러났다.',
'house.resettled.r06move.split'=>'빈집에 들어온 이주민들은 가져온 빵을 곡창에 넣고, 남은 몫은 이주민 가구에 나누어 두었다.'}
p=JSON.parse(File.read(r+'/PROPOSAL.json'));readme=File.read(r+'/README.md');changes=[]
replacements.each{|id,headline|row=p['additions'].find{|a|a['variant']['id']==id};old=row['variant']['headline'];row['variant']['headline']=headline;readme=readme.gsub(old,headline);changes<<{variantId:id,before:old,after:headline}}
File.write(r+'/PROPOSAL.json',JSON.pretty_generate(p)+"\n");File.write(r+'/CHANGES.json',JSON.pretty_generate(changes)+"\n");File.write(r+'/README.md',readme+"\n## 독립 검수의 편집 보류 교정\n\nCHANGES.json의3문구만 교정했다. family_extinct는 현재 도시 기록·대기 후계 후보 범위로 한정하고, 쇠퇴의 시간 경과에 약속된 마감을 덧붙이지 않으며, split은 모든 집에 배분했다는 뜻을 제거했다. 필드 계약·조건·fixture와 나머지10문구는 원본 그대로다. PATCH_LOG.md 및 PRESERVATION.json 참조. 수정본 독립 재검수는 아직이다.\n")
s=File.read(r+'/validate.rb');s.sub!("File.write(root+'/VALIDATION.json'", <<~CHECK.chomp)
original_root=File.dirname(root)+'/movement-context'
original=JSON.parse(File.read(original_root+'/PROPOSAL.json'))
replacements=JSON.parse(File.read(root+'/CHANGES.json'))
raise 'three edits' unless replacements.size==3 && replacements.map{|c|c['variantId']}.sort==%w[house.withdrew.r06move.family_extinct house.withdrew.r06move.decline_elapsed house.resettled.r06move.split].sort
restored=Marshal.load(Marshal.dump(p))
replacements.each do |change|
 row=restored['additions'].find{|a|a['variant']['id']==change['variantId']}
 original_row=original['additions'].find{|a|a['variant']['id']==change['variantId']}
 raise 'headline correction mismatch' unless row['variant']['headline']==change['after'] && original_row['variant']['headline']==change['before']
 row['variant']['headline']=change['before']
end
raise 'non-headline proposal change' unless restored==original
preserved=%w[FIELD_CONTRACTS.json FIXTURES.json PROPOSAL.schema.json CONTEXT.schema.json ADOPTION_LIMITS.json NOT_AUTHORED.json READ_TIME_NAMES.md SOURCE_EVIDENCE.json negative_schema_checks.rb]
preserved.each{|file|raise 'preservation mismatch' unless Digest::SHA256.file(root+'/'+file).hexdigest==Digest::SHA256.file(original_root+'/'+file).hexdigest}
File.readlines(root+'/ORIGINAL_SHA256SUMS',chomp:true).each{|line|sha,file=line.split('  ',2);raise 'original frozen artifact drift' unless Digest::SHA256.file(original_root+'/'+file).hexdigest==sha}
File.write(root+'/PRESERVATION.json',JSON.pretty_generate({onlyHeadlineChanges:3,otherProposalFieldsUnchanged:true,preservedFiles:preserved,originalManifestVerified:true,canonicalUnchanged:true})+"\\n")
File.write(root+'/VALIDATION.json'
CHECK
s.sub!("independentReview:'not_performed_author_only'", "independentReview:'Three original editorial holds addressed; revised independent review pending'")
File.write(r+'/validate.rb',s)
File.write(r+'/PATCH_LOG.md', <<~MD)
# 이동 문맥 편집 보류3 교정

- family_extinct: 현재 persons.people의 도시 가문 기록 및 대기 후계 후보라는 검사 범위를 명시했다. 지도 밖 혈족이나 세계의 모든 후계 가능성이 사라졌다고 주장하지 않는다.
- decline_elapsed: '정해진 기한'을 '쇠퇴가 이어진 끝에'로 바꾸었다. houseChangeTicks를 세계 속 통지나 약속으로 표현하지 않는다.
- resettled.split: '집집마다'를 '이주민 가구에'로 바꾸었다. 일부 가구에만 돌아갈 수도 있고 모두에게 돌아갈 수도 있으므로 어느 쪽도 단정하지 않는다.

정확한 before/after는 CHANGES.json이다. 조건·필드·capture 계약·스키마·fixture·사실줄 한계는 보존했다. 원본 proposal에3headline만 원래대로 돌리면 전체JSON이 같아야 한다는 검사를 추가했다. 원본 manifest 전체 및 핵심 파일별 SHA도 재검증한다.

기존104 선택·75 schema음성·26추가필드·15envelope·4이름계약을 다시 실행한다. 정본·엔진·원본·독립검수 폴더는 쓰지 않는다. 검수 원본은 movement-context-review/REVIEW.md이며 수정본 독립 재검수는 아직이다. 실제 capture/runtime/UI를 검증했다고 주장하지 않는다.
MD
