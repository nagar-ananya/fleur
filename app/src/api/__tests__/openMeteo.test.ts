/**
 * Open-Meteo client tests (REQUIREMENTS §15.2).
 *
 * Required cases: rate limit enforced; malformed response rejected; timeout
 * handled; the offline read path still works.
 */

import {
  canFetch,
  coarsen,
  fetchEnvironment,
  isStale,
  MIN_FETCH_INTERVAL_MS,
  STALE_AFTER_MS,
} from '../openMeteo';

const NOW = Date.parse('2026-06-01T12:00:00Z');

const validWeather = {
  daily: {
    time: ['2026-05-31', '2026-06-01'],
    temperature_2m_mean: [14.2, 15.1],
    temperature_2m_min: [9, 10],
    temperature_2m_max: [19, 20],
    relative_humidity_2m_mean: [70, 65],
    dew_point_2m_mean: [8.5, 8.1],
    surface_pressure_mean: [1012, 1010],
    uv_index_max: [4.1, 5.2],
    precipitation_sum: [0, 1.2],
    wind_speed_10m_max: [15, 22],
  },
};

const validAir = {
  hourly: {
    time: ['2026-05-31T00:00', '2026-05-31T01:00', '2026-06-01T00:00'],
    pm2_5: [10, 20, 8],
    pm10: [15, 25, 12],
    ozone: [50, 60, 40],
    alder_pollen: [1, 3, 0],
    birch_pollen: [2, 2, 1],
    grass_pollen: [0, 0, 5],
    ragweed_pollen: [0, 0, 0],
  },
};

function mockFetchOnce(handler: (url: string) => unknown): jest.Mock {
  const mock = jest.fn(async (url: string) => ({
    ok: true,
    status: 200,
    json: async () => handler(url),
  }));
  (globalThis as { fetch: unknown }).fetch = mock;
  return mock as unknown as jest.Mock;
}

describe('rate limiting (API-3 / FR-3.4)', () => {
  it('allows the first ever fetch', () => {
    expect(canFetch(null, NOW)).toBe(true);
  });

  it('blocks a second fetch inside the hour', () => {
    const thirtyMinutesAgo = new Date(NOW - 30 * 60 * 1000).toISOString();
    expect(canFetch(thirtyMinutesAgo, NOW)).toBe(false);
  });

  it('allows one again after the interval elapses', () => {
    const justOver = new Date(NOW - MIN_FETCH_INTERVAL_MS - 1).toISOString();
    expect(canFetch(justOver, NOW)).toBe(true);
  });

  it('treats an unparseable timestamp as permission to refetch', () => {
    expect(canFetch('not-a-date', NOW)).toBe(true);
  });
});

describe('staleness (FR-3.1)', () => {
  it('considers data older than six hours stale', () => {
    expect(isStale(new Date(NOW - STALE_AFTER_MS - 1).toISOString(), NOW)).toBe(true);
    expect(isStale(new Date(NOW - 60 * 60 * 1000).toISOString(), NOW)).toBe(false);
  });
});

describe('coordinate rounding (PRIV-3)', () => {
  it('rounds to two decimal places before anything is transmitted', () => {
    expect(coarsen({ latitude: 51.507351, longitude: -0.127758 })).toEqual({
      latitude: 51.51,
      longitude: -0.13,
    });
  });
});

describe('fetchEnvironment', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps a valid response onto EnvironmentDay rows', async () => {
    mockFetchOnce((url) => (url.includes('air-quality') ? validAir : validWeather));
    const { days, ok } = await fetchEnvironment({ latitude: 51.5, longitude: -0.1 }, '2026-06-01');

    expect(ok).toBe(true);
    expect(days).toHaveLength(2);
    expect(days[0].date).toBe('2026-05-31');
    expect(days[0].tempMeanC).toBeCloseTo(14.2, 10);
    // Hourly air quality is averaged into a daily mean: (10 + 20) / 2.
    expect(days[0].pm25).toBeCloseTo(15, 10);
    // pollen_total sums the species present, treating missing ones as zero.
    expect(days[0].pollenTotal).toBeCloseTo(4, 10);
  });

  it('flags days after today as forecast', async () => {
    mockFetchOnce((url) => (url.includes('air-quality') ? validAir : validWeather));
    const { days } = await fetchEnvironment({ latitude: 51.5, longitude: -0.1 }, '2026-05-31');
    expect(days[0].isForecast).toBe(false);
    expect(days[1].isForecast).toBe(true);
  });

  it('sends only coarsened coordinates (PRIV-2 / PRIV-3)', async () => {
    const mock = mockFetchOnce((url) => (url.includes('air-quality') ? validAir : validWeather));
    await fetchEnvironment({ latitude: 51.507351, longitude: -0.127758 }, '2026-06-01');
    const requested = String(mock.mock.calls[0][0]);
    expect(requested).toContain('latitude=51.51');
    expect(requested).toContain('longitude=-0.13');
    expect(requested).not.toContain('51.507351');
  });

  it('rejects a malformed payload rather than writing nulls (API-4)', async () => {
    mockFetchOnce(() => ({ daily: { time: ['2026-06-01'], temperature_2m_mean: [1, 2, 3] } }));
    const { days, ok } = await fetchEnvironment({ latitude: 51.5, longitude: -0.1 }, '2026-06-01');
    // A value array out of step with `time` would silently misalign every
    // reading against the wrong date.
    expect(ok).toBe(false);
    expect(days).toEqual([]);
  });

  it('rejects a response with no daily block at all', async () => {
    mockFetchOnce(() => ({ error: true, reason: 'bad request' }));
    const { ok } = await fetchEnvironment({ latitude: 51.5, longitude: -0.1 }, '2026-06-01');
    expect(ok).toBe(false);
  });

  it('still returns weather when air quality is unavailable', async () => {
    (globalThis as { fetch: unknown }).fetch = jest.fn(async (url: string) => {
      if (String(url).includes('air-quality')) throw new Error('network down');
      return { ok: true, status: 200, json: async () => validWeather };
    });
    const { days, ok } = await fetchEnvironment({ latitude: 51.5, longitude: -0.1 }, '2026-06-01');
    expect(ok).toBe(true);
    expect(days[0].tempMeanC).toBeCloseTo(14.2, 10);
    expect(days[0].pm25).toBeNull();
  }, 20_000);

  it('gives up silently when the network never answers (API-1 / API-2)', async () => {
    (globalThis as { fetch: unknown }).fetch = jest.fn(async () => {
      throw new Error('timeout');
    });
    const { days, ok } = await fetchEnvironment({ latitude: 51.5, longitude: -0.1 }, '2026-06-01');
    // No throw reaches the caller — a dead network must not break the app.
    expect(ok).toBe(false);
    expect(days).toEqual([]);
  }, 20_000);

  it('retries before giving up, then succeeds', async () => {
    let attempts = 0;
    (globalThis as { fetch: unknown }).fetch = jest.fn(async (url: string) => {
      if (String(url).includes('air-quality')) return { ok: true, status: 200, json: async () => validAir };
      attempts += 1;
      if (attempts < 2) throw new Error('flaky');
      return { ok: true, status: 200, json: async () => validWeather };
    });
    const { ok } = await fetchEnvironment({ latitude: 51.5, longitude: -0.1 }, '2026-06-01');
    expect(ok).toBe(true);
    expect(attempts).toBe(2);
  }, 20_000);
});
