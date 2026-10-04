require 'json'
require 'digest'
require 'fileutils'
require 'open3'
ROOT='/tmp/astra-steward-r06-20261004'
REPO='/Users/rexxa/fls-astra-steward'
OUT=File.dirname(__FILE__)
PATCH=ROOT+'/patches/factline-copy-r06/historyCopy.ko.ts.patch'
SRC='src/content/historyCopy.ko.ts'
HEAD='5fb1aebfe735592c1424c947e88388d4ffe21742'
def sha(p); Digest::SHA256.file(p).hexdigest; end
def writej(p,v); File.write(p,JSON.pretty_generate(v)+"\n"); end
raise 'HEAD mismatch' unless `git -C #{REPO} rev-parse HEAD`.strip==HEAD
original=File.read(REPO+'/'+SRC)
rows=[
['person.fed','가구가 다시 배불리 먹게 되었다','먹을거리 부족 상태가 해제되었다','부족 표식이 해제되는 조건에는 빈집도 들어간다. 생존 가구의 포만을 보장하지 않는다.',%w[person.fed.r06life.brief person.fed.r06life.long], [['history.ts',368,378],['seasonPressure.ts',220,230]]],
['person.emptied','굶주려 가구가 흩어졌다','집에 남은 사람이 없게 되었다','양수 거주민이 0 이하로 바뀌면 기록한다. 해당 전이에서 기아라는 원인은 확인하지 않는다.',%w[person.emptied.r06ctx.one person.emptied.r06ctx.many],[['history.ts',368,378]]],
['marriage.brother_in_law_born','이웃 영주가 다시 장가들어 아들을 얻었다 — 상속 기대가 줄었다','이웃 영주에게 아들이 태어났다 — 상속 기대가 줄었다','아들을 생성하고 상속 청구 강도를 낮추지만 재혼 상태는 확인하지 않는다.',%w[marriage.brother_in_law_born.r06life.lord marriage.brother_in_law_born.r06life.son marriage.brother_in_law_born.r06life.kin],[['marriage.ts',474,484]]],
['marriage.inherited','아내를 통해 이웃 영지를 물려받았다 — 이제 우리 영지다','혼인 약정에 따라 이웃 영지를 물려받았다','신랑은 영주 본인 외에 아들·형제·조카·사촌도 가능하므로 영주 자신의 아내라고 단정하지 않는다.',%w[marriage.inherited.r06ctx.son marriage.inherited.r06ctx.kin],[['history.ts',1040,1060],['marriage.ts',407,420]]],
['stewardship.began','영주의 손에 들어왔다 — 영주가 직접 보고, ','영지 관리 대상으로 기록되었다 — ','새 oversight가 기록된 전이지 이번 시점의 소유권 취득은 아니다. 집사 이름과 조사식은 유지한다.',%w[stewardship.began.r06office.sole_estate stewardship.began.r06office.multiple_estates],[['history.ts',925,936],['stewardship.ts',117,135]]],
['reorg.weavers_left','직조공 ${n(params, "households")}가구가 길드가 있는 도시로 떠났다','길드 청원 뒤 떠난 가구가 누적 ${n(params, "households")}가구가 되었다','직조소 근접 거주가구를 고르지만 직업·목적지는 추적하지 않는다. 숫자는 전이별 수가 아닌 누계이다.',%w[reorg.weavers_left.r06rg.refused reorg.weavers_left.r06rg.expired],[['history.ts',696,704],['reorganisation.ts',186,212],['reorganisation.ts',468,476]]],
['plague.priest_died','사제가 역병으로 죽었다 — 교회가 비었다','사제 자리가 비었다','역병 도착 때 curacy 공석을 만든다. 특정 사제의 죽음이나 교회 존재·비어 있음은 확인하지 않는다.',[],[['history.ts',643,654],['plague.ts',513,525]]],
['milestone.market_town','시장도시가 되었다','시장도시 이정표가 기록되었다','hamlet이 아니면 누락 이정표를 기록한다. 이미 stone_town일 수도 있어 현재 승격으로 단정하지 않는다.',%w[milestone.market_town.r06stage.stone],[['history.ts',450,463]]],
['legacy.market_fire','장터에 불이 났다 — 수리에 ${moneyWords(n(params, "cost"))}','장터에 불이 났다 — 책정된 수리비 ${moneyWords(n(params, "cost"))}','장터 화재는 예약된 사건이다. cost는 설정된 수리비이고 실제 지급은 금고 한도에 묶인다. 건물 소실 규모는 말하지 않는다.',%w[legacy.market_fire.r06town.full legacy.market_fire.r06town.partial legacy.market_fire.r06town.zero],[['history.ts',760,767],['legacy.ts',70,78],['legacy.ts',290,299]]],
['legacy.nave_rebuilt','교회의 새 회중석이 섰다','교회 회중석 재건 청원을 받아들였다','청원 accept 경로에서 지급 요청 후 즉시 flag를 세운다. 실제 건물 완공을 단정하지 않는다.',%w[legacy.nave_rebuilt.r06town.full legacy.nave_rebuilt.r06town.partial legacy.nave_rebuilt.r06town.zero],[['legacy.ts',196,202],['history.ts',767,767]]],
['legacy.charter_refused','영주가 자치 특허를 거절했다','자치 특허가 받아들여지지 않았다','첫 응답이 accept 아닌 모든 경우를 같은 template로 보낸다. 기한 만료도 포함하므로 영주의 적극 거절로 좁히지 않는다.',%w[legacy.charter_refused.r06ctx2.expired],[['history.ts',751,755]]],
['decision.market_town','목책을 두르고 시장도시를 선포했다','목책을 두를 경계를 정하고 시장도시를 선포했다','선포 때 완성 벽이 아니라 constructionSites를 만든다.',%w[decision.market_town.r06ctx2.water_reach decision.market_town.r06ctx2.land_ring],[['palisade.ts',274,308]]]
]
rows << ['person.came_of_age','어른이 되어 일을 거들기 시작했다','어른이 되었다','14세 경계 통과만 검사한다. 어른이라는 게임 단계는 보존하고 실제 노동 개시를 단정하지 않는다.',[],[['history.ts',403,408]]]
rows << ['milestone.stone_town','석벽 도시가 되었다','석벽 도시 이정표가 기록되었다','석벽 도시 단계 도달을 이정표로 기록한다. 석벽 공사가 끝났다는 뜻으로 좁히지 않는다.',[],[['history.ts',450,463]]]
changed=original.dup

evidence={}
proposals=rows.map do |id,oldtext,newtext,reason,ids,spans|
 lines=original.lines.each_with_index.select{|line,_|line.start_with?("  \"#{id}\":")}
 raise "not unique #{id}" unless lines.size==1
 line,index=lines.first
 raise "old text mismatch #{id}" unless line.include?(oldtext)
 newline=line.sub(oldtext,newtext)
 raise 'slot changed' unless line.scan(/\$\{[^}]+\}/)==newline.scan(/\$\{[^}]+\}/)
 changed=changed.sub(line,newline)
 refs=spans.map do |file,a,b|
  path='src/engine/'+file
  entry=evidence[path]||={path:path,sha256:sha(REPO+'/'+path),spans:[]}
  entry[:spans]<<{start:a,end:b,text:File.readlines(REPO+'/'+path)[a-1..b-1].join}
  {path:path,start:a,end:b}
 end
 {template:id,sourceHead:HEAD,sourceSha256:sha(REPO+'/'+SRC),line:index+1,old:line.chomp,new:newline.chomp,reason:reason,evidence:refs,relatedHeldCandidateIds:ids,unblocksAutomatically:false,status:'PROPOSED_TEXT_ONLY_INDEPENDENT_REVIEW_REQUIRED'}
end
[['history.ts',865,890]].each do |file,a,b|
 path='src/engine/'+file
 entry=evidence[path]||={path:path,sha256:sha(REPO+'/'+path),spans:[]}
 entry[:spans]<<{start:a,end:b,text:File.readlines(REPO+'/'+path)[a-1..b-1].join}
end
File.write(OUT+'/original.txt',original)
File.write(OUT+'/proposed.txt',changed)
patch,err,status=Open3.capture3('diff','-u','--label','a/'+SRC,'--label','b/'+SRC,OUT+'/original.txt',OUT+'/proposed.txt')
raise err unless status.exitstatus==1
File.write(PATCH,patch)
writej(OUT+'/PROPOSALS.json',{sourceHead:HEAD,sourceFile:SRC,sourceSha256:sha(REPO+'/'+SRC),entries:proposals})
writej(OUT+'/SOURCE_EVIDENCE.json',evidence.values)
# Apply only to a disposable artifact copy, never to REPO.
target=OUT+'/application-check'
FileUtils.mkdir_p(target+'/src/content')
File.write(target+'/'+SRC,original)
check,ce,cs=Open3.capture3('git','apply','--check',PATCH,chdir:target)
raise ce unless cs.success?
ap,ae,as=Open3.capture3('git','apply',PATCH,chdir:target)
raise ae unless as.success?
raise 'applied result mismatch' unless File.read(target+'/'+SRC)==changed
raise 'repo changed' unless File.read(REPO+'/'+SRC)==original
checks=proposals.map{|p|{template:p[:template],old_line_exact:true,interpolation_sequence_unchanged:true,changed_one_line:true}}
writej(OUT+'/VALIDATION.json',{status:'PASS_OFFLINE_TEXT_ONLY',sourceHead:HEAD,templates:proposals.size,heldCandidateLinks:proposals.sum{|p|p[:relatedHeldCandidateIds].size},originalSha256:sha(REPO+'/'+SRC),proposedSha256:sha(OUT+'/proposed.txt'),patchSha256:sha(PATCH),gitApplyCheck:true,gitApplyToArtifactCopy:true,exactAppliedCopyMatch:true,repositorySourceUnchanged:true,slotChecks:checks,typescriptRuntimeExecuted:false,contextCaptureImplemented:false,independentReviewPerformed:false})
puts "PASS #{proposals.size} templates; #{proposals.sum{|p|p[:relatedHeldCandidateIds].size}} held links; artifact-only apply"
