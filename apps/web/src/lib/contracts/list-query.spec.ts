import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_SEARCH_LENGTH,
  MIN_PAGE,
  MIN_PAGE_SIZE,
  buildQueryString,
  buildSearchParams,
  parseSearchParams,
} from './list-query';

describe('parseSearchParams', () => {
  it('baraye empty input default ha ro bargardune', () => {
    const q = parseSearchParams({});
    expect(q).toEqual({
      status: undefined,
      category: undefined,
      search: undefined,
      page: DEFAULT_PAGE,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  it('status va category motabar ro bargardune', () => {
    const q = parseSearchParams({ status: 'ACTIVE', category: 'RENT' });
    expect(q.status).toBe('ACTIVE');
    expect(q.category).toBe('RENT');
  });

  it('status va category naa-motabar ro silently drop kone', () => {
    const q = parseSearchParams({ status: 'BOGUS', category: 'WHATEVER' });
    expect(q.status).toBeUndefined();
    expect(q.category).toBeUndefined();
  });

  it('search ro trim mikone va string khali ro hazf mikone', () => {
    expect(parseSearchParams({ q: '  hello  ' }).search).toBe('hello');
    expect(parseSearchParams({ q: '   ' }).search).toBeUndefined();
  });

  it('search ro be MAX_SEARCH_LENGTH mahdoud mikone', () => {
    const long = 'a'.repeat(MAX_SEARCH_LENGTH + 50);
    expect(parseSearchParams({ q: long }).search?.length).toBe(MAX_SEARCH_LENGTH);
  });

  it('page va pageSize ro be range clamp mikone', () => {
    expect(parseSearchParams({ page: '0' }).page).toBe(MIN_PAGE);
    expect(parseSearchParams({ pageSize: '999' }).pageSize).toBe(MAX_PAGE_SIZE);
    expect(parseSearchParams({ pageSize: '0' }).pageSize).toBe(MIN_PAGE_SIZE);
  });

  it('page va pageSize naa-motabar ra ba default jaygozin mikone', () => {
    expect(parseSearchParams({ page: 'foo' }).page).toBe(DEFAULT_PAGE);
    expect(parseSearchParams({ pageSize: 'bar' }).pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it('array values ro: faghat aval ra estefade mikone', () => {
    const q = parseSearchParams({ status: ['ACTIVE', 'EXPIRED'] });
    expect(q.status).toBe('ACTIVE');
  });
});

describe('buildSearchParams / buildQueryString', () => {
  it('baraye default ha empty bargardune', () => {
    expect(buildSearchParams({}).toString()).toBe('');
    expect(buildQueryString({})).toBe('');
  });

  it('default page/pageSize ro hazf mikone vali gheyr-default ra negah midarad', () => {
    expect(buildQueryString({ page: DEFAULT_PAGE, pageSize: DEFAULT_PAGE_SIZE })).toBe('');
    expect(buildQueryString({ page: 3 })).toBe('?page=3');
    expect(buildQueryString({ pageSize: 50 })).toBe('?pageSize=50');
  });

  it('hame field ha ra serialize mikone', () => {
    const qs = buildQueryString({
      status: 'ACTIVE',
      category: 'RENT',
      search: 'WG',
      page: 2,
      pageSize: 50,
    });
    expect(qs).toContain('status=ACTIVE');
    expect(qs).toContain('category=RENT');
    expect(qs).toContain('q=WG');
    expect(qs).toContain('page=2');
    expect(qs).toContain('pageSize=50');
  });

  it('round-trip: parse(build(x)) === x', () => {
    const input = {
      status: 'EXPIRED' as const,
      category: 'INSURANCE' as const,
      search: 'allianz',
      page: 4,
      pageSize: 25,
    };
    const qs = buildSearchParams(input);
    const obj: Record<string, string> = {};
    qs.forEach((v, k) => {
      obj[k] = v;
    });
    const parsed = parseSearchParams(obj);
    expect(parsed.status).toBe(input.status);
    expect(parsed.category).toBe(input.category);
    expect(parsed.search).toBe(input.search);
    expect(parsed.page).toBe(input.page);
    expect(parsed.pageSize).toBe(input.pageSize);
  });
});
