/**
 * Event names emitted by TrainingSession
 */
export const TrainingSessionEvents = {
    STARTED: Symbol('TrainingSession:started'),
    PAUSED: Symbol('TrainingSession:paused'),
    RESUMED: Symbol('TrainingSession:resumed'),
    STOPPED: Symbol('TrainingSession:stopped'),
    DATAPOINT: Symbol('TrainingSession:datapoint'),
    ERROR: Symbol('TrainingSession:error'),
} as const;
