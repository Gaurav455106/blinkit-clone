// Staff "Student view" runs are saved in this batch (forced by the server; see
// server/testRuns.ts). Trainer views leave them out so they don't skew real
// students' numbers; Admin still lists them so they can be found and deleted.
export const TEST_BATCH = "MASTER";

export const isTestRun = (row: { batch_code: string }): boolean => row.batch_code === TEST_BATCH;
