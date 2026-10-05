import { detectEpisodes } from '../episodes';

function days(spec: (number | null)[]): { date: string; severity: number | null }[] {
  return spec.map((severity, i) => ({ date: `2026-01-${String(i + 1).padStart(2, '0')}`, severity }));
}

describe('detectEpisodes', () => {
  it('finds no episode below the threshold', () => {
    expect(detectEpisodes(days([1, 2, 3, 4, 5]))).toEqual([]);
  });

  it('requires at least two consecutive days at or above the threshold', () => {
    expect(detectEpisodes(days([2, 6, 2, 2]))).toEqual([]);
    const result = detectEpisodes(days([2, 6, 7, 2]));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ from: '2026-01-02', to: '2026-01-03', peak: 7, days: 2 });
  });

  it('breaks a run at a gap in logging (null), never bridging it', () => {
    const result = detectEpisodes(days([6, 7, null, 8, 9]));
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.days)).toEqual([2, 2]);
  });

  it('breaks a run when severity dips below the threshold', () => {
    const result = detectEpisodes(days([6, 7, 3, 6, 7]));
    expect(result).toHaveLength(2);
  });

  it('orders episodes most recent first', () => {
    const result = detectEpisodes(days([6, 7, 1, 1, 8, 9]));
    expect(result.map((e) => e.from)).toEqual(['2026-01-05', '2026-01-01']);
  });

  it('picks the true peak day and value within a run', () => {
    const result = detectEpisodes(days([6, 9, 7]));
    expect(result[0]).toMatchObject({ peak: 9, peakDate: '2026-01-02', days: 3 });
  });
});
