require 'json'
ROOT=File.expand_path('../..',__dir__).freeze
ENTRIES=JSON.parse(File.read(File.join(ROOT,'registry-v4.json'))).fetch('entries').to_h{|e|[e['id'],e]}.freeze
results=[]
walk=lambda do |node,&block|
  block.call(node)
  case node
  when Hash then node.each_value{|child|walk.call(child,&block)}
  when Array then node.each{|child|walk.call(child,&block)}
  end
end
# Evaluate only the edited scalar conjuncts, not a substitute for the game evaluator.
compare=lambda do |op,left,right|
  case op
  when 'gt' then left>right
  when 'gte' then left>=right
  when 'lt' then left<right
  when 'lte' then left<=right
  when 'eq' then left==right
  when 'in' then right.include?(left)
  else raise "Unsupported comparison #{op}"
  end
end
{
 'ck_evt_005'=>{750=>false,751=>true,800=>true,1100=>true,1249=>true,1250=>false},
 'ck_evt_024'=>{750=>false,751=>true,800=>true,1100=>true,2000=>true,2001=>false},
 'ck_evt_042'=>{650=>false,651=>true,800=>true,1100=>true,1249=>true,1250=>false}
}.each do |id,cases|
  nodes=[]
  walk.call(ENTRIES.fetch(id).fetch('conditions')) do |node|
    next unless node.is_a?(Hash) && node.dig('compare','left','field')=='state.agency.duesPermille'
    nodes << node['compare']
  end
  raise "Missing dues predicate #{id}" if nodes.empty?
  cases.each do |input,expected|
    actual=nodes.all?{|cmp|compare.call(cmp['op'],input,cmp.dig('right','literal'))}
    results << {id:id,kind:'dues_only',input:input,expected:expected,actual:actual,pass:actual==expected}
  end
end
%w[ck_evt_009 ck_evt_032 ck_evt_033 ck_evt_038 ck_evt_053 ck_evt_075 ck_evt_143 ck_evt_146 ck_evt_150 ck_evt_153 ck_evt_154].each do |id|
  e=ENTRIES.fetch(id)
  [1300,1348,1382,1450].each do |year|
    actual=e['calendar']['eligibilityYears'][0]<=year && e['calendar']['eligibilityYears'][1]>=year
    results << {id:id,kind:'lawsuit_year_only',input:year,expected:true,actual:actual,pass:actual}
  end
  actual=e.dig('recurrence','cooldownSeasonsMinimum')==0 && e.dig('recurrence','cooldownSeasonsMaximum')==0
  results << {id:id,kind:'new_suit_no_year_cooldown',expected:true,actual:actual,pass:actual}
end
%w[ck_evt_009 ck_evt_032 ck_evt_033 ck_evt_053].each do |id|
  e=ENTRIES.fetch(id)
  empty=e['choices'].select{|c|c['commands'].empty?}
  actual=empty.any? && empty.all?{|c|c['noOpIsConsequential']==false} && e['minimumEnabledConsequentialChoices']==2
  results << {id:id,kind:'defer_does_not_fake_effect',expected:true,actual:actual,pass:actual}
end
result={status:results.all?{|r|r[:pass]} ? 'PASS':'FAIL',scope:'Static edited condition fragments only; no full evaluator/runtime/frequency test',cases:results.size,results:results}
File.write(File.join(ROOT,'records/BOUNDARIES.json'),JSON.pretty_generate(result)+"\n")
puts JSON.generate({status:result[:status],cases:results.size,failed:results.reject{|r|r[:pass]}})
exit(result[:status]=='PASS' ? 0:1)
