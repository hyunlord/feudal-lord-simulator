require 'json';require 'digest'
BASE=File.expand_path('../..',__dir__); Dir.chdir(BASE)
def read(p);JSON.parse(File.read(p));end
def sha(p);Digest::SHA256.file(p).hexdigest;end
m='records/ledger-purpose-catalog-merge'; before=read(m+'/before/chronicle/CONTEXT_DRAFTS.catalog.json'); after=read('chronicle/CONTEXT_DRAFTS.catalog.json'); base=read(m+'/BASELINE.json'); old=before.fetch('entries'); now=after.fetch('entries')
raise 'count' unless old.size==206 && now.size==212
raise 'old entries changed' unless old.all?{|e|now.find{|n|n['id']==e['id']}==e}
new=now.reject{|e|old.any?{|o|o['id']==e['id']}}
proposal=read('records/ledger-purpose-context/PROPOSAL.json')
raise 'six exact' unless new.map{|e|e['sourceEntry']}==proposal.fetch('variants')
raise 'category fake template' unless new.all?{|e|e['category']&&!e.key?('template')}
raise 'source drift' unless sha('records/ledger-purpose-context/PROPOSAL.json')==base['proposalSha256']
raise 'review drift' unless sha('records/ledger-purpose-review/REVIEW.json')==base['reviewSha256']
raise 'canonical drift' unless sha('chronicle/variants.ko.json')==base['canonicalSha256']
x=read(m+'/before/chronicle/R06_CONTEXT_FACTLINE_HOLDS.json');y=read('chronicle/R06_CONTEXT_FACTLINE_HOLDS.json');x.delete('catalogSha256');y.delete('catalogSha256');raise 'holds changed' unless x==y && y['count']==30
raise 'duplicates' unless now.map{|e|e['id']}.uniq.size==212
fallbacks=after.fetch('neutralFallbackProposals');raise 'fallback count' unless after['neutralFallbackCount']==2 && fallbacks.size==2
fallbacks.each{|f|raise 'fallback changed' unless f['text']==proposal.fetch(f['sourceField']) && f['sourceSha256']==base['proposalSha256'] && !f.key?('id')}
links=now.map{|e|p=e['reviewPath'];files=%w[REVIEW.md REPORT.md REVIEW.json RESULT.json CHECKS.json].map{|n|p+'/'+n}.select{|f|File.file?(f)};raise 'missing review' if files.empty?;raise 'source sha' unless sha(e['sourcePath'])==e['sourceSha256'];{'id'=>e['id'],'sourcePath'=>e['sourcePath'],'sourceSha256'=>e['sourceSha256'],'reviewFiles'=>files.to_h{|f|[f,sha(f)]}}}
File.write(m+'/LINKS.json',JSON.pretty_generate(links)+"\n")
result={status:'PASS_APPROVED_SIX_MERGED',before:206,after:212,unchangedExistingEntries:206,newLedgerDrafts:6,categories:new.map{|e|e['category']}.uniq,neutralFallbackProposalsExcludedFromCount:2,factlineHoldsUnchanged:30,canonicalSha256:base['canonicalSha256'],allSourceAndReviewLinksChecked:true,runtimeInstalled:false}
File.write(m+'/RESULT.json',JSON.pretty_generate(result)+"\n");puts JSON.pretty_generate(result)
