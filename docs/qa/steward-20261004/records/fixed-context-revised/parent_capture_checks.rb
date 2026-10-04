require 'json'
require_relative 'parent_capture'
def parent_capture_checks
 child={'id'=>'child','alive'=>true,'householdId'=>'home','motherId'=>'mother','fatherId'=>'father'}
 mother={'id'=>'mother','alive'=>true,'householdId'=>'home'};father={'id'=>'father','alive'=>true,'householdId'=>'other'}
 rows=[
 ['current_parent_same_home',[child,mother,father],[],'co_resident'],
 ['migrated_past_alive_same_home',[child,father],[mother.merge('leftYear'=>1320)],'not_co_resident'],
 ['past_alive_same_home_without_leftYear',[child,father],[mother],'not_co_resident'],
 ['people_parent_leftYear_same_home',[child,mother.merge('leftYear'=>1320),father],[],'not_co_resident'],
 ['both_parents_elsewhere',[child,mother.merge('householdId'=>'elsewhere'),father],[],'not_co_resident'],
 ['one_stays_one_migrated',[child,mother],[father.merge('leftYear'=>1320)],'co_resident'],
 ['dead_parent_same_home',[child,father],[mother.merge('alive'=>false)],'not_co_resident'],
 ['missing_parent',[child,father],[],nil],
 ['duplicate_parent_across_lists',[child,mother,father],[mother],nil],
 ['missing_parent_alive_flag',[child,mother.reject{|k,_|k=='alive'},father],[],nil],
 ['missing_parent_household',[child,mother.reject{|k,_|k=='householdId'},father],[],nil]]
 results=rows.map{|id,people,past,want|actual=parent_context(child,people,past);raise 'parent capture '+id unless actual==want;{id:id,expected:want,actual:actual}}
 [['missing_parent_id',child.reject{|k,_|k=='fatherId'}],['same_parent_id',child.merge('fatherId'=>'mother')],['left_child',child.merge('leftYear'=>1320)]].each{|id,c|actual=parent_context(c,[c,mother,father],[]);raise id unless actual.nil?;results<<{id:id,expected:nil,actual:actual}}
 results
end
if __FILE__==$0
 results=parent_capture_checks;File.write(__dir__+'/PARENT_CAPTURE_RESULTS.json',JSON.pretty_generate(results)+"\n");puts "#{results.size} parent capture reference cases passed"
end
