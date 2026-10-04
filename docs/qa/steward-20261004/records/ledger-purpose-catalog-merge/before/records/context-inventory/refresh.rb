require 'json'
require 'digest'
require 'pathname'
root = File.expand_path('../..', __dir__)
Dir.chdir(root)
base = 'records/context-inventory'
index = JSON.parse(File.read("#{base}/INDEX.json"))
canonical_sha = Digest::SHA256.file('chronicle/variants.ko.json').hexdigest
abort 'canonical changed' unless canonical_sha == index.fetch('canonicalSha256')
new_groups = [
 ['records/ledger-lawsuit-revised/PROPOSAL.json', 'records/ledger-lawsuit-revised-review', 'reviewed_4_conditional_ledger_drafts_0_review_holds'],
 ['records/person-transitions-context/PROPOSAL.json', 'records/person-transitions-review', 'reviewed_6_conditional_drafts_fills_3_semantic_gaps'],
 ["records/movement-context-revised/PROPOSAL.json", "records/movement-context-revised-review", "reviewed_13_conditional_drafts_0_editorial_holds"],
 ["records/fixed-context-revised/PROPOSAL.json", "records/fixed-context-revised-review", "reviewed_10_drafts_7_current_factline_holds"],
 ["records/legacy-town-context/PROPOSAL.json", "records/legacy-town-review", "reviewed_9_conditional_6_factline_holds"],
 ["records/legacy-government-context/PROPOSAL.json", "records/legacy-government-review", "reviewed_14_conditional_drafts"],
 ["records/reorg-context/PROPOSAL.json", "records/reorg-context-review", "reviewed_9_conditional_2_factline_holds"],
 ["records/office-context-revised/PROPOSAL.json", "records/office-context-revised-review", "reviewed_6_conditional_2_factline_holds_216_checks"],
 ["records/milestone-context/ADDITIONS.json", "records/milestone-context-review", "reviewed_9_conditional_1_composition_hold"],
 ['records/marriage-life-revised/PROPOSAL.json', 'records/marriage-life-revised-review', 'reviewed_17_conditional_3_factline_holds_332_checks'],
 ['records/war-plague-context/PROPOSAL.json', 'records/war-plague-review', 'reviewed_14_conditional_drafts_priest_died_unwritten'],
 ['records/current-param-candidates/ADDITIONS.json', 'records/current-param-review', 'reviewed_6_blocked_drafts_not_direct_merge']
]
def collect_variants(node, template = nil, result = [], category = nil)
 case node
 when Array
  node.each { |v| collect_variants(v, template, result, category) }
 when Hash
  template = node['template'] || template
  category = node['category'] || category
  if node['id'] && node['headline'] && template
   result << {'id'=>node.fetch('id'), 'template'=>template, 'integrationStatus'=>node['integrationStatus'] || node['status'] || 'PROPOSED_NOT_CANONICAL'}
  end
  if node['id'] && node['text'] && category
   result << {'id'=>node.fetch('id'), 'category'=>category, 'integrationStatus'=>node['integrationStatus'] || node['status'] || 'PROPOSED_NOT_CANONICAL'}
  end
  node.each { |k,v| collect_variants(v, template, result, category) if v.is_a?(Hash) || v.is_a?(Array) }
 end
 result
end
new_groups.each do |path, review, status|
 variants = collect_variants(JSON.parse(File.read(path)))
 abort "empty #{path}" if variants.empty?
 index.fetch('groups').reject! { |g| g.fetch('path') == path }
 group = {'path'=>path,'sha256'=>Digest::SHA256.file(path).hexdigest,'reviewPath'=>review,'reviewStatus'=>status,'count'=>variants.size,'templates'=>variants.map { |v| v['template'] }.compact.uniq,'variants'=>variants}
 categories = variants.map { |v| v['category'] }.compact.uniq
 group['categories'] = categories unless categories.empty?
 index.fetch('groups') << group
end
all = index.fetch('groups').flat_map { |g| g.fetch('variants') }
abort 'duplicate proposal IDs' unless all.map { |v| v.fetch('id') }.uniq.size == all.size
index['newR06ProposalCount'] = all.size
index['proposalIdsUnique'] = true
index['allContextTypesComplete'] = false
File.write("#{base}/INDEX.json",JSON.pretty_generate(index)+"\n")
coverage = JSON.parse(File.read("#{base}/TYPE_COVERAGE.json"))
coverage.fetch('rows').each do |row|
 groups = index.fetch('groups').select { |g| g.fetch('templates').include?(row.fetch('template')) }
 row['r06Packages'] = groups.map { |g| g.fetch('path') }
 row['r06ProposalVariants'] = groups.sum { |g| g.fetch('variants').count { |v| v.fetch('template') == row.fetch('template') } }
 if row.fetch('canonicalVariants') == 1
  row['status'] = row.fetch('r06ProposalVariants') > 0 || row.fetch('inheritedAgeProposal') ? 'single_canonical_with_separate_draft' : 'single_canonical_no_separate_context_draft_in_index'
 end
end
coverage['singleWithSeparateDraft'] = coverage.fetch('rows').count { |r| r.fetch('status') == 'single_canonical_with_separate_draft' }
remaining = coverage.fetch('rows').select { |r| r.fetch('status') == 'single_canonical_no_separate_context_draft_in_index' }
coverage['singleWithoutSeparateDraft'] = remaining.size
File.write("#{base}/TYPE_COVERAGE.json",JSON.pretty_generate(coverage)+"\n")
File.write("#{base}/REMAINING.md", "# 現在 목록에서 별도 문맥초안이 없는 단일형\n\n#{remaining.size}종이다. 원고 존재와 검수 통과는 별개다. INDEX의 검수상태를 함께 읽는다. 고정사실에는 억지 분기를 만들지 않고 다른 문맥의 근거 유무를 검토한다.\n\n".sub('現在','현재') + remaining.map { |r| "- `#{r.fetch('template')}` (#{r['sourceClassification']})" }.join("\n")+"\n")
rows = index.fetch("groups").map { |g| "|#{File.dirname(g.fetch("path")).split("/").last}|#{g.fetch("count")}|#{g.fetch("reviewStatus")}|" }
File.write("#{base}/README.md", "# R06 별도 문맥 원고 목록\n\n정본650과 별도 초안#{all.size}개를 구분한다. 수정전후 중복을 제외하며 기존 나이20개는 별도다. 전문은 ../../chronicle/CONTEXT_DRAFTS.md 참조.\n\n|묶음|문구|판정|\n|---|---:|---|\n" + rows.join("\n") + "\n\n정본 단일형91종 중#{coverage.fetch("singleWithSeparateDraft")}종에 별도초안, #{remaining.size}종은 아직없다. 존재·조건부통과·실제엔진사용가능은 서로 다르며 사실행보류를 유지한다.\n")
File.write("#{base}/SHA256SUMS",Dir.glob("#{base}/*").select { |p| File.file?(p) && File.basename(p) != 'SHA256SUMS' }.sort.map { |p| "#{Digest::SHA256.file(p).hexdigest}  #{File.basename(p)}" }.join("\n")+"\n")
puts JSON.pretty_generate({canonicalSha256:canonical_sha,proposals:all.size,singleWithDraft:coverage['singleWithSeparateDraft'],singleWithoutDraft:remaining.size,canonicalModified:false})
