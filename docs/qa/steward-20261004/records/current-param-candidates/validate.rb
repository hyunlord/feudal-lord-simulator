require 'json';require 'digest'
require_relative 'schema_validator'
r=__dir__;round=File.expand_path('../..',r);repo='/Users/rexxa/fls-astra-steward';read=lambda{|f|JSON.parse(File.read(r+'/'+f))};sha=lambda{|f|Digest::SHA256.file(f).hexdigest};p=read.call('ADDITIONS.json');base=read.call('baseline650.ko.json');canonical=round+'/chronicle/variants.ko.json'
raise 'baseline' unless sha.call(canonical)==p['baselineSha256'] && sha.call(r+'/baseline650.ko.json')==p['baselineSha256']
all_base=(base['historyTemplates']+base['ledgerCategories']).flat_map{|g|g['variants']};raise '650' unless all_base.size==650
adds=p['additions'].flat_map{|a|a['variants']};ids=adds.map{|v|v['id']};raise 'six unique' unless ids.size==6 && ids.uniq.size==6 && (ids&all_base.map{|v|v['id']}).empty?
# Existing draft additions/proposals must not already own a new ID.
Dir.glob(round+'/records/*/{ADDITIONS,PROPOSAL}.json').reject{|f|f.start_with?(r+'/')}.each do |f|
 data=JSON.parse(File.read(f));variants=Array(data['additions']).flat_map{|a|a['variants']||[a['variant']].compact};raise 'other proposal duplicate '+f unless (ids&variants.map{|v|v['id']}).empty?
end
merged=Marshal.load(Marshal.dump(base));p['additions'].each{|a|g=merged['historyTemplates'].find{|g|g['template']==a['template']};raise 'template not single' unless g && g['variants'].size==1;g['variants'].concat(a['variants'])}
schema=read.call('PROPOSED_VARIANTS.schema.json');validate_schema(merged,schema,schema)
current=read.call('CURRENT_VARIANTS.schema.json');compatibility=adds.map{|v|ok=true;begin;validate_schema(v,current['$defs']['variant'],current);rescue RuntimeError;ok=false;end;{id:v['id'],currentSchemaShapeAccepted:ok,inputGuardProvidedByCurrentSchema:false}}
raise 'neq not really new' unless compatibility.count{|x|!x[:currentSchemaShapeAccepted]}==1
restored=Marshal.load(Marshal.dump(merged));restored['historyTemplates'].each{|g|g['variants'].reject!{|v|ids.include?(v['id'])}};raise 'baseline modified' unless restored==base
# Numeric integer semantics match Number.isSafeInteger for finite JSON numbers, including 1.0.
def select_variant(template,params)
 return nil unless params.is_a?(Hash)
 if template=='legacy.mayor_demand'
  id=params['candidateId'];return nil unless id.is_a?(String)
  template+'.r06raw.'+(id.empty? ? 'unidentified':'identified')
 else
  field={'plague.new_graves'=>'dead','plague.empty_streets'=>'houses'}[template];return nil unless field
  count=params[field];return nil unless count.is_a?(Numeric)&&count.finite?&&count==count.to_i&&count>=1&&count<=9007199254740991
  template+'.r06raw.'+(count==1 ? 'one':'several')
 end
end
fixtures=read.call('FIXTURES.json');results=fixtures.map{|f|actual=select_variant(f['template'],f['params']);raise 'fixture '+f['id'] unless actual==f['expectedVariant'];{id:f['id'],selected:actual,fallback:actual.nil?}}
nonjson=[Float::NAN,Float::INFINITY,-Float::INFINITY];%w[plague.new_graves plague.empty_streets].each{|t|field=t=='plague.new_graves' ? 'dead':'houses';nonjson.each{|v|raise 'nonfinite' unless select_variant(t,{field=>v}).nil?}}
blocks=read.call('INSTALL_BLOCKS.json');raise 'six guards' unless blocks['blocks'].map{|b|b['variantId']}.sort==ids.sort
adds.each{|v|raise 'name or factline' unless v['requiredSlots']==[] && v['retainFactLine']==true && !v['headline'].match?(/[{}]/)}
source=read.call('SOURCE_EVIDENCE.json');source.each{|s|body=File.read(repo+'/'+s['path']);raise 'source drift' unless Digest::SHA256.hexdigest(body)==s['sha256'];s['spans'].each{|x|raise 'span drift' unless body.lines[(x['start']-1)...x['end']].join==x['text']}}
raise 'canonical mutation' unless sha.call(canonical)==p['baselineSha256']
v={status:'AUTHOR_ONLY_PROPOSED_GUARDED_CANDIDATES',templates:3,variants:6,baselineCount:650,hypotheticalMergedCount:656,baselineUnchanged:true,canonicalModified:false,fixtureCount:fixtures.size,fallbackCount:results.count{|x|x[:fallback]},nonJsonNonfiniteCases:6,proposedSchemaPassed:true,currentSchemaCompatibility:compatibility,installBlocks:6,operatorExtension:'neq after string guard only',sourceFiles:source.size,sourceSpans:source.sum{|x|x['spans'].size},runtimeVerified:false,fix12Executed:false,independentReview:'pending'}
File.write(r+'/FIXTURE_RESULTS.json',JSON.pretty_generate(results)+"\n");File.write(r+'/VALIDATION.json',JSON.pretty_generate(v)+"\n");puts JSON.pretty_generate(v)
