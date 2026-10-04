require 'json';require 'digest';require 'find'
OUT=File.dirname(__FILE__);R08='/tmp/astra-steward-r08-20261004';R07='/tmp/astra-steward-r07-20261004'
@c=[]
def add(id,root,files,why)
 files.each do |rel|
  src=root+'/'+rel;raise "missing #{src}" unless File.file?(src)
  @c<<{id:id,source:src,destination:'inherited/top10/'+File.basename(root)+'/'+rel,bytes:File.size(src),sha256:Digest::SHA256.file(src).hexdigest,rationale:why}
 end
end
r03='/tmp/astra-steward-r03-20261003';r04='/tmp/astra-steward-r04-20261003';r01='/tmp/astra-steward-r01-20261003';r05='/tmp/astra-steward-r05-20261004'
add('SAVE01',r03,%w[records/N01-failure/RESULT.md records/N01-failure/SNAPSHOT_AUDIT.json records/N01-failure/latest.fls.json records/N01-failure/metadata.json records/N01-failure/savebytes-confirmed/run.log records/N01-failure/savebytes-confirmed/exit-code],'seed1/open/full t560000 actual failed envelope and exact decode rejection, not another passing save')
add('A02',r04,%w[records/DEAD_STEWARD_RESULT_R04.md records/dead-steward-executed/metadata.json records/dead-steward-executed/natural-dead-appointment.json records/dead-steward-executed/natural-dead-appointment-before.fls.json records/dead-steward-executed/natural-dead-appointment-after.fls.json records/dead-steward-executed/result.json records/dead-steward-executed/PARENT_CHECK.json],'seed2/chalk t600000 natural dead est-000021 appointment before/after; synthetic audit controls distinguished in result')
add('A05',R07,%w[records/registry-atomic-r05-inherited/A05_CURRENT_RESULT.md records/registry-atomic-r05-inherited/result.json records/registry-atomic-r05-inherited/PARENT_CHECK.json records/registry-atomic-r05-inherited/run.log],'seed1 initial t0 synthetic 7+9 subsidy atomicity input/results; no time advance/UI claim')
shared=%w[records/post-petition-ui/REVIEW.md records/post-petition-ui/PREFLIGHT.json records/post-petition-ui/AUDIT.json records/post-petition-ui/SOURCE_DIAGNOSIS.md records/post-petition-ui/executed-scrollbar/actions.jsonl]
add('B02',R07,shared+%w[records/post-petition-ui/executed-scrollbar/0009-policy-surface.jpg records/post-petition-ui/executed-scrollbar/0009-policy-surface.json],'t100000 accepted charter@25000 but direction locked; actual observed screenshot/DOM and source scope')
add('B03',R07,shared+%w[records/post-petition-ui/executed-scrollbar/0026-autonomous-inspector-top.jpg records/post-petition-ui/executed-scrollbar/0026-autonomous-inspector-top.json records/post-petition-ui/executed-scrollbar/0028-autonomous-inspector-end.jpg records/post-petition-ui/executed-scrollbar/0028-autonomous-inspector-end.json],'receipt98 storehouse000039; top AND actual scrollbar bottom needed for bounded absence claim')
%w[B02 B03].each{|id|add(id,r04,%w[long-run/N02-v3-open-1-growth/year-1325.fls.json],'seed1 t100000 exact browser fixture; old long-run core intentionally omitted midpoint saves')}
add('B01',R07,%w[records/natural-firstplay-r07/REPORT.md records/natural-firstplay-r07/SOURCE_EVIDENCE.json records/natural-firstplay-r07/PRIOR_EVIDENCE.json],'Normal lord new-game entry source restriction; prior live UI not R08 execution')
add('B01',r05,%w[records/ui-r05-live/0001-title.json records/ui-r05-live/0007-goal-initial.jpg records/ui-r05-live/0007-goal-initial.json records/ui-r05-diagnosis/DIAGNOSIS.md],'Actual initial goal-mode build-house CTA screenshot, separate from lord fixture loading')
add('A01',r01,%w[records/PERF_RUNTIME.md records/PERF_SOURCE_REVIEW.md records/repro-1315.fls.json records/debug-profile.json records/debug-profile-summary.json records/debug-stack-02.json],'Old HEAD5ad seed1 t60000; small actual CPU sample profile and stack, not browser profile; must continue full bot, no current performance proof')
add('E02.factline.seven',R07,%w[records/factline-copy-review/REVIEW.md records/factline-copy-review/FACTLINE_VERDICTS.json records/factline-copy-review/COMPOSITION_VERDICTS.json records/factline-copy-proposal/SOURCE_EVIDENCE.json],'Seven existing engine factline/source semantic signatures; draft integration not implied')
add('ledger.purpose.three',R07,%w[records/ledger-purpose-review/REPORT.md records/ledger-purpose-review/REVIEW.json records/ledger-purpose-review/INDEPENDENT_SOURCE.json records/ledger-purpose-review/STALL_INDEPENDENT.json records/ledger-purpose-context/PROPOSAL.json],'Three category purpose contracts/producer evidence and six reviewed drafts; no runtime UI proof')
add('B04.restore-affordability',R07,%w[records/restoration-probe/UI_EVIDENCE.json records/restoration-probe/executed/REVIEW.md records/restoration-probe/executed/result/result.json records/restoration-probe/executed/result/haggled-market-15-before.fls.json records/restoration-probe/executed/result/haggled-market-15-after.fls.json records/restoration-deadline-probe/INPUTS.json records/restoration-deadline-probe/executed/REVIEW.md records/restoration-deadline-probe/executed/result-continuous/result.json records/restoration-deadline-probe/executed/result-continuous/boundaries.jsonl],'Synthetic seed1 t12001 insufficient15 and time boundaries16001/17000; preserve natural/UI limits')
add('B04.restore-affordability',r05,%w[records/ui-r05-executed/0115-petition-immediate-before.jpg records/ui-r05-executed/0115-petition-immediate-before.json records/ui-r05-executed/0118-petition-immediate-after.jpg records/ui-r05-executed/0118-petition-immediate-after.json],'Actual insufficient-cash restoration UI before/after; original runtime petition ID unknown, not identical synthetic fixture')
# Scan existing paths by size first; hash only potential exact-byte matches. No copies.
by_size=Hash.new{|h,k|h[k]=[]}
Find.find(R08){|p|next if p.start_with?(OUT+'/');s=File.lstat(p);by_size[s.size]<<p if s.file?}
unique=@c.group_by{|r|r[:source]}.map do |src,group|
 r=group.first.dup;r.delete(:id);r[:ids]=group.map{|x|x[:id]}.uniq
 relative=src.sub(%r{\A/tmp/[^/]+/},'')
 matches=by_size[r[:bytes]].select{|p|(p.end_with?('/'+relative) || (src.end_with?('.fls.json') && p.end_with?('.fls.json'))) && Digest::SHA256.file(p).hexdigest==r[:sha256]}
 r[:existingR08Paths]=matches.map{|p|p.delete_prefix(R08+'/')};r[:action]=matches.empty? ? 'PROPOSE_COPY' : 'ALREADY_PRESENT_EXACT_BYTES'
 r[:destination]=r[:existingR08Paths].first unless matches.empty?
 r
end
File.write(OUT+'/EVIDENCE_FILES.json',JSON.pretty_generate(unique)+"\n")
File.write(OUT+'/COPY_NEEDED.json',JSON.pretty_generate(unique.select{|r|r[:action]=='PROPOSE_COPY'})+"\n")
summary={status:'PLAN_ONLY_NO_COPY_OR_EXECUTION',ids:@c.map{|r|r[:id]}.uniq,files:unique.size,alreadyPresent:unique.count{|r|r[:action]=='ALREADY_PRESENT_EXACT_BYTES'},proposedFiles:unique.count{|r|r[:action]=='PROPOSE_COPY'},proposedBytes:unique.select{|r|r[:action]=='PROPOSE_COPY'}.sum{|r|r[:bytes]},photos:unique.select{|r|r[:source].end_with?('.jpg')}.size,perID:@c.map{|r|r[:id]}.uniq.to_h{|id|files=unique.select{|r|r[:ids].include?(id)};[id,{files:files.size,alreadyPresent:files.count{|r|r[:action]=='ALREADY_PRESENT_EXACT_BYTES'},proposed:files.count{|r|r[:action]=='PROPOSE_COPY'}}]}}
File.write(OUT+'/RESULT.json',JSON.pretty_generate(summary)+"\n");puts JSON.pretty_generate(summary)
