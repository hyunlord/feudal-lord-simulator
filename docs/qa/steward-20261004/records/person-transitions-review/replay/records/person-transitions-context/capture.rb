# Proposed normalized snapshot oracle only; not an engine adapter.
require 'json'
module TransitionDraft
 HEAD='5fb1aebfe735592c1424c947e88388d4ffe21742'
 MAX=9007199254740991
 DOMAIN={'person.move_in'=>['arrivalSize',%w[one several]],'person.married'=>['spouseHousehold',%w[manor town_house]],'person.left_town'=>['householdPeopleAfter',%w[present absent]]}
 def self.ident(v); v.is_a?(String) && !v.strip.empty?; end
 def self.uint(v); v.is_a?(Integer) && v>=0 && v<=MAX; end
 def self.ref(v); v.is_a?(Hash) && v.keys.sort==%w[id type] && ident(v['id']) && %w[person household].include?(v['type']); end
 def self.record(r)
  r.is_a?(Hash) && (r.keys-%w[id tick template subject actors]).empty? && %w[id tick template subject actors].all?{|k|r.key?(k)} && ident(r['id']) && uint(r['tick']) && DOMAIN.key?(r['template']) && ref(r['subject']) && r['actors'].is_a?(Array) && r['actors'].all?{|x|ref(x)} && r['actors'].uniq.size==r['actors'].size
 end
 def self.snapshot(s)
  return false unless s.is_a?(Hash) && s.keys.sort==%w[houses past people tick] && uint(s['tick'])
  return false unless %w[houses past people].all?{|k|s[k].is_a?(Array)}
  return false unless s['houses'].all?{|h|h.is_a?(Hash)&&(h.keys-%w[id residents burnt abandoned]).empty? && h.keys.sort==%w[abandoned burnt id residents] && ident(h['id'])&&uint(h['residents'])&&[true,false].include?(h['burnt'])&&[true,false].include?(h['abandoned'])}
  return false unless (s['people']+s['past']).all?{|p|p.is_a?(Hash)&&p.keys.sort==%w[alive householdId id role]&&ident(p['id'])&&ident(p['householdId'])&&%w[head spouse child kin steward].include?(p['role'])&&[true,false].include?(p['alive'])}
  return false unless s['people'].all?{|p|p['alive']}
  return false unless [s['houses'],s['people']+s['past']].all?{|rows|rows.map{|x|x['id']}.uniq.size==rows.size}
  true
 end
 def self.capture(r,b,a)
  return nil unless record(r)&&snapshot(b)&&snapshot(a)&&b['tick']<a['tick']&&r['tick']==a['tick']
  subject=r['subject']; household=nil; person=nil; value=nil
  if r['template']=='person.move_in'
   actors=r['actors'].select{|x|x['type']=='household'}
   if subject['type']=='household'
    return nil unless r['actors'].empty?
    household=subject['id']
    return nil if (b['people']+a['people']).any?{|p|p['householdId']==household&&p['role']=='head'}
   else
    return nil unless r['actors'].size==1&&actors.size==1
    household=actors[0]['id']; person=subject['id']
    heads={}; (b['people']+a['people']).each{|p|heads[p['householdId']]=p['id'] if p['role']=='head'}
    return nil unless heads[household]==person
   end
   old=b['houses'].find{|h|h['id']==household}; now=a['houses'].find{|h|h['id']==household}
   return nil unless old&&now&&old['residents']==0&&now['residents']>0&&!old['abandoned']&&!now['abandoned']
   return nil if now['burnt']&&!old['burnt']
   value=now['residents']==1 ? 'one' : 'several'
  else
   return nil unless subject['type']=='person'
   person=subject['id']; old=b['people'].find{|p|p['id']==person}; now=a['people'].find{|p|p['id']==person}
   if r['template']=='person.married'
    return nil unless old.nil?&&now&&now['role']=='spouse'
    household=now['householdId']
    # Stronger than the emitter: only a verified existing household, no invented spouse link.
    oldheads=b['people'].select{|p|p['householdId']==household&&p['role']=='head'}
    newheads=a['people'].select{|p|p['householdId']==household&&p['role']=='head'}
    return nil unless oldheads.size==1&&newheads.size==1&&oldheads[0]['id']==newheads[0]['id']
    return nil if b['people'].any?{|p|p['householdId']==household&&p['role']=='spouse'}
    return nil unless a['people'].count{|p|p['householdId']==household&&p['role']=='spouse'}==1
    return nil unless household=='manor'||a['houses'].any?{|h|h['id']==household&&h['residents']>0&&!h['burnt']&&!h['abandoned']}
    value=household=='manor' ? 'manor' : 'town_house'
   else
    return nil unless old&&now.nil?&&a['past'][0,b['past'].size]==b['past']
    added=a['past'].drop(b['past'].size).select{|p|p['id']==person}
    return nil unless added.size==1&&added[0]['alive']&&added[0]['householdId']==old['householdId']
    household=old['householdId']
    value=a['people'].any?{|p|p['householdId']==household} ? 'present' : 'absent'
   end
   expected=household=='manor' ? [] : [{'type'=>'household','id'=>household}]
   return nil unless r['actors']==expected
  end
  field=DOMAIN.fetch(r['template'])[0]
  {'status'=>'known','recordId'=>r['id'],'recordTick'=>r['tick'],'template'=>r['template'],'subject'=>r['subject'],'householdId'=>household,'sourceHead'=>HEAD,'captureKind'=>'emission_snapshot','fields'=>{field=>value}}
 end
 def self.select(package,r,c,schema)
  return nil unless record(r)
  begin; validate_schema(c,schema,schema); rescue RuntimeError; return nil; end
  return nil unless c['status']=='known'&&c['recordId']==r['id']&&c['recordTick']==r['tick']&&c['template']==r['template']&&c['subject']==r['subject']
  household=r['subject']['type']=='household' ? r['subject']['id'] : (r['actors'].find{|x|x['type']=='household'}||{})['id']
  return nil unless (household.nil?&&c['householdId']=='manor')||household==c['householdId']
  matches=package['additions'].select{|x|x['template']==r['template']&&x['variant']['when'].all?{|w|c['fields'][w['field'].delete_prefix('context.')]==w['value']}}
  matches.size==1 ? matches[0]['variant']['id'] : nil
 end
end
