require 'json'
require 'digest'
ROOT='/tmp/astra-steward-r06-20261004/records'
BASE=ROOT+'/event-context-revised'
def validate_schema(v,s,root,path='$')
 if s['$ref']; validate_schema(v,s['$ref'].sub('#/','').split('/').reduce(root){|n,k|n.fetch(k)},root,path);end
 if s['type']
  ok=Array(s['type']).any?{|t|case t;when 'object';v.is_a?(Hash);when 'array';v.is_a?(Array);when 'string';v.is_a?(String);when 'integer';v.is_a?(Integer);when 'number';v.is_a?(Numeric);when 'boolean';[true,false].include?(v);when 'null';v.nil?;else;raise 'unsupported type';end}
  raise 'type' unless ok
 end
 raise 'const' if s.key?('const') && v!=s['const']
 raise 'enum' if s['enum'] && !s['enum'].include?(v)
 if v.is_a?(Hash)
  raise 'required' unless (Array(s['required'])-v.keys).empty?
  properties=s.fetch('properties',{})
  raise 'extra' if s['additionalProperties']==false && !(v.keys-properties.keys).empty?
  properties.each{|k,sub|validate_schema(v[k],sub,root) if v.key?(k)}
 elsif v.is_a?(Array)
  raise 'length' if s['minItems'] && v.size<s['minItems'] || s['maxItems'] && v.size>s['maxItems']
  raise 'unique' if s['uniqueItems'] && v.uniq!=v
  v.each{|x|validate_schema(x,s['items'],root)} if s['items']
 elsif v.is_a?(String)
  raise 'short' if s['minLength'] && v.length<s['minLength']
  raise 'pattern' if s['pattern'] && !Regexp.new(s['pattern']).match?(v)
 elsif v.is_a?(Numeric)
  raise 'minimum' if s['minimum'] && v<s['minimum']
 end
 if s['anyOf']
  good=s['anyOf'].any? do |sub|
   begin;validate_schema(v,sub,root);true;rescue RuntimeError;false;end
  end
  raise 'anyOf' unless good
 end
 true
end
p=JSON.parse(File.read(BASE+'/PROPOSAL.json')); old=JSON.parse(File.read(ROOT+'/event-context-proposal/PROPOSAL.json'))
s=JSON.parse(File.read(BASE+'/PROPOSAL.schema.json'));c=JSON.parse(File.read(BASE+'/CONTEXT.schema.json'));fixtures=JSON.parse(File.read(BASE+'/FIXTURES.json'))
changes=[]
p['additions'].zip(old['additions']).each{|a,b|changes<<{id:a['variant']['id'],before:b['variant'],after:a['variant']} if a!=b}
raise 'unexpected changes' unless changes.size==1 && changes.first[:id]=='reorg.petitions_surge.r06ctx.calendar'
copy=Marshal.load(Marshal.dump(p));copy['additions']=old['additions'];raise 'other package changes' unless copy==old
validate_schema(p,s,s)
load BASE+'/negative_schema_checks.rb'
negative=negative_schema_checks(p,s,c,fixtures)
raise '74 cases' unless negative[:negativeCount]==74
source=JSON.parse(File.read(BASE+'/SOURCE_EVIDENCE.json'))
source.each{|x|text=File.read('/Users/rexxa/fls-astra-steward/'+x['path']);raise 'source drift' unless Digest::SHA256.hexdigest(text)==x['sha256'];x['spans'].each{|sp|raise 'span drift' unless text.lines[(sp['start']-1)..(sp['end']-1)].join==sp['text']}}
manifest=File.readlines(BASE+'/SHA256SUMS').all?{|l|sha,f=l.strip.split(/\s+/,2);sha==Digest::SHA256.file(BASE+'/'+f).hexdigest};raise 'manifest' unless manifest
baseline=ROOT+'/event-context-independent-review/baseline647.ko.json'
raise '647 hash' unless Digest::SHA256.file(baseline).hexdigest==p['baselineSha256']
live='/tmp/astra-steward-r06-20261004/chronicle/variants.ko.json';d=JSON.parse(File.read(live));count=(d['historyTemplates']+d['ledgerCategories']).sum{|g|g['variants'].size}
blocks=JSON.parse(File.read(BASE+'/ADOPTION_LIMITS.json'))['blocks'];raise 'block ids' unless blocks.map{|b|b['variantId']}.sort==%w[marriage.inherited.r06ctx.kin marriage.inherited.r06ctx.son] && blocks.all?{|b|b['status']=='BLOCK_FACT_LINE_CONFLICT'}
result={status:'PASS_DRAFT_18_WITH_2_FACT_LINE_BLOCKS',changes:changes,negativeSchema:negative,sourceFiles:source.size,sourceSpans:source.sum{|x|x['spans'].size},candidateManifestPassed:manifest,baseline647Sha256:Digest::SHA256.file(baseline).hexdigest,baselinePath:baseline,currentCanonicalVariants:count,currentCanonicalSha256:Digest::SHA256.file(live).hexdigest,currentCanonicalDiffersFromBaseline:Digest::SHA256.file(live).hexdigest!=p['baselineSha256'],blocks:blocks,runtimeExecuted:false,provenanceAdapterVerified:false,engineInstallRequiredForDraftTask:false}
File.write(__dir__+'/RESULT.json',JSON.pretty_generate(result)+"\n")
puts JSON.pretty_generate(result.reject{|k,v|k==:negativeSchema})
