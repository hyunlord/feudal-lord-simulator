require 'json';require 'fileutils'
d=__dir__;orig=File.dirname(d)+'/event-context-proposal'
Dir.children(orig).reject{|f|%w[build.rb SHA256SUMS].include?(f)}.each{|f|FileUtils.cp(orig+'/'+f,d+'/'+f)}
read=lambda{|f|JSON.parse(File.read(d+'/'+f))};write=lambda{|f,j|File.write(d+'/'+f,JSON.pretty_generate(j)+"\n")}
p=read.call('PROPOSAL.json');p['additions'].find{|r|r['variant']['id']=='reorg.petitions_surge.r06ctx.calendar'}['variant']['headline']='상인과 직인 무리의 요구가 올라왔다.';write.call('PROPOSAL.json',p)
s=read.call('PROPOSAL.schema.json');s['properties']['fields']={'type'=>'array','minItems'=>6,'maxItems'=>6,'uniqueItems'=>true,'items'=>{'enum'=>p['fields']}};s['properties']['fallback']={'type'=>'object','required'=>p['fallback'].keys,'additionalProperties'=>false,'properties'=>p['fallback'].transform_values{|v|{'const'=>v}}};s['properties']['additions']['minItems']=20;s['properties']['additions']['maxItems']=20
v=s['$defs']['variant'];v['required']=%w[id priority when headline requiredSlots retainFactLine];v['additionalProperties']=false;v['properties'].delete('text');v.delete('anyOf');v['properties']['when']['minItems']=1;v['properties']['when']['maxItems']=1;v['properties']['requiredSlots']['maxItems']=0
branches=p['fields'].flat_map do |f|
 condition={'anyOf'=>[{'type'=>'object','required'=>%w[field op value],'additionalProperties'=>false,'properties'=>{'field'=>{'const'=>'context.'+f['id']},'op'=>{'const'=>'eq'},'value'=>{'enum'=>f['values']}}},{'type'=>'object','required'=>%w[field op value],'additionalProperties'=>false,'properties'=>{'field'=>{'const'=>'context.'+f['id']},'op'=>{'const'=>'in'},'value'=>{'type'=>'array','minItems'=>1,'uniqueItems'=>true,'items'=>{'enum'=>f['values']}}}}]}
 f['templates'].map do |t|
  variant=Marshal.load(Marshal.dump(v));variant['properties']['when']['items']=condition
  {'type'=>'object','required'=>%w[template variant],'additionalProperties'=>false,'properties'=>{'template'=>{'const'=>t},'variant'=>variant}}
 end
end
s['properties']['additions']['items']={'anyOf'=>branches};write.call('PROPOSAL.schema.json',s)
c=read.call('CONTEXT.schema.json');c['properties']['recordTick']['minimum']=0;c['properties']['sourceHead']={'const'=>p['sourceHead']};known=p['fields'].flat_map{|f|f['templates'].map{|t|{'properties'=>{'status'=>{'const'=>'known'},'template'=>{'const'=>t},'captureKind'=>{'const'=>f['provenance']},'referenceVerified'=>{'const'=>true},'fields'=>{'type'=>'object','required'=>[f['id']],'additionalProperties'=>false,'properties'=>{f['id']=>{'enum'=>f['values']}}}}}}};c['anyOf']=known+[{'properties'=>{'status'=>{'const'=>'unknown'},'fields'=>{'const'=>{}}}}];write.call('CONTEXT.schema.json',c)
a=read.call('ADOPTION_LIMITS.json');a['blocks']=a['factLineReviewRequired'].map{|id|{'variantId'=>id,'status'=>'BLOCK_FACT_LINE_CONFLICT','requires'=>'Independent approval of relation-neutral baseline factual line before contextual composition','engineModified'=>false}};write.call('ADOPTION_LIMITS.json',a)
code=File.read(d+'/validate.rb').sub('minLength anyOf $defs','minLength minimum anyOf $defs').sub("  raise \"#{'#{path}'}: const\"", "  raise \"#{'#{path}'}: minimum\" if schema.key?('minimum') && value.is_a?(Numeric) && value<schema['minimum']\n  raise \"#{'#{path}'}: const\"")
code=code.sub("canonical=round+'/chronicle/variants.ko.json'","canonical=File.dirname(root)+'/event-context-independent-review/baseline647.ko.json'")
code=code.sub("independentReview:'not_performed_author_only'","independentReview:'Original review applied; revised artifact requires independent re-review'")
code=code.sub("File.write(root+'/FIXTURE_RESULTS.json'", "require_relative 'negative_schema_checks'\nnegative_results=negative_schema_checks(p,schema,context_schema,fixtures)\nFile.write(root+'/NEGATIVE_SCHEMA_RESULTS.json',JSON.pretty_generate(negative_results)+\"\\n\")\nFile.write(root+'/FIXTURE_RESULTS.json'")
File.write(d+'/validate.rb',code)
