// Every routine the crawler can run. Add a site by writing a routine module (see
// JobRightRoutine.js) and listing it here; the side panel picks the one whose
// `match.hosts` covers the focused tab.
import JobRightRoutine from "./JobRightRoutine";

export const ROUTINES = [JobRightRoutine];
