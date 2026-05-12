import { useEffect, useState } from 'react';
import { api } from '../api/client';

// MVP: the user "owns" whichever team the backend's /api/me returns
// (currently hardcoded to Dallas Vanguard). When auth is added, this
// hook will resolve from a real session instead.
export function useUserTeamId(): string | null {
  const [teamId, setTeamId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.me()
      .then((me) => { if (active) setTeamId(me.id); })
      .catch((err) => console.warn('Failed to load /api/me:', err.message));
    return () => { active = false; };
  }, []);

  return teamId;
}
