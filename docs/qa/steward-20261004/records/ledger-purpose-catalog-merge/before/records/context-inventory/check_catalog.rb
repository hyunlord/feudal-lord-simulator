require 'json'
require 'digest'
Dir.chdir(File.expand_path('../..', __dir__))
index=JSON.parse(File.read('records/context-inventory/INDEX.json'))
catalog=JSON.parse(File.read('chronicle/CONTEXT_DRAFTS.catalog.json'))
holds=JSON.parse(File.read('chronicle/R06_CONTEXT_FACTLINE_HOLDS.json'))
entries=catalog.fetch('entries')
ids=entries.map { |e| e.fetch('id') }
abort 'duplicate/count' unless ids.uniq.size==ids.size && ids.size==catalog.fetch('count') && ids.size==index.fetch('newR06ProposalCount')
entries.each do |entry|
 source=entry.fetch('sourcePath')
 abort "hash #{source}" unless Digest::SHA256.file(source).hexdigest==entry.fetch('sourceSha256')
 abort "review #{entry['reviewPath']}" unless File.file?(File.join(entry.fetch('reviewPath'),'REVIEW.md'))
 source_entry=entry.fetch('sourceEntry')
 abort 'source text absent' unless File.read('chronicle/CONTEXT_DRAFTS.md').include?(source_entry['headline'] || source_entry.fetch('text'))
 abort 'mixed history/ledger kind' unless entry.key?('template') != entry.key?('category')
end
holds.fetch('holds').each do |hold|
 abort 'unknown held ID' unless ids.include?(hold.fetch('variantId'))
 abort 'hold review drift' unless Digest::SHA256.file(hold.fetch('reviewPath')).hexdigest==hold.fetch('reviewSha256')
end
abort 'hold catalog drift' unless holds.fetch('catalogSha256')==Digest::SHA256.file('chronicle/CONTEXT_DRAFTS.catalog.json').hexdigest
canonical_sha=Digest::SHA256.file('chronicle/variants.ko.json').hexdigest
abort 'canonical drift' unless canonical_sha==index.fetch('canonicalSha256') && canonical_sha==catalog.fetch('canonicalSha256')
result={status:'PASS_CATALOG_LINKAGE_ONLY',count:ids.size,uniqueIds:true,allSourceHashesMatch:true,allReviewsPresent:true,factlineHolds:holds.fetch('count'),canonicalSha256:canonical_sha,runtimeExecuted:false}
File.write('records/context-inventory/CATALOG_CHECK.json',JSON.pretty_generate(result)+"\n")
puts JSON.pretty_generate(result)
