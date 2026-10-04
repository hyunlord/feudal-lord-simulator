require 'csv';require 'json';require 'digest';require 'fileutils';require 'open3'
REPO='/Users/rexxa/fls-astra-steward';OLD='/tmp/astra-steward-r07-20261004';NEW='/tmp/astra-steward-r08-20261004';OUT=NEW+'/records/assets-current'
def sha(p);Digest::SHA256.file(p).hexdigest;end
def json(p,v);File.write(p,JSON.pretty_generate(v)+"\n");end
head,status=Open3.capture2('git','-C',REPO,'rev-parse','HEAD');raise 'head' unless status.success? && head.strip=='5fb1aebfe735592c1424c947e88388d4ffe21742'
old=JSON.parse(File.read(OLD+'/records/ASSET_RECONCILIATION_R07.json'))
ledgerpath=REPO+'/assets-inbox/INBOX_LEDGER.csv';planpath=OLD+'/install-plan-updated/INVENTORY.csv'
ledger=CSV.read(ledgerpath,headers:true);plan=CSV.read(planpath,headers:true)
by=ledger.each_with_index.group_by{|r,i|r['file']};issues=[]
issues<<'ledger SHA differs R07' unless sha(ledgerpath)==old['ledgerSha256']
issues<<'plan SHA differs R07' unless sha(planpath)==old['planSha256']
rows=plan.map do |r|
 key=r['canonical_ledger_path'] || r['ledger_file'];matches=by[key] || [];issue=[]
 issue<<'ledger match not unique' unless matches.size==1
 l,i=matches.first
 if l
  issue<<'not confirmed uninstalled' unless l['status']=='confirmed' && l['installed_by'].to_s.empty?
  issue<<'ledger SHA differs plan' unless l['sha256']==r['source_sha256']
  issue<<'status differs plan' unless l['status']==r['current_status'] && l['installed_by'].to_s==r['current_installed_by'].to_s
  issue<<'line differs plan' unless i+2==r['current_ledger_line'].to_i
 end
 path=REPO+'/'+r['source_path'];raise 'unsafe source' unless r['source_path'].start_with?('assets-inbox/') && !r['source_path'].split('/').include?('..')
 h=sha(path);bytes=File.size(path)
 issue<<'actual SHA differs plan' unless h==r['source_sha256']
 issue<<'bytes differs plan' if r['source_bytes'] && bytes!=r['source_bytes'].to_i
 dims=nil
 if File.extname(path)=='.png'
  raw=File.binread(path,24);raise 'PNG signature' unless raw[0,8]=="\x89PNG\r\n\x1a\n".b;dims=raw[16,8].unpack('NN')
  issue<<'PNG dimensions differ plan' if r['width'] && dims!=[r['width'].to_i,r['height'].to_i]
 end
 {path:r['source_path'],ledgerKey:key,sha256:h,bytes:bytes,dimensions:dims,ledgerLine:i && i+2,status:l && l['status'],installedBy:l && l['installed_by'],usesLedgerFileFallback:r['canonical_ledger_path'].nil?,targetPath:r['target_path'],targetCurrentlyExists:r['target_path'] && File.exist?(REPO+'/'+r['target_path']),targetCurrentSHA:r['target_path'] && File.file?(REPO+'/'+r['target_path']) ? sha(REPO+'/'+r['target_path']) : nil,issues:issue}
end
issues+=rows.select{|r|!r[:issues].empty?}.map{|r|{path:r[:path],issues:r[:issues]}}
issues<<'duplicate source path' unless rows.map{|r|r[:path]}.uniq.size==rows.size
issues<<'counts differ' unless rows.size==858 && ledger.size==5885 && rows.sum{|r|r[:bytes]}==85287352
landmarks=rows.select{|r|r[:path].start_with?('assets-inbox/landmarks/')};issues<<'landmark count differs' unless landmarks.size==44
exclusions=CSV.read(OLD+'/install-plan-updated/EXCLUSIONS.csv',headers:true)
 uninstalled=ledger.select{|r|r['status']=='confirmed' && r['installed_by'].to_s.empty?}.map{|r|r['file']}.sort
 partition=rows.map{|r|r[:ledgerKey]}+exclusions.map{|r|r['file']}
 issues<<'confirmed uninstalled partition mismatch' unless partition.sort==uninstalled && partition.uniq.size==partition.size && exclusions.size==1363
 exclusions.each{|r|m=by[r['file']];issues<<'exclusion ledger mismatch' unless m && m.size==1 && m[0][0]['sha256']==r['sha256'] && m[0][0]['status']=='confirmed' && m[0][0]['installed_by'].to_s.empty?}
 copies=Dir.children(OLD+'/install-plan-updated').sort.map do |f|
 src=OLD+'/install-plan-updated/'+f;dst=NEW+'/install-plan-updated/'+f
 raise 'unexpected plan nonfile' unless File.file?(src)
 if File.exist?(dst)
  raise "existing destination conflict #{dst}" unless sha(dst)==sha(src)
 else
  FileUtils.copy_file(src,dst)
 end
 {source:src,destination:dst,sha256:sha(src),unchanged:sha(dst)==sha(src)}
end
sources=[ledgerpath,planpath,OLD+'/ASSET_STRATEGY.md',OLD+'/REPORT.md',OLD+'/records/ASSET_RECONCILIATION_R07.json',OLD+'/records/storage-background-art-audit-r07/REPORT.md',OLD+'/records/storage-background-art-audit-r07/PLAN_ROWS.json',REPO+'/src/content/buildingCatalog.ts',REPO+'/src/content/buildingConfig.ts',REPO+'/src/geometry/buildingFootprint.ts',REPO+'/docs/ops/install-plan-20261003/SPECS/wave12-manor.md',REPO+'/public/assets/ui/seal_slot.png']
json(OUT+'/SOURCE_PINS.json',sources.map{|p|{path:p,sha256:sha(p)}})
json(OUT+'/ASSET_BYTES.json',rows);json(OUT+'/APPROVED_44.json',landmarks);json(OUT+'/PLAN_COPY_PROVENANCE.json',copies)
result={verdict:issues.empty? ? 'PASS_CURRENT_BYTES_AND_LEDGER_NO_CHANGE' : 'FAIL',head:head.strip,ledgerRows:ledger.size,planRows:plan.size,sourceFilesHashed:rows.size,sourceBytes:rows.sum{|r|r[:bytes]},ledgerSHA:sha(ledgerpath),planSHA:sha(planpath),sameLedgerAsR07:sha(ledgerpath)==old['ledgerSha256'],samePlanAsR07:sha(planpath)==old['planSha256'],ledgerStatusCounts:ledger.group_by{|r|r['status']}.transform_values(&:size),planActions:plan.group_by{|r|r['round_action']}.transform_values(&:size),confirmedUninstalled:uninstalled.size,excludedConfirmedUninstalled:exclusions.size,partitionComplete:partition.sort==uninstalled,fallbackKeys:rows.count{|r|r[:usesLedgerFileFallback]},approved44:landmarks.size,plannedTargetExisting:rows.count{|r|r[:targetCurrentlyExists]},issues:issues,installed:false,engineRun:false,sourceModified:false,scope:'Current source bytes and ledger only; not pixel quality, renderer selection or runtime installation'}
json(OUT+'/RESULT.json',result);puts JSON.pretty_generate(result)
raise 'asset audit failed' unless issues.empty?
