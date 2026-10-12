// Every routine the crawler can run. Add a site by writing a routine module (see
// JobRightRoutine.js) and listing it here; the side panel picks the one whose
// `match.hosts` covers the focused tab. Each routine declares its fields; every
// job routine shares the required core applyUrl, title, description, companyName.
import { CORE_JOB_FIELDS } from "../routineKit";

import BuiltInRoutine from "./BuiltInRoutine";
import JobRightRoutine from "./JobRightRoutine";

export { CORE_JOB_FIELDS };

export const ROUTINES = [JobRightRoutine, BuiltInRoutine];
