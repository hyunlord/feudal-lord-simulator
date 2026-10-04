require 'json';require 'digest'
def schema_ok(v,s,root)
 supported=%w[$schema $id title description $ref type required properties additionalProperties const enum pattern items uniqueItems minItems maxItems minLength minimum maximum anyOf $defs]
 raise 'unsupported keyword' unless (s.keys-supported).empty?
 return false if s['$ref'] && !schema_ok(v,s['$ref'].sub('#/','').split('/').reduce(root){|h,k|h.fetch(k)},root)
 if s['type']
  ok=Array(s['type']).any?{|t|case t;when 'object';v.is_a?(Hash);when 'array';v.is_a?(Array);when 'string';v.is_a?(String);when 'number';v.is_a?(Numeric);when 'integer';v.is_a?(Integer);when 'boolean';[true,false].include?(v);when 'null';v.nil?;else;raise 'type';end};return false unless ok
 end
 return false if s.key?('const') && v!=s['const'];return false if s['enum'] && !s['enum'].include?(v)
 if v.is_a?(Numeric)
  return false if s['minimum'] && v<s['minimum'];return false if s['maximum'] && v>s['maximum']
 elsif v.is_a?(String)
  return false if s['minLength'] && v.size<s['minLength'];return false if s['pattern'] && !Regexp.new(s['pattern']).match?(v)
 elsif v.is_a?(Array)
  return false if s['minItems'] && v.size<s['minItems'];return false if s['maxItems'] && v.size>s['maxItems'];return false if s['uniqueItems'] && v.uniq!=v
  return false if s['items'] && !v.all?{|x|schema_ok(x,s['items'],root)}
 elsif v.is_a?(Hash)
  return false unless (Array(s['required'])-v.keys).empty?
  props=s['properties']||{};return false if s['additionalProperties']==false && !(v.keys-props.keys).empty?
  return false unless props.all?{|k,sub|!v.key?(k)||schema_ok(v[k],sub,root)}
 end
 return false if s['anyOf'] && !s['anyOf'].any?{|sub|schema_ok(v,sub,root)}
 true
end
def validate_schema(v,s,root);raise 'schema rejected' unless schema_ok(v,s,root);true;end
