require 'json'
require 'digest'
ROOT='/tmp/astra-steward-r07-20261004'; REPO='/Users/rexxa/fls-astra-steward'; OUT=__dir__
def read(p); JSON.parse(File.read(p)); end
def save(n,o); File.write(File.join(OUT,n),JSON.pretty_generate(o)+"\n"); end
def sha(p); Digest::SHA256.file(p).hexdigest; end
e=read(ROOT+'/content/events.json'); r=read(ROOT+'/content/registry.json')['entries']; fx=read(ROOT+'/content/EFFECT_CATALOG.json')['effects'].to_h{|x| [x['id'], x['value']||x]}; sources=read(ROOT+'/content/SOURCE_CATALOG.json')['sources'].to_h{|x|[x['id'],x]}
raise 'counts' unless e.size==200 && r.size==200 && e.map{|x|x['id']}.sort==r.map{|x|x['id']}.sort && e.map{|x|x['id']}.uniq.size==200
ri=r.to_h{|x|[x['id'],x]}; blocked=e.select{|x|x.dig('integration','mode')=='blocked_unsupported_effect'}
classes={
'court_procedure'=>[63,103,109,135],
'chattels_contract_delivery'=>[64,79,86,91,96,112,119,192],
'land_use_damage_tenure'=>[66,69,71,72,73,74,89,94,98,106,110,122,129,137,190,197],
'labour_public_work_relief'=>[70,114,125,191],
'debt_guarantee_setoff_escrow'=>[82,97,121,126,134,184,186],
'documents_accounts_identity'=>[81,84,99,107,120,189,195,198,200],
'church_office_restricted_gift'=>[104,116,118],
'family_wardship_care_consent'=>[181,182,183,185,187,188,193,194,196,199]
}
bounds={
'court_procedure'=>'file_suit는 기존 권원 claim의 소송이며 소환 송달·경계 답사·재판 밖 합의가 아니다. seek_suit_patron은 기존 GameCommand이지만 RegistryEffect에는 없다.',
'chattels_contract_delivery'=>'order_timber는 목재 주문뿐이다. treasury/term은 물품 동일성·배송·반환·담보·상계·개인별 채권자를 보존하지 않는다.',
'land_use_damage_tenure'=>'rights_scope는 기존 suit.pieceId의 sharePermille만 갱신한다. 사용 목적·필지 경계·임대·피해 책임·통행·동의·별도 수익자의 법적 관계를 만들지 않는다.',
'labour_public_work_relief'=>'장려금·시장 부담·영지 방침은 개인 역무·공동 공사 합의·현물 종자 대여·견적별 가족 부담 배분을 생성하지 않는다.',
'debt_guarantee_setoff_escrow'=>'term.installments는 영주 cash/arrears 지급이다. 개인 채무·보증·보관금·상계의 쌍방 당사자 원장이 아니다. marriage promises는 실제 혼인 계약에 한정된다.',
'documents_accounts_identity'=>'add_suit_evidence는 기존 소송 증거 종류/가중치다. 실제 문서 동일성·인증·중복 정정·지급 영수증·수익자·기록 보관 접근권을 모델링하지 않는다.',
'church_office_restricted_gift'=>'등록기에는 성직 추천/교환 및 목적 제한 교회 재산의 당사자별 수탁·지출 상태가 없다. treasury나 faction_relation만으로 구현할 수 없다.',
'family_wardship_care_consent'=>'혼인 promise 이행은 해당 실제 계약의 영주 지급 의무다. 미성년 보호재산·유언 집행·거처 동의·간병·자발적 서약/방문과 대리권을 만드는 일반 가족 사례 명령이 아니다.'}
all=classes.values.flatten; raise 'classification coverage' unless all.sort==blocked.map{|x|x['number']}.sort && all.uniq.size==61
refs=['src/content/registry/registryTypes.ts:10-54','src/engine/registry.ts:176-225','src/engine/registry.ts:248-315','src/engine/estateSuits.ts:59-108','src/engine/marriage.ts:179-224']
rows=blocked.map do |x|
 entry=ri.fetch(x['id']); cls=classes.find{|k,ns|ns.include?(x['number'])}.first
 proposals=x['newEffectLinks'].map{|id| p=fx.fetch(id); {id:id,requiredCapability:p['problem']||p['title'],requiredState:p['requiredState']||p['minimumState'],operations:p['operations']||p['proposedActions'],existingBoundary:p['mustNotReuse']||p['existingBoundary']||p['need']}}
 {id:x['id'],title:x['title'],class:cls,proposals:proposals,currentEngineBoundary:bounds.fetch(cls),sourceRefs:refs,commandCounts:entry['choices'].to_h{|c|[c['id'],c['commands'].size]},coreDisposition:'KEEP_UNSUPPORTED_CORE',historicalFilters:(entry['unsupportedFilters']||[]).select{|f|f['id'].match?(/history_window|later_practice|source_fulltext|source_date/)},sameIdEngineInstalled:false}
end
sourcepaths={'src/content/registry/registryTypes.ts'=>[[1,88]],'src/content/registry/registryEntries.ts'=>[[1,30]],'src/content/registry/draftEvents.ts'=>[[1,95]],'src/engine/registry.ts'=>[[36,75],[176,244],[248,315]],'src/engine/estateSuits.ts'=>[[59,108]],'src/engine/marriage.ts'=>[[179,224]],'src/engine/townAgency.ts'=>[[80,94]]}
source_records=sourcepaths.map{|p,sp| t=File.readlines(REPO+'/'+p); {path:p,sha256:sha(REPO+'/'+p),spans:sp.map{|a,b|b=[b,t.size].min; {from:a,to:b,text:t[(a-1)..(b-1)].join}}}}
types=File.read(REPO+'/src/content/registry/registryTypes.ts'); commands=types.scan(/readonly command: "([^"]+)"/).flatten
engineids=File.read(REPO+'/src/content/registry/draftEvents.ts').scan(/id: "(ck_evt_\d+)"/).flatten.uniq
matrix=e.map do |x|
 y=ri[x['id']]; cs=y['choices'].flat_map{|c|c['commands'].map{|z|z['type']}}.compact
 {id:x['id'],integrationMode:x.dig('integration','mode'),enabledInSidecar:y['enabledInEngine'],sameIdEngineEntry:engineids.include?(x['id']),commands:cs.uniq,commandsOutsideRegistryEffect:cs.uniq-commands,unsupportedFilters:y['unsupportedFilters']||[],sourceCatalogRestrictions:(x.dig('history','sourceIds')||[]).map{|id|s=sources[id]; s && s['productionUse'] ? {id:id,status:s['productionUse'],limit:s['limit']} : nil}.compact,disposition:blocked.include?(x) ? 'core_unsupported_plus_infrastructure' : 'draft_requires_adapter_and_per_event_review_not_runtime_pass'}
end
inputs=Dir[ROOT+'/content/*'].select{|p|File.file?(p)}.sort.map{|p|{path:p.delete_prefix(ROOT+'/'),sha256:sha(p)}}
manifest=File.readlines(ROOT+'/content/SHA256SUMS').reject{|l|l.strip.empty?}.map{|l|sum,p=l.strip.split(/\s+/,2); p=p.sub(/^\*/, ''); full=ROOT+'/content/'+p; {path:p,pass:File.file?(full)&&sha(full)==sum}}
empty=rows.count{|x|x[:commandCounts].values.all?(&:zero?)}
raise 'blocked split' unless blocked.size==61 && empty==60
save('CORE_MAPPING.json',rows);save('ALL200_BOUNDARIES.json',matrix);save('SOURCE_EVIDENCE.json',source_records);save('INPUTS.json',inputs)
save('RESULT.json',{status:'STATIC_CURRENT_CONTRACT_AUDIT_COMPLETE',sourceHead:`git -C #{REPO} rev-parse HEAD`.strip,eventCount:e.size,registryEntryCount:r.size,choiceCount:e.sum{|x|x['choices'].size},commandTemplateCount:r.sum{|x|x['choices'].sum{|c|c['commands'].size}},blockedCoreEvents:61,allChoicesUnsupportedEvents:60,mixedBlockedEvent:'ck_evt_135',classCounts:rows.group_by{|x|x[:class]}.transform_values(&:size),enabledSidecar:r.count{|x|x['enabledInEngine']},sameIdEngineEntries:engineids,registryEffectCommands:commands,commandsOutsideRegistryEffect:matrix.flat_map{|x|x[:commandsOutsideRegistryEffect]}.uniq.sort,manifest:manifest,engineExecuted:false,contentModified:false,full200SemanticRevalidation:false,minimumChange:'189 access-only unsupportedFilter removal proposed; keep context, literal false, empty commands and disabled status',sourceDateHold195:'KEEP',notes:['60 all-choice unsupported and 61 integration blocked are different correct metrics','Same ID engine subset is not proof of importing the sidecar or matching all semantics']})
raise 'manifest failed' unless manifest.all?{|m|m[:pass]}
puts JSON.pretty_generate(read(OUT+'/RESULT.json').reject{|k,v|k=='manifest'})
