require 'json'
require 'digest'
base=File.dirname(__FILE__)
root=File.expand_path('../..',base)
repo='/Users/rexxa/fls-astra-steward'
p=JSON.parse(File.read(base+'/PROPOSALS.json'))
e=JSON.parse(File.read(base+'/SOURCE_EVIDENCE.json'))
sha=->(f){Digest::SHA256.file(f).hexdigest}
raise 'HEAD' unless `git -C #{repo} rev-parse HEAD`.strip==p['sourceHead']
raise 'source drift' unless sha.call(repo+'/'+p['sourceFile'])==p['sourceSha256']
e.each do |x|
 raise "source drift #{x['path']}" unless sha.call(repo+'/'+x['path'])==x['sha256']
 lines=File.readlines(repo+'/'+x['path'])
 x['spans'].each{|s|raise 'span mismatch' unless lines[s['start']-1..s['end']-1].join==s['text']}
end
holds=JSON.parse(File.read(root+'/chronicle/R06_CONTEXT_FACTLINE_HOLDS.json'))
links=p['entries'].flat_map{|x|x['relatedHeldCandidateIds']}
raise 'hold coverage' unless links.sort==holds['holds'].map{|x|x['variantId']}.sort
original=File.readlines(base+'/original.txt'); proposed=File.readlines(base+'/proposed.txt')
raise 'line counts' unless original.size==proposed.size
changed=original.zip(proposed).each_with_index.select{|(a,b),i|a!=b}
raise 'exact edit count' unless changed.size==14
p['entries'].each do |x|
 raise 'source line mismatch' unless original[x['line']-1].chomp==x['old'] && proposed[x['line']-1].chomp==x['new']
 raise 'slots' unless x['old'].scan(/\$\{[^}]+\}/)==x['new'].scan(/\$\{[^}]+\}/)
 raise 'template/fn prefix' unless x['old'].split('=>').first==x['new'].split('=>').first
end
link_sources=holds['holds'].map{|h|{path:h['reviewPath'],sha256:sha.call(root+'/'+h['reviewPath'])}}.uniq
File.write(base+'/REVIEW_INPUTS.json',JSON.pretty_generate({holdIndex:{path:'chronicle/R06_CONTEXT_FACTLINE_HOLDS.json',sha256:sha.call(root+'/chronicle/R06_CONTEXT_FACTLINE_HOLDS.json')},reviews:link_sources})+"\n")
File.write(base+'/REVALIDATION.json',JSON.pretty_generate({status:'PASS',sourceFiles:e.size,sourceSpans:e.sum{|x|x['spans'].size},modifiedLines:changed.size,unchangedOtherLines:true,exactConfirmedHoldLinks:links.size,holdIndexMatched:true,templateAndFunctionPrefixesPreserved:true,interpolationsPreserved:true,notTested:['TypeScript compilation','formatter runtime','context capture','UI','independent composed-line approval']})+"\n")
puts "PASS source #{e.size} files; 14 line edits only; 23/23 hold links; prefixes and slots preserved"
