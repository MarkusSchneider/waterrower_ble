/**
 * Event names emitted by WaterRower
 */
export const WaterRowerEvents = {
    INITIALIZED: Symbol('WaterRower:initialized'),
    ERROR: Symbol('WaterRower:error'),
    CLOSE: Symbol('WaterRower:close'),
    DATA: Symbol('WaterRower:data'),
} as const;
