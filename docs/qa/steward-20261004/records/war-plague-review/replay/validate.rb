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
selector=lambda do |template,record_id,record_tick,c|
 begin;validate_schema(c,cs,cs);rescue RuntimeError;next nil;end
 next nil unless c['status']=='known' && c['template']==template && c['recordId']==record_id && c['recordTick']==record_tick
 row=p['templates'].find{|r|r['template']==template};next nil unless row
 found=row['variants'].select{|v|c['fields'][row['field']]==v['when']['value']};raise 'overlap' unless found.size<=1;found.first && found.first['id']
end
results=[];negative=[]
fs.each do |f|
 c=f['context'];actual=selector.call(f['template'],f['recordId'],f['recordTick'],c);raise 'positive' unless actual==f['expected'];results<<{id:f['id'],selected:actual}
 %w[empty missing_field domain cross_template unverified wrong_capture negative_tick extra_field].each do |kind|
  x=Marshal.load(Marshal.dump(c));case kind
  when 'empty';x['fields']={}
  when 'missing_field';x.delete('fields')
  when 'domain';x['fields']=x['fields'].transform_values{'invented'}
  when 'cross_template';x['template']=f['template']=='war.messenger' ? 'plague.second' : 'war.messenger'
  when 'unverified';x['referenceVerified']=false
  when 'wrong_capture';x['captureKind']='current_person_lookup'
  when 'negative_tick';x['recordTick']=-1
  when 'extra_field';x['fields']['invented']='invented'
  end
  rejected=false;begin;validate_schema(x,cs,cs);rescue RuntimeError;rejected=true;end;raise 'negative schema' unless rejected
  raise 'fallback' unless selector.call(f['template'],f['recordId'],f['recordTick'],x).nil?;negative<<{id:f['id']+'.'+kind,schemaRejected:true,fallback:true}
 end
 %w[record_id record_tick].each{|k|x=Marshal.load(Marshal.dump(c));k=='record_id' ? x['recordId']='other' : x['recordTick']=1001;validate_schema(x,cs,cs);raise 'binding' unless selector.call(f['template'],f['recordId'],f['recordTick'],x).nil?;negative<<{id:f['id']+'.'+k,schemaAccepted:true,bindingRejected:true}}
 unknown=Marshal.load(Marshal.dump(c));unknown['status']='unknown';unknown['fields']={};unknown['referenceVerified']=false;validate_schema(unknown,cs,cs);raise 'unknown' unless selector.call(f['template'],f['recordId'],f['recordTick'],unknown).nil?
end
proposal_negative=[]
%w[empty_templates missing_fallback empty_variants wrong_domain missing_fact wrong_template].each do |kind|
 x=Marshal.load(Marshal.dump(p));case kind
 when 'empty_templates';x['templates']=[]
 when 'missing_fallback';x.delete('fallback')
 when 'empty_variants';x['templates'][0]['variants']=[]
 when 'wrong_domain';x['templates'][0]['values']=['invented']
 when 'missing_fact';x['templates'][0]['variants'][0].delete('retainFactLine')
 when 'wrong_template';x['templates'][0]['template']='plague.second'
 end
 rejected=false;begin;validate_schema(x,s,s);rescue RuntimeError;rejected=true;end;raise 'proposal negative' unless rejected;proposal_negative<<{id:kind,rejected:true}
end
sources=read.call('SOURCE_EVIDENCE.json');sources.each{|e|text=File.read('/Users/rexxa/fls-astra-steward/'+e['path']);raise 'source hash' unless Digest::SHA256.hexdigest(text)==e['sha256'];e['spans'].each{|r|raise 'span' unless text.lines[(r['start']-1)..(r['end']-1)].join==r['text']}}
report={status:'AUTHOR_DRAFT_VALIDATED_UNINSTALLED',requestedTemplates:7,authoredTemplates:6,variants:14,notAuthored:['plague.priest_died'],positiveFixtures:results.size,negativeContextSchema:negative.count{|r|r[:schemaRejected]},bindingMismatchFixtures:negative.count{|r|r[:bindingRejected]},negativeProposalSchema:proposal_negative.size,unknownFallbackCases:fs.size,sourceFiles:sources.size,sourceSpans:sources.sum{|e|e['spans'].size},actualCaptureImplemented:false,runtimeExecuted:false,naturalOccurrenceVerified:false,independentReview:false,schemaScope:'Strict schema for this frozen authored package and context; Ruby supports explicit used keyword subset, not a complete JSON Schema compliance implementation'}
File.write(d+'/FIXTURE_RESULTS.json',JSON.pretty_generate({positive:results,negative:negative,proposalNegative:proposal_negative})+"\n");File.write(d+'/VALIDATION.json',JSON.pretty_generate(report)+"\n");File.write(d+'/SHA256SUMS',Dir.children(d).reject{|f|f=='SHA256SUMS'}.sort.map{|f|Digest::SHA256.file(d+'/'+f).hexdigest+'  '+f}.join("\n")+"\n");puts JSON.pretty_generate(report)
