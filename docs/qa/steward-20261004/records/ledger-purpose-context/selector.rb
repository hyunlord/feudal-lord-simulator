require_relative 'schema_validator'
def numbered(id,prefix)
 m=id.match(/\A#{prefix}-([1-9][0-9]*)\z/);m && m[1].to_i<=9007199254740991
end
def purpose_variant(raw,identity,schema)
 return nil unless schema_ok(raw,schema,schema)
 return nil if raw['campaignId'].match?(/\A[[:space:]]*\z/)
 return nil unless identity.is_a?(Hash)&&identity.keys.sort==%w[campaignId entry sourceHead].sort&&%w[campaignId entry sourceHead].all?{|k|identity[k]==raw[k]}
 e=raw['entry'];m=e['id'].match(/\Aledger-([0-9]{6,})\z/);return nil unless m
 n=m[1].to_i;return nil unless n>=1&&n<=9007199254740991&&e['id']=='ledger-'+n.to_s.rjust(6,'0')
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
 claims=e['sourceRefs'].select{|r|r['type']=='claim'};actors=e['sourceRefs'].select{|r|r['type']=='actor'}
 return nil unless claims.size==1&&actors.size==1
 c=claims.first;a=actors.first;return nil unless c.key?('detail')&&!a.key?('detail')
 if e['category']=='royal_subsidy'
  return nil unless c['id']=='royal_subsidy'&&a['id']=='crown'
  key={'tenth_and_fifteenth'=>'tax','confirmation'=>'confirmation'}[c['detail']]
 else
  return nil unless a['id']=='estate:estate-neighbour-3'
  key=if c['detail']=='will_favour'&&numbered(c['id'],'claim');'will_favour'
      elsif %w[pension debt_assumption debt_after_inheritance].include?(c['detail'])&&numbered(c['id'],'promise');'kept'
      end
 end
 key ? e['category']+'.r06purpose.'+key : nil
end
