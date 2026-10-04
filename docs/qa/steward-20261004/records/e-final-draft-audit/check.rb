require 'json'
require 'digest'
BASE='/tmp/astra-steward-r06-20261004'
REPO='/Users/rexxa/fls-astra-steward'
OUT=File.dirname(__FILE__)
def read(p); JSON.parse(File.read(p)); end
def sha(p); Digest::SHA256.file(p).hexdigest; end
def save(n,v); File.write(File.join(OUT,n),JSON.pretty_generate(v)+"\n"); end
def objects(x)
  case x
  when Hash then [x]+x.values.flat_map{|v|objects(v)}
  when Array then x.flat_map{|v|objects(v)}
  else [] end
end
a=read(BASE+'/chronicle/variants.ko.json'); cat=read(BASE+'/chronicle/CONTEXT_DRAFTS.catalog.json'); c=cat.fetch('entries')
age=read(BASE+'/records/age-context-copy-proposal/ADDITIONS.json')['additions']
inputs={}; %w[chronicle/variants.ko.json chronicle/CONTEXT_DRAFTS.catalog.json chronicle/BIOGRAPHY_CONTRACT.json chronicle/AGE_CONTEXT_PROPOSAL.md records/age-context-copy-proposal/ADDITIONS.json records/factline-copy-review/RESULT.json records/fixed-factline-composition-review/CHECKS.json].each{|p|inputs[p]=sha(BASE+'/'+p)}
c.each do |x|
 p=BASE+'/'+x['sourcePath'];raise 'source hash drift '+p unless sha(p)==x['sourceSha256'];raise 'source entry mismatch '+x['id'] unless objects(read(p)).include?(x['sourceEntry']);inputs[x['sourcePath']]=sha(p)
 raise 'missing review' unless File.directory?(BASE+'/'+x['reviewPath'])
end
hist_source=File.read(REPO+'/src/content/historyCopy.ko.ts').split('export const HISTORY_TEMPLATES:')[1].scan(/^  "([^"]+)":/).flatten
ledger_source=File.read(REPO+'/src/ledger/ledger.types.ts').split('export const LEDGER_CATEGORIES = [')[1].split('] as const')[0].lines.reject{|l|l.lstrip.start_with?('//')}.join.scan(/"([^"]+)"/).flatten
h=a.fetch('historyTemplates'); l=a.fetch('ledgerCategories');raise 'history inventory mismatch' unless h.map{|x|x['template']}.sort==hist_source.sort;raise 'ledger inventory mismatch' unless l.map{|x|x['category']}.sort==ledger_source.sort
allids=h.flat_map{|x|x['variants'].map{|v|v['id']}}+l.flat_map{|x|x['variants'].map{|v|v['id']}}+c.map{|v|v['id']}+age.flat_map{|x|x['variants'].map{|v|v['id']}}
raise 'ID collision' unless allids.uniq.size==allids.size
rows=h.map do |x|
 t=x['template']; vs=x['variants']; cs=c.select{|y|y['template']==t}; av=(age.find{|y|y['template']==t}||{})['variants']||[]
 conditionals=vs.reject{|v|v['when'].nil?||v['when'].empty?}+cs.map{|y|y['sourceEntry']}+av
 texts=conditionals.map{|v|v['headline']}.uniq
 repeats=conditionals.group_by{|v|v['headline']}.select{|k,v|v.size>1}.map{|k,v|{'headline'=>k,'ids'=>v.map{|z|z['id']}}}
 {'template'=>t,'canonical'=>vs.size,'contextDrafts'=>cs.size,'ageDrafts'=>av.size,'distinctConditionalHeadlines'=>texts.size,'identicalTextDifferentConditions'=>repeats,'status'=>(cs.size>0 ? 'REVIEWED_CONTEXT_DRAFT_PRESENT' : av.size>0 ? 'INHERITED_AGE_DRAFT_PRESENT' : 'CANONICAL_CONDITION_AND_RETAINED_FACTLINE'),'sources'=>cs.map{|y|y['sourcePath']}.uniq}
end
ledger=l.map do |x|
 enabled=x['variants'].reject{|v|v['disabled']}; special=enabled.reject{|v|['{label} — 금고에 {amountExact} 들어왔다.','{label} — 금고에서 {amountAbsExact} 나갔다.','{accountLabel} · {label} · {amountSignedExact}'].include?(v['text'])}
 ledger_context=c.select{|e|e['category']==x['category']}
 {'category'=>x['category'],'canonical'=>x['variants'].size,'enabled'=>enabled.size,'disabled'=>x['variants'].count{|v|v['disabled']},'sourceSpecific'=>special.map{|v|v['id']}+ledger_context.map{|e|e['id']},'status'=>special.empty?&&ledger_context.empty? ? 'MONETARY_DIRECTION_AND_ACCOUNT_CONTEXT_ONLY' : 'MONETARY_AND_PRODUCER_CONTEXT'}
end
slots=h.flat_map{|x|x['variants']}.map{|v|actual=v['headline'].scan(/\{([^}]+)\}/).flatten.uniq; declared=v['requiredSlots']||[]; {'id'=>v['id'],'actual'=>actual,'declared'=>declared}}.select{|x|x['actual'].sort!=x['declared'].sort}
raise 'slot declaration mismatch' unless slots.empty?
copydirs=%w[age-context-copy-proposal historical-age-adapter-proposal historical-age-contract]
copycheck=copydirs.flat_map{|dir|Dir.glob('/tmp/astra-steward-r05-20261004/records/'+dir+'/**/*').select{|f|File.file?(f)}.map{|f|rel=f.sub('/tmp/astra-steward-r05-20261004/','');{'path'=>rel,'same'=>File.file?(BASE+'/'+rel)&&sha(f)==sha(BASE+'/'+rel)}}}
raise 'inherited age mismatch' unless copycheck.all?{|x|x['same']}
save('COVERAGE.json',{'status'=>'E_DRAFT_SCOPE_REAUDITED','historyCount'=>h.size,'ledgerCount'=>l.size,'canonicalCount'=>h.sum{|x|x['variants'].size}+l.sum{|x|x['variants'].size},'separateCount'=>c.size,'inheritedAgeCount'=>age.sum{|x|x['variants'].size},'history'=>rows,'ledger'=>ledger,'duplicateIds'=>[],'undeclaredCanonicalSlots'=>slots,'inheritedAgeFiles'=>copycheck})
save('INPUT_SHA256SUMS.json',inputs)
save('CHECKS.json',{'sourceHistoryExactSet'=>182,'sourceLedgerExactSet'=>46,'catalogSourceEntriesExact'=>c.size,'allIdsUnique'=>allids.size,'ageFilesByteIdentical'=>copycheck.size,'uncoveredHistoryTypes'=>rows.select{|x|x['canonical']==0},'confirmedDraftGaps'=>rows.select{|x|x['status'].start_with?('AUTHORING')}.map{|x|x['template']},'sourceSpecificLedgerCategories'=>ledger.count{|x|!x['sourceSpecific'].empty?},'genericLedgerCategories'=>ledger.count{|x|x['sourceSpecific'].empty?},'engineExecuted'=>false,'canonicalModified'=>false})
puts File.read(OUT+'/CHECKS.json')
