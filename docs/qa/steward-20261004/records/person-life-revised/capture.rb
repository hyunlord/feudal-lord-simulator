# Offline proposed emitter extraction. Revised guard only; not installed runtime code.
def capture(record,b,a,tick)
 return nil unless b.is_a?(Hash)&&a.is_a?(Hash)&&tick.is_a?(Integer)&&tick>=0&&record['tick'].is_a?(Integer)&&record['tick']==tick&&record['id'].is_a?(String)&&!record['id'].strip.empty?
 id=b['buildingId'];return nil unless id.is_a?(String)&&!id.empty?&&a['buildingId']==id
 subject=record['subject'];return nil unless subject.is_a?(Hash)
 case subject['type']
 when 'household'
  return nil unless subject['id']==id
 when 'person'
  return nil unless subject['id'].is_a?(String)&&!subject['id'].strip.empty?
  actors=record['actors'];return nil unless actors.is_a?(Array)&&actors.all?{|x|x.is_a?(Hash)}
  households=actors.select{|x|x['type']=='household'}
  return nil unless households.size==1&&households[0]['id']==id
 else
  return nil
 end
 return nil unless [b['residents'],a['residents']].all?{|n|n.is_a?(Integer)&&n>=0}&&[b['hasWater'],a['hasWater']].all?{|x|x==true||x==false}
 %w[burntTick abandonedTick leavingSinceTick foodShortSinceTick].each{|k|[b,a].each{|h|return nil if h.key?(k)&&(!h[k].is_a?(Integer)||h[k]<0||h[k]>tick)}}
 newly_burnt=a.key?('burntTick')&&!b.key?('burntTick');newly_abandoned=a.key?('abandonedTick')&&!b.key?('abandonedTick')
 t=record['template'];return nil if newly_burnt&&t!='person.burnt';return nil if newly_abandoned&&!%w[person.left person.rebuilt].include?(t)
 present=lambda{|h,k|h.key?(k)}
 ok=case t
 when 'person.burnt' then newly_burnt&&b['residents']>0
 when 'person.rebuilt' then b.key?('burntTick')&&!a.key?('burntTick')&&a['residents']>0
 when 'person.left' then newly_abandoned&&b['residents']>0&&a['residents']==0
 when 'person.resettled' then b.key?('abandonedTick')&&!a.key?('abandonedTick')&&a['residents']>0
 when 'person.leaving' then !b.key?('leavingSinceTick')&&a.key?('leavingSinceTick')&&a['residents']>0
 when 'person.stayed' then b.key?('leavingSinceTick')&&!a.key?('leavingSinceTick')&&!a.key?('abandonedTick')&&a['residents']>0
 when 'person.hungry' then !b.key?('foodShortSinceTick')&&a.key?('foodShortSinceTick')&&a['residents']>0
 when 'person.fed' then b.key?('foodShortSinceTick')&&!a.key?('foodShortSinceTick')&&!a.key?('abandonedTick')&&a['residents']>0
 when 'person.water' then b['hasWater']==false&&a['hasWater']==true&&a['residents']>0
 when 'person.water_lost' then b['hasWater']==true&&a['hasWater']==false&&a['residents']>0
 else false
 end
 return nil unless ok
 c={'residentsBefore'=>b['residents'],'residentsAfter'=>a['residents'],'waterAfter'=>a['hasWater'],'burntAfter'=>a.key?('burntTick'),'recordId'=>record['id'],'capturedAtTick'=>tick,'householdId'=>id}
 field={'person.rebuilt'=>'burntTick','person.resettled'=>'abandonedTick','person.fed'=>'foodShortSinceTick'}[t]
 if field
  c['elapsedTicks']=tick-b[field];return nil unless c['elapsedTicks']>0
 end
 c
end
def pick(vs,t,c)
 return nil if c.nil?
 v=vs.select{|x|next false unless x['template']==t;actual=c[x['field']];expected=x['value'];case x['op'];when 'eq';actual==expected;when 'gte';actual>=expected;when 'gt';actual>expected;when 'lt';actual<expected;when 'lte';actual<=expected;else raise 'op';end}
 raise 'overlap' if v.size>1;v.first
end
