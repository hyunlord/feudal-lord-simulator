require 'json'
root=File.dirname(__FILE__);round=File.dirname(File.dirname(root))
base=JSON.parse(File.read(round+'/chronicle/variants.schema.json'))
condition={'type'=>'object','required'=>%w[field op value],'additionalProperties'=>false,'properties'=>{'field'=>{'enum'=>%w[context.subjectAgeBandAtRecord context.subjectAgeAtRecord]},'op'=>{'enum'=>%w[eq gte lte]},'value'=>{'type'=>%w[string integer]}}}
schema={'$schema'=>'https://json-schema.org/draft/2020-12/schema','$id'=>'urn:charter-kin:age-context-copy-proposal:v1','type'=>'object','required'=>%w[formatVersion status baselineSha256 canonicalModified adapter conditionSources slots fallback additions],'additionalProperties'=>false,'properties'=>{'formatVersion'=>{'const'=>'age-context-proposal-v1'},'status'=>{'const'=>'NOT_INSTALLED_REQUIRES_CONTEXT_ADAPTER'},'baselineSha256'=>{'type'=>'string','pattern'=>'^[0-9a-f]{64}$'},'canonicalModified'=>{'const'=>false},'adapter'=>{'type'=>'string'},'conditionSources'=>{'type'=>'object'},'slots'=>{'type'=>'object'},'fallback'=>{'type'=>'object'},'additions'=>{'type'=>'array','items'=>{'type'=>'object','required'=>%w[template variants],'additionalProperties'=>false,'properties'=>{'template'=>{'enum'=>%w[person.fell_ill person.recovered person.injured person.healed person.pilgrimage person.returned]},'variants'=>{'type'=>'array','items'=>{'$ref'=>'#/$defs/variant'}}}}}},'$defs'=>{'condition'=>condition,'variant'=>base['$defs']['variant']}}
File.write(root+'/PROPOSAL.schema.json',JSON.pretty_generate(schema)+"\n")
method_source=File.read(round+'/records/variant-candidates/validate.rb').split('def validate_schema',2).last.split("\nbase=read_json",2).first
eval('def validate_schema'+method_source,binding)
package=JSON.parse(File.read(root+'/ADDITIONS.json'));validate_schema(package,schema,schema)
condition_checks=0
package['additions'].each do |g|
 g['variants'].each do |v|
  v['when'].each do |c|
   valid=c['field']=='context.subjectAgeBandAtRecord' ? c['op']=='eq' && %w[child youth adult elder].include?(c['value']) : %w[gte lte].include?(c['op']) && c['value'].is_a?(Integer)
   raise 'semantic condition type' unless valid
   condition_checks+=1
  end
 end
end
rejected=false
begin
 validate_schema(package['additions'].first['variants'].first['when'].first,base['$defs']['condition'],base)
rescue StandardError
 rejected=true
end
raise 'canonical schema unexpectedly accepts extension' unless rejected
v=JSON.parse(File.read(root+'/VALIDATION.json'));v['fullSchemaValidation']=true;v['conditionTypeChecks']=condition_checks;v['oldSchemaRejectsExtension']=true
File.write(root+'/VALIDATION.json',JSON.pretty_generate(v)+"\n");puts JSON.pretty_generate(v)
