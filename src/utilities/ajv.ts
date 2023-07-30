import { type $Compiler, wrapCompilerAsTypeGuard } from 'json-schema-to-ts';
import addFormats from 'ajv-formats';
import Ajv from 'ajv';

const ajv = addFormats(new Ajv());
const $compile: $Compiler = (schema) => ajv.compile(schema);
export const compileSchema = wrapCompilerAsTypeGuard($compile);
