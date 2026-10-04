# Offline proposal only. No engine imports, save writes, or canonical selector changes.
module HistoricalAgeProposal
  INDIVIDUAL = %w[born married arrived steward came_of_age occupation reeve bailiff fell_ill injured expecting pilgrimage recovered healed returned died left_town].map { |x| 'person.' + x }.freeze
  HOUSEHOLD = %w[burnt rebuilt left resettled leaving move_in emptied level_up level_down stayed hungry fed water water_lost grew shrank].map { |x| 'person.' + x }.freeze
  # Deliberately one verified scenario. Unknown scenarios must not silently inherit 1300.
  START_YEARS = { 'core:campaign_market_town' => 1300 }.freeze
  TICKS_PER_YEAR = 4000
  def self.unknown(reason)
    { 'status' => 'unknown', 'reason' => reason }
  end
  def self.read(record, snapshot)
    return unknown('invalid_envelope') unless record.is_a?(Hash) && snapshot.is_a?(Hash)
    return unknown('household_event') if HOUSEHOLD.include?(record['template'])
    return unknown('template_not_allowed') unless INDIVIDUAL.include?(record['template'])
    subject = record['subject']
    return unknown('not_person_subject') unless subject.is_a?(Hash) && subject['type'] == 'person' && subject['id'].is_a?(String) && !subject['id'].empty?
    start = START_YEARS[snapshot['scenarioId']]
    return unknown('unknown_scenario') if start.nil?
    tick = record['tick']; now = snapshot['tick']
    return unknown('invalid_tick') unless tick.is_a?(Integer) && now.is_a?(Integer) && tick >= 0 && now >= 0 && tick <= now
    pools = []
    [['persons', 'people'], ['persons', 'past'], ['factions', 'people'], ['estates', 'people']].each do |outer, inner|
      container = snapshot[outer]
      return unknown('invalid_pool') unless container.nil? || container.is_a?(Hash)
      pool = container && container[inner]
      return unknown('invalid_pool') unless pool.nil? || (pool.is_a?(Array) && pool.all? { |person| person.is_a?(Hash) })
      pools.concat(pool || [])
    end
    matches = pools.select { |person| person['id'] == subject['id'] }
    return unknown(matches.empty? ? 'person_missing' : 'duplicate_person') unless matches.size == 1
    person = matches.first; birth = person['birthYear']; death = person['deathYear']
    return unknown('invalid_birth_year') unless birth.is_a?(Integer)
    return unknown('invalid_death_year') unless death.nil? || death.is_a?(Integer)
    year = start + tick / TICKS_PER_YEAR; age = year - birth
    return unknown('negative_age') if age < 0
    return unknown('after_death_year') if !death.nil? && year > death
    params = record['params']
    return unknown('invalid_params') unless params.nil? || params.is_a?(Hash)
    if record['template'] == 'person.died' && params && params.key?('age')
      return unknown('recorded_age_mismatch') unless params['age'].is_a?(Integer) && params['age'] == age
    end
    band = age < 14 ? 'child' : age < 30 ? 'youth' : age < 55 ? 'adult' : 'elder'
    { 'status' => 'known', 'eventYear' => year, 'subjectAgeAtRecord' => age, 'subjectAgeBandAtRecord' => band }
  end
end
