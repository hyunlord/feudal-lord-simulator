require 'json'
require 'digest'
ROOT='/tmp/astra-steward-r07-20261004'; OUT=__dir__; BEFORE=ROOT+'/records/content-source-filter-fix-r07/before'; CURRENT=ROOT+'/content'
def j(p); JSON.parse(File.read(p)); end
def digest(p); Digest::SHA256.file(p).hexdigest; end
before=j(BEFORE+'/registry.json'); current=j(CURRENT+'/registry.json'); expected=Marshal.load(Marshal.dump(before)); target=expected['entries'].find{|x|x['id']=='ck_evt_189'}; removed=target['unsupportedFilters'].select{|f|f['id']=='NE_SR01_KI09_source_fulltext'}; raise 'not exactly one removed item' unless removed.size==1
target['unsupportedFilters'].reject!{|f|f['id']=='NE_SR01_KI09_source_fulltext'}; raise 'unexpected structural change' unless expected==current
old189=before['entries'].find{|x|x['id']=='ck_evt_189'}; new189=current['entries'].find{|x|x['id']=='ck_evt_189'}
%w[conditions choices enabledInEngine].each{|k|raise "changed #{k}" unless old189[k]==new189[k]}
raise 'not blocked' unless new189['conditions']=={'literal'=>false} && new189['enabledInEngine']==false && new189['choices'].size==3 && new189['choices'].all?{|c|c['commands']==[] && c.dig('conditions','ast')=={'literal'=>false}}
raise 'context hold missing' unless new189['unsupportedFilters'].any?{|f|f['id']=='NE_SR01_KI09_context' && f['onMissing']=='block_entry'}
raise '199 drift' unless before['entries'].reject{|x|x['id']=='ck_evt_189'}==current['entries'].reject{|x|x['id']=='ck_evt_189'}
inputs=j(ROOT+'/records/content-handoff-current-r07/INPUTS.json'); allowed=%w[content/registry.json content/CHANGES.md content/SHA256SUMS]; unchanged=inputs.reject{|x|allowed.include?(x['path'])};raise 'unallowed input changed' unless unchanged.all?{|x|digest(ROOT+'/'+x['path'])==x['sha256']}
raise 'before not audited baseline' unless digest(BEFORE+'/registry.json')==inputs.find{|x|x['path']=='content/registry.json'}['sha256']
cs=j(CURRENT+'/SOURCE_CATALOG.json')['sources'].find{|x|x['id']=='CS09'};raise 'CS09 status' unless cs['productionUse']=='LIMITED_TO_CONFIRMED_CLAIM'
e=j(CURRENT+'/events.json'); ri=current['entries'].to_h{|x|[x['id'],x]}; blocked=e.select{|x|x.dig('integration','mode')=='blocked_unsupported_effect'}; all_empty=blocked.count{|x|ri.fetch(x['id'])['choices'].all?{|c|c['commands'].empty?}};raise 'counts drift' unless e.size==200 && blocked.size==61 && all_empty==60 && current['entries'].all?{|x|x['enabledInEngine']==false}
lines=File.readlines(CURRENT+'/SHA256SUMS').reject{|l|l.strip.empty?};raise 'manifest count' unless lines.size==25;manifest=lines.map{|l|s,p=l.strip.split(/\s+/,2);p=p.sub(/^\*/,'');raise "manifest #{p}" unless digest(CURRENT+'/'+p)==s;p}
old_log=File.read(BEFORE+'/CHANGES.md');new_log=File.read(CURRENT+'/CHANGES.md');raise 'historical log altered' unless new_log.start_with?(old_log) || new_log.end_with?(old_log)
result={status:'PASS_NARROW_POST_APPLICATION_REVIEW',structuralChanges:[{op:'remove',eventId:'ck_evt_189',field:'unsupportedFilters',itemId:removed.first['id']}],exactExpectedObject:true,other199Unchanged:true,conditionsChoicesEnabledUnchanged:true,contextHoldPreserved:true,unallowedContentInputsUnchanged:unchanged.size,sourceCatalogByteUnchanged:true,cs09ProductionUse:cs['productionUse'],eventCount:200,coreBlocked:61,allChoicesUnsupported:60,enabledSidecar:0,manifestPassCount:manifest.size,historyLogPreserved:true,beforeRegistrySha256:digest(BEFORE+'/registry.json'),afterRegistrySha256:digest(CURRENT+'/registry.json'),engineExecuted:false,contentModifiedByReviewer:false}
File.write(OUT+'/RESULT.json',JSON.pretty_generate(result)+"\n");puts JSON.pretty_generate(result)
