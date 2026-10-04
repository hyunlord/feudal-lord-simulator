require 'json';require 'digest';require 'set';require 'pathname'
BASE='/tmp/astra-steward-r07-20261004';DEST='/tmp/astra-steward-r08-20261004';OUT=__dir__
def j(p);JSON.parse(File.read(p));end
roots=[];cat=j(DEST+'/chronicle/CONTEXT_DRAFTS.catalog.json');cat['entries'].each{|e|roots<<File.dirname(e['sourcePath']);roots<<e['reviewPath']};j(DEST+'/content/ASTRA_ANSWERS_R05.json')['answers'].each{|e|roots<<Pathname.new(File.expand_path(e['evidence'],BASE+'/content')).relative_path_from(Pathname.new(BASE)).to_s}
%w[age-context-copy-proposal historical-age-adapter-proposal historical-age-contract e-final-draft-audit e-completion-reaudit ledger-purpose-catalog-merge factline-copy-review fixed-factline-composition-review factline-copy-proposal registry-invalid-review content-handoff-current-r07 content-source-filter-review-r07].each{|d|roots<<'records/'+d}
# Current contract/hold documents are graph roots. Historical change logs are not mandatory replay roots.
%w[BIOGRAPHY_CONTRACT.json R06_PROPOSED_COMPOSITION_ACCEPTANCE.json R06_CONTEXT_FACTLINE_HOLDS.json AGE_CONTEXT_PROPOSAL.md].each{|f|roots<<'chronicle/'+f}
seen={};missing=[];external=[];queue=roots.uniq.map{|p|[p,'current D/E contract root']}
until queue.empty?
 rel,why=queue.shift;rel=rel.sub(/\/$/,'');next if seen.key?(rel);full=BASE+'/'+rel
 unless File.exist?(full);missing<<{path:rel,from:why};next;end
 if File.directory?(full)
   # Preserve the selected evidence package's files, including its checksum dependencies.
   Dir[full+'/*'].each{|p|queue<<[p.delete_prefix(BASE+'/'),rel] if File.file?(p)}
   seen[rel]={directory:true};next
 end
 seen[rel]={path:rel,from:why,sha256:Digest::SHA256.file(full).hexdigest,bytes:File.size(full)}
 next if File.size(full)>3_000_000 || rel.match?(/\/(?:before|baseline647|replay|originals)\//)
 text=File.read(full);refs=[]
 if File.basename(full)=='SHA256SUMS'
  text.lines.each{|l|m=l.match(/\A[0-9a-f]{64}\s+\*?(.+?)\s*$/);refs<<m[1] if m}
 elsif File.extname(full)=='.md'
  refs+=text.scan(/\]\(([^)]+)\)/).flatten
  refs+=text.scan(/`((?:\.\.\/|records\/)[^`\s]+\.(?:json|md|rb|sh|mjs))`/).flatten
 elsif File.extname(full)=='.json'
  begin
   walk=lambda{|x,key=nil| case x;when Hash;x.each{|k,v|walk.call(v,k)};when Array;x.each{|v|walk.call(v,key)};when String;refs<<x if key.to_s.match?(/\A(?:sourcePath|reviewPath|evidence|contract|adapter|sourceReview|proposal|review|report|patch|copy)\z/i) && x.match?(/\A(?:\.\.?\/|records\/|chronicle\/|content\/|patches\/)[^\s]+\.(?:json|md|rb|sh|mjs)(?:#.*)?\z/);end};walk.call(JSON.parse(text))
  rescue JSON::ParserError;end
 end
 refs.uniq.each do |ref|
  ref=ref.split('#').first.to_s;next if ref.empty?||ref.match?(/\A(?:https?:|mailto:|src\/)/)
  if ref.start_with?('/');external<<{from:rel,path:ref};next;end
  candidates=[]
  candidates<<File.expand_path(ref,BASE) if ref.match?(/\A(?:records|chronicle|content|patches)\//)
  candidates<<File.expand_path(ref,File.dirname(full))
  p=candidates.find{|p|File.exist?(p)}||candidates.last
  unless p.start_with?(BASE+'/');external<<{from:rel,path:ref};next;end
  queue<<[p.delete_prefix(BASE+'/'),rel]
 end
end
files=seen.values.reject{|x|x[:directory]};required=files.select{|x|x[:path].start_with?('records/')&&!File.exist?(DEST+'/'+x[:path])};report={status:'MINIMUM_CURRENT_EVIDENCE_LINK_CLOSURE_PROPOSAL',sourceRoot:BASE,destinationRoot:DEST,roots:roots.uniq.sort,requiredFiles:required.sort_by{|x|x[:path]},requiredCount:required.size,requiredBytes:required.sum{|x|x[:bytes]},alreadyPresentDependencies:files.reject{|x|required.include?(x)}.map{|x|x[:path]},unresolved:missing.uniq,external:external.uniq,scope:'Catalog source/review packages, age, 24 answers, current semantic-hold/approval, final scope review; local Markdown/JSON links and manifest members recursively. Excludes historical CHANGES links, script-literal runtime paths, remote originals and engine installation. No files copied.'};File.write(OUT+'/REQUIRED_INHERITANCE.json',JSON.pretty_generate(report)+"\n");puts JSON.pretty_generate(report.reject{|k,v|[:roots,:requiredFiles,:alreadyPresentDependencies,:unresolved,:external].include?(k)});puts "unresolved #{missing.uniq.size}; external #{external.uniq.size}"
