/**
 * Event names emitted by HeartRateMonitor
 */
export const HeartRateMonitorEvents = {
    READY: Symbol('HeartRateMonitor:ready'),
    CONNECTED: Symbol('HeartRateMonitor:connected'),
    DISCONNECTED: Symbol('HeartRateMonitor:disconnected'),
    ERROR: Symbol('HeartRateMonitor:error'),
} as const;
