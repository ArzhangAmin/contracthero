import { validate } from 'class-validator';
import { MaxByteLength } from './max-byte-length.validator';

class Sample {
  @MaxByteLength(72)
  password!: unknown;
}

const buildSample = (value: unknown): Sample => {
  const s = new Sample();
  s.password = value;
  return s;
};

describe('MaxByteLength', () => {
  it('accepts a string at the byte limit (ASCII)', async () => {
    const errors = await validate(buildSample('a'.repeat(72)));
    expect(errors).toHaveLength(0);
  });

  it('rejects a string one byte over the limit (ASCII)', async () => {
    const errors = await validate(buildSample('a'.repeat(73)));
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.maxByteLength).toMatch(/72 bytes/);
  });

  it('counts UTF-8 bytes, not characters (multi-byte rejected)', async () => {
    // '€' is 3 bytes in UTF-8 → 25 × 3 = 75 bytes, only 25 chars.
    const value = '€'.repeat(25);
    expect(value.length).toBe(25);
    expect(Buffer.byteLength(value, 'utf8')).toBe(75);

    const errors = await validate(buildSample(value));
    expect(errors).toHaveLength(1);
  });

  it('accepts multi-byte strings within the byte limit', async () => {
    // 24 × 3 = 72 bytes, exactly at the cap.
    const errors = await validate(buildSample('€'.repeat(24)));
    expect(errors).toHaveLength(0);
  });

  it('rejects non-string values', async () => {
    const errors = await validate(buildSample(12345));
    expect(errors).toHaveLength(1);
  });
});
