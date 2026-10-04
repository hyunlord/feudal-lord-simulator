require 'json'
ROOT = File.expand_path('../..', __dir__).freeze
EVENTS = JSON.parse(File.read(File.join(ROOT,'events-v4.json'))).freeze
REGISTRY = JSON.parse(File.read(File.join(ROOT,'registry-v4.json'))).freeze
EXPECTED = (1..200).map { |n| format('ck_evt_%03d',n) }.freeze
errors = []
checks = 0
check = lambda do |condition, message|
  checks += 1
  errors << message unless condition
end
walk = lambda do |value, &block|
  block.call(value)
  case value
  when Hash then value.each_value { |child| walk.call(child,&block) }
  when Array then value.each { |child| walk.call(child,&block) }
  end
end
entries = REGISTRY.fetch('entries').to_h { |r| [r.fetch('id'),r] }
check.call(EVENTS.map{|e|e['id']} == EXPECTED,'event IDs/order are not 001..200')
check.call(REGISTRY['entries'].map{|e|e['id']} == EXPECTED,'registry IDs/order are not 001..200')
EVENTS.each do |e|
  id = e.fetch('id'); r = entries.fetch(id); y = e.fetch('years'); c=r.fetch('calendar')
  check.call(e['number']==id[-3..].to_i,"#{id}: number mismatch")
  check.call(y.size==2 && y[0]>=1300 && y[1]<=1450 && y[0]<=y[1],"#{id}: invalid years")
  period=e.fetch('period').split('–').map(&:to_i)
  check.call(period.size==2 && period[0]>=1300 && period[1]<=1450 && period[0]<=y[0] && period[1]>=y[1],"#{id}: invalid period")
  %w[authoredYears eligibilityYears].each {|key| check.call(c[key]==y,"#{id}: calendar #{key} mismatch")}
  check.call([c['yearMinInclusive'],c['yearMaxInclusive']]==y,"#{id}: calendar min/max mismatch")
  if r.key?('conditionBinding')
    check.call(r.dig('conditionBinding','sourceConditions')==e['conditions'],"#{id}: sourceConditions mismatch")
  end
  choices=e['choices'].map{|x|x['id']}
  check.call(choices.uniq==choices,"#{id}: duplicate choices")
  check.call(r['choices'].map{|x|x['id']}==choices,"#{id}: registry choice mismatch")
  check.call(r['enabledInEngine']==false,"#{id}: runtime enabled unexpectedly")
  check.call(r['minimumEnabledConsequentialChoices']==2,"#{id}: consequential minimum changed")
  check.call(r['contentRef']=="events-v4.json##{id}","#{id}: contentRef mismatch")
  year_nodes=[]
  walk.call(r['conditions']) do |node|
    next unless node.is_a?(Hash) && node.key?('compare')
    cmp=node['compare']
    next unless cmp.dig('left','field')=='selectors.stateCalendar.year'
    year_nodes << [cmp['op'],cmp.dig('right','literal')]
  end
  check.call(year_nodes.include?(['gte',y[0]]) && year_nodes.include?(['lte',y[1]]),"#{id}: year AST mismatch")
  r['choices'].each do |choice|
    src=e['choices'].find{|v|v['id']==choice['id']}
    desired=src.fetch('effects').map{|fx|fx['preconditions']}
    if choice.fetch('conditions').key?('sourcePreconditions')
      check.call(choice.dig('conditions','sourcePreconditions')==desired,"#{id}/#{choice['id']}: sourcePreconditions mismatch")
    end
  end
end
check.call(REGISTRY.dig('policy','minimumEnabledConsequentialChoices')==2,'global minimum altered')
check.call(REGISTRY['status']=='proposal_only_not_runtime_registry','runtime status altered')
result={'status'=>errors.empty? ? 'PASS' : 'FAIL','assertions'=>checks,'errors'=>errors}
File.write(File.join(ROOT,'records/STRUCTURAL_VALIDATION.json'),JSON.pretty_generate(result)+"\n")
puts JSON.pretty_generate(result)
exit(errors.empty? ? 0 : 1)
