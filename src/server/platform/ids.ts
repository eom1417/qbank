import { randomUUID } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const newId = (): string => randomUUID();

export const isId = (value: string): boolean => UUID.test(value);

/** A well-formed id that matches nothing: stands in for an empty `in (...)` list. */
export const NO_ID = '00000000-0000-0000-0000-000000000000';
