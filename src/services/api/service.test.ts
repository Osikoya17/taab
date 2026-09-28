/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/**
 * TanStack Query calls `queryFn(context)` and `mutationFn(variables, context)`.
 * Passing a service method directly forwards that context to the API as an
 * extra argument, and the server's strict argument check answers 422. Demo
 * mode ignores extra arguments, so this only breaks with a real backend.
 */
describe('service calls from query hooks', () => {
  it('always wrap service methods so query context is never sent to the API', () => {
    const direct = /(queryFn|mutationFn):\s*[A-Za-z]+Service\.[A-Za-z]+\s*[,}]/;
    const offenders = sourceFiles(SRC)
      .filter((file) => direct.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file));
    expect(offenders).toEqual([]);
  });
});
