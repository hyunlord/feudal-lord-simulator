require_relative 'schema_validator'
# Reference only: immutable saved entry and trusted campaign binding, never current suits.
def lawsuit_variant(raw,identity,schema)
 return nil unless schema_ok(raw,schema,schema)
 return nil unless identity.is_a?(Hash) && identity.keys.sort==%w[campaignId sourceHead entry].sort
 return nil unless %w[campaignId sourceHead entry].all?{|k|raw[k]==identity[k]}
 return nil if raw['campaignId'].match?(/\A[[:space:]]*\z/)
 e=raw['entry'];ledger_match=e['id'].match(/\Aledger-([0-9]{6,})\z/)
 return nil unless ledger_match
 ordinal=ledger_match[1].to_i
 return nil unless ordinal>=1 && ordinal<=9007199254740991 && e['id']=='ledger-'+ordinal.to_s.rjust(6,'0')
 ref=e['sourceRefs'].first
 claim_match=ref['id'].match(/\Aclaim-([1-9][0-9]*)\z/)
 return nil unless claim_match && claim_match[1].to_i<=9007199254740991
 m=ref['detail'].match(/\Asuit-([1-9][0-9]*):(filed|hearing|evidence:(charter|deed|court_roll|witnesses)|enforcing:([1-9][0-9]*))\z/)
 return nil unless m && m[1].to_i<=9007199254740991 && (m[4].nil? || m[4].to_i<=9007199254740991)
 phase=m[2].split(':').first
 'lawsuit.r06context.'+phase
end
