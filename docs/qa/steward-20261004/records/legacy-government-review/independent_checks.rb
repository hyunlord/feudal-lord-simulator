require 'json';require 'digest'
a='/tmp/astra-steward-r06-20261004/records/legacy-government-context';r=__dir__;require a+'/schema_validator'
read=lambda{|f|JSON.parse(File.read(a+'/'+f))};cs=read.call('CONTEXT.schema.json');rs=read.call('RECORD.schema.json');fixtures=read.call('FIXTURES.json');out=[]
fixtures.each do |f|
 [nil,true,[],{},0,'known'].each_with_index do |bad,i|
  [[cs,bad,'context-root'],[rs,bad,'record-root']].each do |schema,value,kind|
   rejected=false;begin;validate_schema(value,schema,schema);rescue RuntimeError;rejected=true;end
   raise "accepted #{kind}" unless rejected;out<<{id:f['id']+'.'+kind+i.to_s,rejected:true}
  end
 end
 %w[recordId recordTick fields referenceVerified].each do |key|
  x=Marshal.load(Marshal.dump(f['context']));x[key]=nil;rejected=false;begin;validate_schema(x,cs,cs);rescue RuntimeError;rejected=true;end;raise 'null accepted' unless rejected;out<<{id:f['id']+'.null-'+key,rejected:true}
 end
 x=Marshal.load(Marshal.dump(f['context']));x['status']='unknown';x['fields']={};x['referenceVerified']=true;rejected=false;begin;validate_schema(x,cs,cs);rescue RuntimeError;rejected=true;end;raise 'unknown forged verification accepted' unless rejected;out<<{id:f['id']+'.unknown-verified',rejected:true}
end
p=read.call('PROPOSAL.json');sources=read.call('SOURCE_EVIDENCE.json');hashes=Dir.children(a).sort.to_h{|f|[f,Digest::SHA256.file(a+'/'+f).hexdigest]};File.write(r+'/INPUT_SHA256.json',JSON.pretty_generate(hashes)+"\n");File.write(r+'/INDEPENDENT_RESULTS.json',JSON.pretty_generate({additionalNegativeSchemaChecks:out.size,checks:out})+"\n");puts out.size
