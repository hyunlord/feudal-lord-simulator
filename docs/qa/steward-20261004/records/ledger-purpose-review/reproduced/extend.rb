require 'json';require 'digest'
d=__dir__;p=d+'/RAW.schema.json';s=JSON.parse(File.read(p));e=s['properties']['entry']['properties'];e['category']['enum']<<'stall_fee';e['amount']['maximum']=9007199254740991;e['sourceRefs']['minItems']=1;e['sourceRefs']['items']['properties']['type']['enum']+=%w[building right];File.write(p,JSON.pretty_generate(s)+"\n")
p=d+'/PROPOSAL.json';s=JSON.parse(File.read(p));[['market','시장 좌판세로 금고에 {amountExact} 들어왔다.'],['alehouse','에일집 판매에 따른 부담금으로 금고에 {amountExact} 들어왔다.']].each{|k,t|s['variants']<<{'id'=>'stall_fee.r06purpose.'+k,'category'=>'stall_fee','purpose'=>k,'text'=>t,'requiredSlots'=>['amountExact']}};s['unknownCashInFallback']='수입 목적 미확인 — 금고에 {amountExact} 들어왔다.';File.write(p,JSON.pretty_generate(s)+"\n")
p=d+'/SOURCE_EVIDENCE.json';s=JSON.parse(File.read(p));{'src/engine/ale.ts'=>[[169,182]],'src/engine/moneyRules.ts'=>[[113,115],[138,150]],'src/engine/politics.ts'=>[[234,238]],'docs/design/glossary.md'=>[[70,70],[111,111],[137,137]],'src/engine/marriage.ts'=>[[423,438]]}.each{|path,ss|body=File.read('/Users/rexxa/fls-astra-steward/'+path);r=s.find{|x|x['path']==path};unless r;r={'path'=>path,'sha256'=>Digest::SHA256.hexdigest(body),'spans'=>[]};s<<r;end;ss.each{|a,b|r['spans']<<{'start'=>a,'end'=>b,'text'=>body.lines[(a-1)...b].join}}};File.write(p,JSON.pretty_generate(s)+"\n")
p=d+'/selector.rb';s=File.read(p);s=s.sub(" claims=e['sourceRefs']",<<'CODE'.chomp+"\n claims=e['sourceRefs']")
 if e['category']=='stall_fee'
  return nil unless e['amount']>0
  buildings=e['sourceRefs'].select{|r|r['type']=='building'};rights=e['sourceRefs'].select{|r|r['type']=='right'}
  return nil unless buildings.size==1 && buildings.size+rights.size==e['sourceRefs'].size && rights.size<=1
  b=buildings.first;return nil if b['id'].match?(/\A[[:space:]]*\z/)
  m=b.fetch('detail','').match(/\A(alehouse|stalls):([1-9][0-9]*)\z/)
  return nil unless m && m[2].to_i<=9007199254740991
  return nil if m[1]=='alehouse'&&!rights.empty?
  unless rights.empty?
   right=rights.first;rate=right.fetch('detail','').match(/\Astall_fee:(0|[1-9][0-9]*)\z/)
   return nil if right['id'].match?(/\A[[:space:]]*\z/) || !rate || rate[1].to_i>=1000
  end
  return 'stall_fee.r06purpose.'+(m[1]=='alehouse' ? 'alehouse' : 'market')
 end
 return nil unless e['amount']<0
CODE
File.write(p,s)
