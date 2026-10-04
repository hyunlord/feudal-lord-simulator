require 'json'
require 'digest'
def validate_schema(value, schema, root, path='$')
  allowed=%w[$schema $id title description $ref type required properties additionalProperties const enum pattern items uniqueItems minItems maxItems minLength minimum anyOf $defs]
  raise "unsupported schema keyword #{schema.keys-allowed}" unless (schema.keys-allowed).empty?
  if schema['$ref']
    target=schema['$ref'].delete_prefix('#/').split('/').reduce(root){|node,key|node.fetch(key)}
    validate_schema(value,target,root,path)
  end
  if schema.key?('type')
    matched=Array(schema['type']).any? do |type|
      case type
      when 'object' then value.is_a?(Hash)
      when 'array' then value.is_a?(Array)
      when 'string' then value.is_a?(String)
      when 'number' then value.is_a?(Numeric)
      when 'integer' then value.is_a?(Integer)
      when 'boolean' then value==true || value==false
      when 'null' then value.nil?
      else raise "unsupported type #{type}"
      end
    end
    raise "#{path}: type" unless matched
  end
  raise "#{path}: minimum" if schema.key?('minimum') && value.is_a?(Numeric) && value<schema['minimum']
  raise "#{path}: const" if schema.key?('const') && value != schema['const']
  raise "#{path}: enum" if schema['enum'] && !schema['enum'].include?(value)
  if value.is_a?(Hash)
    raise "#{path}: required" unless (Array(schema['required'])-value.keys).empty?
    props=schema['properties'] || {}
    raise "#{path}: additional properties" if schema['additionalProperties']==false && !(value.keys-props.keys).empty?
    props.each{|key,s|validate_schema(value[key],s,root,"#{path}.#{key}") if value.key?(key)}
  elsif value.is_a?(Array)
    raise "#{path}: minItems" if schema['minItems'] && value.size<schema['minItems']
    raise "#{path}: maxItems" if schema['maxItems'] && value.size>schema['maxItems']
    raise "#{path}: uniqueItems" if schema['uniqueItems'] && value.uniq.size!=value.size
    value.each_with_index{|v,i|validate_schema(v,schema['items'],root,"#{path}[#{i}]")} if schema['items']
  elsif value.is_a?(String)
    raise "#{path}: minLength" if schema['minLength'] && value.length<schema['minLength']
    raise "#{path}: pattern" if schema['pattern'] && !Regexp.new(schema['pattern']).match?(value)
  end
  if schema['anyOf']
    matches=schema['anyOf'].count do |sub|
      begin
        validate_schema(value,sub,root,path);true
      rescue RuntimeError
        false
      end
    end
    raise "#{path}: anyOf" if matches.zero?
  end
  true
end
root=__dir__;round=File.dirname(File.dirname(root));repo='/Users/rexxa/fls-astra-steward';p=JSON.parse(File.read(root+'/PROPOSAL.json'));schema=JSON.parse(File.read(root+'/PROPOSAL.schema.json'));validate_schema(p,schema,schema)
canonical=File.dirname(root)+'/event-context-independent-review/baseline647.ko.json';raise 'canonical changed' unless Digest::SHA256.file(canonical).hexdigest==p['baselineSha256'];d=JSON.parse(File.read(canonical));raise '647' unless (d['historyTemplates']+d['ledgerCategories']).sum{|x|x['variants'].size}==647
raise '8 templates20 lines' unless p['additions'].size==20 && p['additions'].map{|x|x['template']}.uniq.size==8
ids=p['additions'].map{|x|x['variant']['id']};raise 'unique' unless ids.uniq.size==20;existing=(d['historyTemplates']+d['ledgerCategories']).flat_map{|g|g['variants'].map{|v|v['id']}};raise 'collision' unless (existing&ids).empty?
p['fields'].each{|f|raise 'field contract' unless %w[id values templates capture producer currentRecordStorage currentOtherStorage immutableReconstruction provenance captureRule].all?{|k|f.key?(k)} && f['values'].uniq.size==f['values'].size}
p['additions'].each do |row|
 v=row['variant'];raise 'fact/name guarantee' unless v['retainFactLine']==true && v['requiredSlots']==[] && !v['headline'].match?(/[{}]/)
 v['when'].each{|c|f=p['fields'].find{|f|'context.'+f['id']==c['field']};raise 'field scope' unless f && f['templates'].include?(row['template']);values=c['value'].is_a?(Array) ? c['value'] : [c['value']];raise 'enum domain' unless (values-f['values']).empty?}
end
# This oracle tests proposed selection, not an implemented event-context capture or history formatter.
def select_candidate(package,template,context)
 context_schema=JSON.parse(File.read(__dir__+'/CONTEXT.schema.json'))
 begin;validate_schema(context,context_schema,context_schema);rescue RuntimeError;return nil;end
 return nil unless context.is_a?(Hash) && context['status']=='known' && context['recordId']=='h-test' && context['recordTick']==1000 && context['template']==template && context['sourceHead']==package['sourceHead'] && context['referenceVerified']==true && context['fields'].is_a?(Hash)
 matches=package['additions'].select do |r|
  next false unless r['template']==template
  r['variant']['when'].all? do |c|
   key=c['field'].delete_prefix('context.');spec=package['fields'].find{|x|x['id']==key};value=context['fields'][key]
   next false unless spec && context['captureKind']==spec['provenance'] && value.is_a?(String) && spec['values'].include?(value)
   c['op']=='eq' ? value==c['value'] : c['value'].include?(value)
  end
 end
 raise 'ambiguous' if matches.size>1
 matches.first && matches.first['variant']['id']
end
fixtures=JSON.parse(File.read(root+'/FIXTURES.json'));context_schema=JSON.parse(File.read(root+'/CONTEXT.schema.json'));fixtures.select{|f|f['expected']}.each{|f|validate_schema(f['context'],context_schema,context_schema)};results=fixtures.map{|f|actual=select_candidate(p,f['template'],f['context']);raise "fixture #{f['id']}" unless actual==f['expected'];{id:f['id'],selected:actual,fallback:actual.nil?}}
# Extra adversarial envelope/domain checks, distinct from positive selector fixtures.
extra=[];fixtures.select{|f|f['expected']}.first(8).each do |f|
 %w[wrong_domain missing_record bad_capture].each do |kind|
  c=Marshal.load(Marshal.dump(f['context']));case kind;when 'wrong_domain';c['fields']=c['fields'].transform_values{'not_a_source_value'};when 'missing_record';c.delete('recordId');when 'bad_capture';c['captureKind']='current_person_lookup';end
  raise 'envelope accepted' unless select_candidate(p,f['template'],c).nil?;extra<<{id:f['id']+'.'+kind,fallback:true}
 end
end
# Name resolution contract fixture: frozen identity remains unchanged while display name is supplied at reading.
frozen={'guardianId'=>'p17'};before=Marshal.dump(frozen);read=lambda{|params,names|names[params['guardianId']]||'후견인'}
name_tests=[read.call(frozen,{'p17'=>'로버트'})=='로버트',read.call(frozen,{'p17'=>'큰 로버트'})=='큰 로버트',read.call(frozen,{})=='후견인',Marshal.dump(frozen)==before];raise 'name contract' unless name_tests.all?
sources=JSON.parse(File.read(root+'/SOURCE_EVIDENCE.json'));sources.each{|s|text=File.read(repo+'/'+s['path']);raise 'source hash' unless Digest::SHA256.hexdigest(text)==s['sha256'];s['spans'].each{|sp|raise 'source span' unless text.lines[(sp['start']-1)..(sp['end']-1)].join==sp['text']}}
oldschema=JSON.parse(File.read(round+'/chronicle/variants.schema.json'));rejected=false;begin;validate_schema(p['additions'].first['variant']['when'].first,oldschema['$defs']['condition'],oldschema);rescue RuntimeError;rejected=true;end;raise 'must be proposed extension' unless rejected
require_relative 'negative_schema_checks'
negative_results=negative_schema_checks(p,schema,context_schema,fixtures)
File.write(root+'/NEGATIVE_SCHEMA_RESULTS.json',JSON.pretty_generate(negative_results)+"\n")
File.write(root+'/FIXTURE_RESULTS.json',JSON.pretty_generate({selection:results,adversarialEnvelope:extra,nameContract:{cases:4,passed:true,scope:'Offline ID/display substitution contract only; production historyParams not executed'}})+"\n")
v={status:'AUTHOR_PROPOSAL_OFFLINE_CHECKS_PASSED',templates:8,variants:20,contextFields:p['fields'].size,fixtures:fixtures.size,adversarialEnvelope:extra.size,nameContractCases:4,proposedSchemaPassed:true,schemaNegativeCases:negative_results[:negativeCount],schemaScope:negative_results[:scope],factLineCompositionBlocks:2,contextPayloadSchemaPositiveCases:fixtures.count{|f|f['expected']},currentSchemaRejectsContextExtension:true,baselineVariants:647,baselineUnchanged:true,baselineSha256:p['baselineSha256'],baselinePath:canonical,currentCanonicalNotModified:true,sourceFiles:sources.size,sourceSpans:sources.sum{|s|s['spans'].size},runtimeExecuted:false,captureAdapterImplemented:false,historyFormatterExecuted:false,independentReview:'Original review applied; revised artifact requires independent re-review',newEngineImplementationNotRequiredForRequestedDraftDelivery:true}
File.write(root+'/VALIDATION.json',JSON.pretty_generate(v)+"\n");File.write(root+'/SHA256SUMS',Dir.children(root).reject{|f|f=='SHA256SUMS'}.sort.map{|f|"#{Digest::SHA256.file(root+'/'+f).hexdigest}  #{f}"}.join("\n")+"\n");puts JSON.pretty_generate(v)
