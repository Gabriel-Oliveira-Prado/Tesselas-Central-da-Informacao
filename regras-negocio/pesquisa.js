import { findFactChecks, relatedChecks } from './checagens.js';
import { contextFor, publishedChecks, refreshContext } from './noticias.js';

export function evidenceFor(text, story) {
  const exact = [...findFactChecks(text), ...publishedChecks(text, story)];
  return { exact, related: exact.length ? [] : relatedChecks(text), news: exact.length ? [] : contextFor(text) };
}

export async function research(text, story) {
  await refreshContext();
  return evidenceFor(text, story);
}
