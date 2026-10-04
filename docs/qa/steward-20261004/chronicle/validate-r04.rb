require 'json'
require 'csv'
require 'digest'

root = File.expand_path('..', __dir__)
current = JSON.parse(File.read(File.join(__dir__, 'variants.ko.json')))
baseline_path = File.join(root, 'records/chronicle-r04-before/variants.ko.json')
baseline = JSON.parse(File.read(baseline_path))
changes = JSON.parse(File.read(File.join(root, 'records/CHRONICLE_R04_CHANGES.json')))
raise 'baseline hash' unless Digest::SHA256.file(baseline_path).hexdigest == changes.fetch('baseSha256')
raise 'current hash' unless Digest::SHA256.file(File.join(__dir__, 'variants.ko.json')).hexdigest == changes.fetch('afterSha256')
approved_path = File.join(root, 'records/CHRONICLE_R04_APPROVED_ADDITIONS.json')
raise 'approved additions hash' unless Digest::SHA256.file(approved_path).hexdigest == changes.fetch('approvedAdditionsSha256')
approved = JSON.parse(File.read(approved_path))
raise 'approved count' unless approved.size == 78 && changes.fetch('addedIds').size == 78
restored = Marshal.load(Marshal.dump(current))
added = []
restored.fetch('historyTemplates').each do |template|
  template.fetch('variants').each do |variant|
    next unless changes.fetch('addedIds').include?(variant['id'])
    contract = approved.find { |row| row.fetch('template') == template.fetch('template') && row.fetch('variant').fetch('id') == variant.fetch('id') }
    raise 'unapproved variant' unless contract && variant == contract.fetch('variant')
    raise 'unsafe condition' unless variant['when'].size == contract.fetch('variant').fetch('when').size && !variant['when'].empty? && variant['when'].all? { |condition| condition['op'] == 'eq' && (condition['value'].is_a?(String) || condition['value'].is_a?(Integer)) } && variant['retainFactLine'] == true && variant['requiredSlots'] == []
    added << variant
  end
  template['variants'].reject! { |v| changes.fetch('addedIds').include?(v['id']) }
end
raise 'added ids' unless added.map { |v| v['id'] }.sort == changes.fetch('addedIds').sort
raise 'unexpected edits' unless restored == baseline
rows = CSV.read(File.join(__dir__, 'COVERAGE.csv'), headers: true)
expected_rows = current.fetch('historyTemplates').size + current.fetch('ledgerCategories').size
raise 'coverage row count' unless rows.size == expected_rows
raise 'duplicate rows' unless rows.map { |r| [r['domain'], r['id']] }.uniq.size == rows.size
rows.each do |row|
  items = current.fetch(row['domain'] == 'history' ? 'historyTemplates' : 'ledgerCategories')
  item = items.find { |x| (x['template'] || x['category']) == row['id'] }
  variants = item.fetch('variants')
  raise 'coverage count' unless row['authored_headlines'].to_i == variants.size && row['conditional_variants'].to_i == variants.count { |v| !v.fetch('when').empty? } && row['disabled_variants'].to_i == variants.count { |v| v['disabled'] }
end
expected = current.fetch('historyTemplates').flat_map { |t| t.fetch('variants') }.reject { |v| v.fetch('when').empty? }.map { |v| [v.fetch('id'), v.fetch('when'), v.fetch('headline')] }
actual = File.readlines(File.join(__dir__, 'conditional-lines.tsv')).drop(1).map do |line|
  id, condition, headline = line.chomp.split("\t", 3)
  [id, JSON.parse(condition), headline]
end
raise 'conditional table' unless actual == expected
puts JSON.pretty_generate({added: added.size, baseline_preserved: true, coverage_rows: rows.size, conditional_rows: actual.size, engine_execution: false})
