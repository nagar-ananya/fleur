export interface EpisodeDay {
  date: string;
  severity: number | null;
}

export interface Episode {
  from: string;
  to: string;
  peak: number;
  peakDate: string;
  days: number;
}

const EPISODE_THRESHOLD = 6;
const MIN_EPISODE_DAYS = 2;

export function detectEpisodes(days: readonly EpisodeDay[]): Episode[] {
  const episodes: Episode[] = [];
  let run: EpisodeDay[] = [];

  const flush = (): void => {
    if (run.length >= MIN_EPISODE_DAYS) {
      const peakDay = run.reduce((best, d) => ((d.severity ?? 0) > (best.severity ?? 0) ? d : best));
      episodes.push({
        from: run[0].date,
        to: run[run.length - 1].date,
        peak: peakDay.severity ?? 0,
        peakDate: peakDay.date,
        days: run.length,
      });
    }
    run = [];
  };

  for (const day of days) {
    if (day.severity !== null && day.severity >= EPISODE_THRESHOLD) {
      run.push(day);
    } else {
      flush();
    }
  }
  flush();

  return episodes.reverse();
}
