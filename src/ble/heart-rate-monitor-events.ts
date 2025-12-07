/**
 * Event names emitted by HeartRateMonitor
 */
export const HeartRateMonitorEvents = {
    CONNECTED: Symbol('HeartRateMonitor:connected'),
    DISCONNECTED: Symbol('HeartRateMonitor:disconnected'),
    ERROR: Symbol('HeartRateMonitor:error'),
} as const;
