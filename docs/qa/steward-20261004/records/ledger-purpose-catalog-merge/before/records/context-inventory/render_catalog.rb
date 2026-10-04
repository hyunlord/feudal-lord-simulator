require 'json'
require 'digest'
root = File.expand_path('../..', __dir__)
Dir.chdir(root)
index = JSON.parse(File.read('records/context-inventory/INDEX.json'))
def find_lines(node, template = nil, out = {}, category = nil)
 case node
 when Array
  node.each { |v| find_lines(v, template, out, category) }
 when Hash
  template = node['template'] || template
  category = node['category'] || category
  if node['id'] && node['headline'] && template
   abort "duplicate #{node['id']}" if out.key?(node['id'])
   out[node.fetch('id')] = {'template'=>template, 'entry'=>node}
  end
  if node['id'] && node['text'] && category
   abort "duplicate #{node['id']}" if out.key?(node['id'])
   out[node.fetch('id')] = {'category'=>category, 'entry'=>node}
  end
  node.each_value { |v| find_lines(v, template, out, category) if v.is_a?(Array) || v.is_a?(Hash) }
 end
 out
end
lines = ["# R06 별도 문맥 초안 전문", "", "정본650과 별도인 #{index.fetch('newR06ProposalCount')}개 원고다. 아래 목록은 인계용 읽기 자료이며 실행 가능한 통합 선택기가 아니다. 각 출처의 schema·capture 계약·사실행 보류를 함께 적용한다. 이름은 기존 FIX-12의 읽기 시점 해석을 유지한다. 기존 나이20개는 AGE_CONTEXT_PROPOSAL.md에 별도 보존되어 이 집계에 중복하지 않았다.", ""]
raw = []
index.fetch('groups').each do |group|
 path = group.fetch('path')
 abort "drift #{path}" unless Digest::SHA256.file(path).hexdigest == group.fetch('sha256')
 found = find_lines(JSON.parse(File.read(path)))
 abort "count #{path}" unless found.size == group.fetch('count')
 lines += ["## #{File.dirname(path).split('/').last}", "", "[원문·조건](../#{path}) · [검수 폴더](../#{group.fetch('reviewPath')}/) · 상태: `#{group.fetch('reviewStatus')}`", ""]
 group.fetch('variants').each do |v|
  item = found.fetch(v.fetch('id'))
  entry = item.fetch('entry')
  lines += ["### #{v.fetch('id')}", "", entry['headline'] || entry.fetch('text'), ""]
  kind = item.key?('category') ? {'category'=>item.fetch('category')} : {'template'=>item.fetch('template')}
  raw << {'id'=>v.fetch('id')}.merge(kind).merge('sourcePath'=>path, 'sourceSha256'=>group.fetch('sha256'), 'reviewPath'=>group.fetch('reviewPath'), 'reviewStatus'=>group.fetch('reviewStatus'), 'sourceEntry'=>entry)
 end
end
abort 'count mismatch' unless raw.size == index.fetch('newR06ProposalCount')
File.write('chronicle/CONTEXT_DRAFTS.md',lines.join("\n")+"\n")
File.write('chronicle/CONTEXT_DRAFTS.catalog.json',JSON.pretty_generate({status:'READING_CATALOG_NOT_RUNTIME_SCHEMA',canonicalSha256:index.fetch('canonicalSha256'),count:raw.size,entries:raw})+"\n")
puts "Rendered #{raw.size} unchanged source headlines and entries"
