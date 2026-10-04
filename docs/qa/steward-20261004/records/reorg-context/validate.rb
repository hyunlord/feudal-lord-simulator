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
d=__dir__;read=lambda{|f|JSON.parse(File.read(d+'/'+f))};p=read.call('PROPOSAL.json');s=read.call('PROPOSAL.schema.json');cs=read.call('CONTEXT.schema.json');fs=read.call('FIXTURES.json');validate_schema(p,s,s)
raise 'baseline changed' unless Digest::SHA256.file(d+'/baseline647.ko.json').hexdigest==p['baselineSha256']
blocked=read.call('ADOPTION_LIMITS.json')['blocks'].map{|r|r['variantId']};raise 'blocks' unless blocked.sort==%w[reorg.weavers_left.r06rg.expired reorg.weavers_left.r06rg.refused]
selector=lambda do |template,record_id,record_tick,c|
 begin;validate_schema(c,cs,cs);rescue RuntimeError;next nil;end
 next nil unless c['status']=='known' && c['template']==template && c['recordId']==record_id && c['recordTick']==record_tick
 found=p['additions'].select{|row|row['template']==template && row['variant']['when'].all?{|w|w['op']=='eq' && c['fields'][w['field'].delete_prefix('context.')]==w['value']}}
 raise 'overlap' if found.size>1
 found.first && found.first['variant']['id']
end
results=[];negative=[]
fs.each do |f|
 c=f['context'];actual=selector.call(f['template'],f['recordId'],f['recordTick'],c);raise 'positive' unless actual==f['expected'];results<<{id:f['id'],selected:actual,factLineCompositionAllowed:!blocked.include?(actual),runtimeInstalled:false}
 %w[empty missing_field domain cross_template unverified wrong_capture negative_tick extra_field wrong_source].each do |kind|
  x=Marshal.load(Marshal.dump(c));case kind
  when 'empty';x['fields']={}
  when 'missing_field';x.delete('fields')
  when 'domain';x['fields']=x['fields'].transform_values{'invented'}
  when 'cross_template';x['template']=f['template']=='reorg.wage_competition' ? 'reorg.autonomy_request' : 'reorg.wage_competition'
  when 'unverified';x['referenceVerified']=false
  when 'wrong_capture';x['captureKind']='current_person_lookup'
  when 'negative_tick';x['recordTick']=-1
  when 'extra_field';x['fields']['invented']='invented'
  when 'wrong_source';x['sourceHead']='other'
  end
  rejected=false;begin;validate_schema(x,cs,cs);rescue RuntimeError;rejected=true;end;raise 'negative schema' unless rejected
  raise 'fallback' unless selector.call(f['template'],f['recordId'],f['recordTick'],x).nil?;negative<<{id:f['id']+'.'+kind,schemaRejected:true,fallback:true}
 end
 %w[record_id record_tick].each{|k|x=Marshal.load(Marshal.dump(c));k=='record_id' ? x['recordId']='other' : x['recordTick']=1001;validate_schema(x,cs,cs);raise 'binding' unless selector.call(f['template'],f['recordId'],f['recordTick'],x).nil?;negative<<{id:f['id']+'.'+k,schemaAccepted:true,bindingRejected:true}}
 unknown=Marshal.load(Marshal.dump(c));unknown['status']='unknown';unknown['fields']={};unknown['referenceVerified']=false;validate_schema(unknown,cs,cs);raise 'unknown' unless selector.call(f['template'],f['recordId'],f['recordTick'],unknown).nil?
end
proposal_negative=[]
%w[empty_fields empty_fallback empty_additions wrong_domain missing_fact wrong_template empty_when].each do |kind|
 x=Marshal.load(Marshal.dump(p));case kind
 when 'empty_fields';x['fields']=[]
 when 'empty_fallback';x['fallback']={}
 when 'empty_additions';x['additions']=[]
 when 'wrong_domain';x['fields'][0]['values']=['invented']
 when 'missing_fact';x['additions'][0]['variant'].delete('retainFactLine')
 when 'wrong_template';x['additions'][0]['template']='reorg.autonomy_request'
 when 'empty_when';x['additions'][0]['variant']['when']=[]
 end
 rejected=false;begin;validate_schema(x,s,s);rescue RuntimeError;rejected=true;end;raise 'proposal negative' unless rejected;proposal_negative<<{id:kind,rejected:true}
end
sources=read.call('SOURCE_EVIDENCE.json');sources.each{|e|text=File.read('/Users/rexxa/fls-astra-steward/'+e['path']);raise 'source hash' unless Digest::SHA256.hexdigest(text)==e['sha256'];e['spans'].each{|r|raise 'span' unless text.lines[(r['start']-1)..(r['end']-1)].join==r['text']}}
report={status:'AUTHOR_DRAFT_VALIDATED_UNINSTALLED',requestedTemplates:5,authoredTemplates:5,variants:11,positiveFixtures:results.size,negativeContextSchema:negative.count{|r|r[:schemaRejected]},bindingMismatchFixtures:negative.count{|r|r[:bindingRejected]},negativeProposalSchema:proposal_negative.size,unknownFallbackCases:fs.size,factLineBlocked:blocked,sourceFiles:sources.size,sourceSpans:sources.sum{|e|e['spans'].size},baselineSha256:p['baselineSha256'],actualCaptureImplemented:false,runtimeExecuted:false,naturalOccurrenceVerified:false,independentReview:false,schemaScope:'Strict frozen authored package; explicit Ruby keyword subset, not complete JSON Schema compliance implementation'}
File.write(d+'/FIXTURE_RESULTS.json',JSON.pretty_generate({positive:results,negative:negative,proposalNegative:proposal_negative})+"\n");File.write(d+'/VALIDATION.json',JSON.pretty_generate(report)+"\n");puts JSON.pretty_generate(report)
