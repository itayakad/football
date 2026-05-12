export interface Fixture {
  homeId: string;
  awayId: string;
  week: number;
}

// Standard "circle method" round-robin for n teams.
// Produces a complete home-and-away schedule:
//   weeks 1 to n-1:   first-leg fixtures
//   weeks n to 2(n-1): return fixtures with home/away swapped
// Every team plays every other team exactly twice (once home, once away).
export function generateRoundRobin(teamIds: string[]): Fixture[] {
  const n = teamIds.length;
  if (n % 2 !== 0) throw new Error(`Need even number of teams, got ${n}`);

  const fixtures: Fixture[] = [];
  const [fixed, ...rest] = teamIds;
  const rotating = [...rest];

  for (let round = 0; round < n - 1; round++) {
    const week = round + 1;
    const circle = [fixed, ...rotating];

    for (let i = 0; i < n / 2; i++) {
      const a = circle[i];
      const b = circle[n - 1 - i];
      // Alternate which side gets home advantage to balance home games
      // across the first half of the season.
      fixtures.push(
        round % 2 === 0
          ? { homeId: a, awayId: b, week }
          : { homeId: b, awayId: a, week }
      );
    }

    // Rotate: move last element to front
    rotating.unshift(rotating.pop()!);
  }

  // Return fixtures: mirror with home/away swapped, offset by n-1 weeks
  const offset = n - 1;
  const firstLeg = [...fixtures];
  for (const f of firstLeg) {
    fixtures.push({ homeId: f.awayId, awayId: f.homeId, week: f.week + offset });
  }

  return fixtures;
}
