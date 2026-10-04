# Proposed event-time capture reference only; production engine integration is not performed.
def parent_context(subject,people,past)
 return nil unless subject.is_a?(Hash) && people.is_a?(Array) && past.is_a?(Array)
 return nil unless subject['id'].is_a?(String) && !subject['id'].empty? && subject['householdId'].is_a?(String) && !subject['householdId'].empty?
 return nil unless people.count{|p|p.is_a?(Hash)&&p['id']==subject['id']}==1 && people.find{|p|p.is_a?(Hash)&&p['id']==subject['id']}==subject
 return nil unless subject['alive']==true && !subject.key?('leftYear')
 ids=%w[motherId fatherId].map{|key|subject[key]};return nil unless ids.all?{|id|id.is_a?(String)&&!id.empty?} && ids.uniq.size==2 && !ids.include?(subject['id'])
 parents=ids.map do |id|
  matches=(people+past).select{|p|p.is_a?(Hash)&&p['id']==id}
  return nil unless matches.size==1
  p=matches.first;return nil unless [true,false].include?(p['alive'])&&p['householdId'].is_a?(String)&&!p['householdId'].empty?
  p
 end
 parents.any?{|p|people.include?(p)&&p['alive']==true&&!p.key?('leftYear')&&p['householdId']==subject['householdId']} ? 'co_resident' : 'not_co_resident'
end
