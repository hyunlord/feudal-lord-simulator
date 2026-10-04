require 'json'
require 'digest'
def validate_schema(value, schema, root, path='$')
  allowed=%w[$schema $id title description $ref type required properties additionalProperties const enum pattern items uniqueItems minItems maxItems minLength anyOf $defs]
  raise "unsupported schema keyword #{schema.keys-allowed}" unless (schema.keys-allowed).empty?
  if schema['$ref']
    target=schema['$ref'].delete_prefix('#/').split('/').reduce(root){|node,key|node.fetch(key)}
    validate_schema(value,target,root,path)
  end
  if schema.key?('type')
    matched=Array(schema['type']).any? do |type|
      case type
      when 'object' then value.is_a?(Hash)
      when 'array' then value.is_a?(Array)
      when 'string' then value.is_a?(String)
      when 'number' then value.is_a?(Numeric)
      when 'integer' then value.is_a?(Integer)
      when 'boolean' then value==true || value==false
      when 'null' then value.nil?
      else raise "unsupported type #{type}"
      end
    end
    raise "#{path}: type" unless matched
  end
  raise "#{path}: const" if schema.key?('const') && value != schema['const']
  raise "#{path}: enum" if schema['enum'] && !schema['enum'].include?(value)
  if value.is_a?(Hash)
    raise "#{path}: required" unless (Array(schema['required'])-value.keys).empty?
    props=schema['properties'] || {}
    raise "#{path}: additional properties" if schema['additionalProperties']==false && !(value.keys-props.keys).empty?
    props.each{|key,s|validate_schema(value[key],s,root,"#{path}.#{key}") if value.key?(key)}
  elsif value.is_a?(Array)
    raise "#{path}: minItems" if schema['minItems'] && value.size<schema['minItems']
    raise "#{path}: maxItems" if schema['maxItems'] && value.size>schema['maxItems']
    raise "#{path}: uniqueItems" if schema['uniqueItems'] && value.uniq.size!=value.size
    value.each_with_index{|v,i|validate_schema(v,schema['items'],root,"#{path}[#{i}]")} if schema['items']
  elsif value.is_a?(String)
    raise "#{path}: minLength" if schema['minLength'] && value.length<schema['minLength']
    raise "#{path}: pattern" if schema['pattern'] && !Regexp.new(schema['pattern']).match?(value)
  end
  if schema['anyOf']
    matches=schema['anyOf'].count do |sub|
      begin
        validate_schema(value,sub,root,path);true
      rescue RuntimeError
        false
      end
    end
    raise "#{path}: anyOf" if matches.zero?
  end
  true
end
