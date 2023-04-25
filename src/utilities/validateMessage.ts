import type { FromSchema, JSONSchema } from 'json-schema-to-ts';
import addFormats from 'ajv-formats';
import Ajv from 'ajv';

type ValidationResult<Schema extends JSONSchema> = FromSchema<Schema> | string;

const ajv = addFormats(new Ajv());

// need to add tests!
export function validateMessage<Schema extends JSONSchema>(
  value: unknown,
  schema: Schema,
): ValidationResult<Schema> {
  if (!ajv.validate(schema, value)) {
    return ajv.errorsText(ajv.errors);
  }

  return value as ValidationResult<Schema>;
}
