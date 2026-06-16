'use strict';

const IDENTIFIER_RE = /^[a-z_][a-z0-9_]*$/;

function schemaFromEnv(name, defaultValue) {
  const value = (process.env[name] || defaultValue).trim();
  if (!IDENTIFIER_RE.test(value)) {
    throw new Error(
      `${name} must be a lowercase PostgreSQL identifier matching [a-z_][a-z0-9_]*`
    );
  }
  return value;
}

function meetingJoinerSchema() {
  return schemaFromEnv('MEETING_JOINER_SCHEMA', 'public');
}

function pgqueuerSchema() {
  return schemaFromEnv('MEETING_JOINER_PGQUEUER_SCHEMA', 'pgqueuer');
}

function quoteIdentifier(identifier) {
  if (!IDENTIFIER_RE.test(identifier)) {
    throw new Error(
      `PostgreSQL identifier must match [a-z_][a-z0-9_]*: ${JSON.stringify(identifier)}`
    );
  }
  return `"${identifier}"`;
}

function qualifiedName(name, schema = meetingJoinerSchema()) {
  return `${quoteIdentifier(schema)}.${quoteIdentifier(name)}`;
}

module.exports = {
  meetingJoinerSchema,
  pgqueuerSchema,
  quoteIdentifier,
  qualifiedName,
};
