// Postgres advisory lock keys used to serialize specific admin write
// operations against concurrent duplicates of themselves — preventing
// TOCTOU races where two requests both pass a "does this already exist"
// guard before either has committed (e.g. two rapid clicks, or an
// auto-trigger racing a manual one). Each key just needs to be distinct
// from the others; the values themselves are arbitrary.
export const KNOCKOUT_SEED_LOCK_KEY = 72186340;
export const GROUP_GENERATION_LOCK_KEY = 72186341;
