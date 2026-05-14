import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, test } from 'vitest';

const REQUIRED_BITMAP_CHARS = '·炸开吸走重排';
const gameRoot = resolveGameRoot();

function resolveGameRoot(): string {
  const current = cwd();
  if (existsSync(resolve(current, 'public-pack/fonts/main.fnt'))) {
    return current;
  }
  return resolve(current, 'games/gonglian-fangxian/game');
}

function gamePath(path: string): string {
  return resolve(gameRoot, path);
}

describe('bitmap font atlas coverage', () => {
  test('includes power-up labels and the missing-glyph replacement', () => {
    const charset = readFileSync(gamePath('docs/font-charset.txt'), 'utf8');
    const atlas = readFileSync(gamePath('public-pack/fonts/main.fnt'), 'utf8');

    for (const ch of REQUIRED_BITMAP_CHARS) {
      expect(charset, `charset should include ${ch}`).toContain(ch);
      expect(atlas, `atlas should include glyph for ${ch}`).toContain(`id="${ch.codePointAt(0)}"`);
    }
  });
});
