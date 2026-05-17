import { describe, expect, it } from 'vitest';
import {
  buildContractsQueryString,
  DEFAULT_DIRECTION,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT,
  MAX_PAGE_SIZE,
  parseContractsSearchParams,
} from './contracts-search-params';

describe('parseContractsSearchParams', () => {
  it('applies defaults when the URL is empty', () => {
    expect(parseContractsSearchParams({})).toEqual({
      page: DEFAULT_PAGE,
      pageSize: DEFAULT_PAGE_SIZE,
      sort: DEFAULT_SORT,
      direction: DEFAULT_DIRECTION,
      status: undefined,
      search: undefined,
      endDateFrom: undefined,
      endDateTo: undefined,
    });
  });

  it('parses valid values', () => {
    const result = parseContractsSearchParams({
      page: '3',
      pageSize: '25',
      sort: 'title',
      dir: 'desc',
      status: 'active',
      search: '  Lease  ',
      endDateFrom: '2025-01-01',
      endDateTo: '2025-12-31',
    });

    expect(result).toEqual({
      page: 3,
      pageSize: 25,
      sort: 'title',
      direction: 'desc',
      status: 'active',
      search: 'Lease',
      endDateFrom: '2025-01-01',
      endDateTo: '2025-12-31',
    });
  });

  it('falls back to defaults for malformed values', () => {
    const result = parseContractsSearchParams({
      page: '-1',
      pageSize: 'lots',
      sort: 'unknown',
      dir: 'sideways',
      status: 'bogus',
      endDateFrom: '2025/01/01',
      endDateTo: 'not-a-date',
    });

    expect(result.page).toBe(DEFAULT_PAGE);
    expect(result.pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(result.sort).toBe(DEFAULT_SORT);
    expect(result.direction).toBe(DEFAULT_DIRECTION);
    expect(result.status).toBeUndefined();
    expect(result.endDateFrom).toBeUndefined();
    expect(result.endDateTo).toBeUndefined();
  });

  it('caps pageSize at MAX_PAGE_SIZE', () => {
    expect(parseContractsSearchParams({ pageSize: '99999' }).pageSize).toBe(MAX_PAGE_SIZE);
  });

  it('uses the first value when an array is provided', () => {
    expect(parseContractsSearchParams({ sort: ['title', 'value'] }).sort).toBe('title');
  });
});

describe('buildContractsQueryString', () => {
  const base = parseContractsSearchParams({});

  it('returns an empty string when nothing differs from defaults', () => {
    expect(buildContractsQueryString(base)).toBe('');
  });

  it('emits non-default values', () => {
    const current = parseContractsSearchParams({
      page: '2',
      sort: 'title',
      dir: 'desc',
      status: 'active',
      search: 'lease',
    });
    const qs = buildContractsQueryString(current);
    expect(qs.startsWith('?')).toBe(true);
    const params = new URLSearchParams(qs.slice(1));
    expect(params.get('page')).toBe('2');
    expect(params.get('sort')).toBe('title');
    expect(params.get('dir')).toBe('desc');
    expect(params.get('status')).toBe('active');
    expect(params.get('search')).toBe('lease');
  });

  it('applies overrides and clears with null', () => {
    const current = parseContractsSearchParams({ page: '5', status: 'active', search: 'lease' });
    const qs = buildContractsQueryString(current, { page: 1, status: null });
    const params = new URLSearchParams(qs.slice(1));
    expect(params.get('page')).toBeNull();
    expect(params.get('status')).toBeNull();
    expect(params.get('search')).toBe('lease');
  });

  it('resets page to default via override even when current is non-default', () => {
    const current = parseContractsSearchParams({ page: '7' });
    expect(buildContractsQueryString(current, { page: 1 })).toBe('');
  });
});
