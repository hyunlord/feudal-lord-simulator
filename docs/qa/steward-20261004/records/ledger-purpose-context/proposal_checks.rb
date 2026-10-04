require_relative 'schema_validator'
d=__dir__;p=JSON.parse(File.read(d+'/PROPOSAL.json'));rows=p.fetch('variants');mapping={'promise_payment'=>%w[kept will_favour],'royal_subsidy'=>%w[tax confirmation],'stall_fee'=>%w[market alehouse]}
schemas=mapping.flat_map{|cat,purposes|purposes.map{|purpose|slot=cat=='stall_fee' ? 'amountExact' : 'amountAbsExact';props={'id'=>{'const'=>cat+'.r06purpose.'+purpose},'category'=>{'const'=>cat},'purpose'=>{'const'=>purpose},'text'=>{'type'=>'string','minLength'=>1},'requiredSlots'=>{'const'=>[slot]}};{'type'=>'object','required'=>props.keys,'additionalProperties'=>false,'properties'=>props}}}
schema={'$schema'=>'https://json-schema.org/draft/2020-12/schema','type'=>'array','minItems'=>6,'maxItems'=>6,'uniqueItems'=>true,'items'=>{'anyOf'=>schemas}}
def valid_proposal_rows(rows,schema)
 return false unless schema_ok(rows,schema,schema)
 return false unless rows.map{|r|r['id']}.uniq.size==6
 rows.all?{|r|r['text'].scan(/\{([^{}]+)\}/).flatten==r['requiredSlots'] && r['text'].count('{')==1 && r['text'].count('}')==1}
end
raise 'proposal' unless valid_proposal_rows(rows,schema)
neg=[]
rows.each_with_index do |row,i|
 ['purpose','category','id','requiredSlots','text'].each do |field|
  copy=Marshal.load(Marshal.dump(rows));copy[i][field]= field=='requiredSlots' ? ['personName'] : field=='text' ? '오염 {personName}' : 'wrong';raise 'negative' if valid_proposal_rows(copy,schema);neg<<{variant:row['id'],mutated:field,rejected:true}
 end
end
File.write(d+'/PROPOSAL_ROWS.schema.json',JSON.pretty_generate(schema)+"\n");File.write(d+'/PROPOSAL_CHECKS.json',JSON.pretty_generate({rows:6,negativeCases:neg.size,results:neg,scope:'six variant rows; envelope metadata not schema-certified'})+"\n");puts '6 rows / 30 negatives passed'
