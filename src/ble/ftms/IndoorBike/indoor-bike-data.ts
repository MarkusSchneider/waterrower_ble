export interface IndoorBikeData {
    speed?: number;
    averageSpeed?: number;
    cadence?: number;
    averageCadence?: number;
    totalDistance?: number;
    resistanceLevel?: number;
    instantaneousPower?: number;
    averagePower?: number;

    totalEnergy?: number;
    energyPerHour?: number;
    energyPerMinute?: number;
    heartrate?: number;
    metabolicEquivalent?: number;
    time?: number;
    remainingTime?: number;
    raw?: string;

    targetPower?: number;
    targetInclination?: number;
    status?: string;
}

export interface IndoorBikeFeatures {
    fitnessMachine: number;
    targetSettings: number;
    power?: boolean;
    heartrate?: boolean;
    cadence?: boolean;
    setSlope?: boolean;
    setPower?: boolean;
}

export const enum OpCode {
    RequestControl = 0x00,
    Reset = 0x01,
    SetTargetSpeed = 0x02,
    SetTargetInclination = 0x03,
    SetTargetResistance = 0x04,
    SetTargetPower = 0x05,
    SetTargetHeartRate = 0x06,
    StartOrResume = 0x07,
    StopOrPause = 0x08,
    SetTargetedExpendedEnergy = 0x09,
    SetTargetedNumberofSteps = 0x0A,
    SetIndoorBikeSimulation = 0x11,
    SetWheelCircumference = 0x12,
    SpinDownControl = 0x13,
    SetTargetedCadence = 0x14,
    ResponseCode = 0x80,
}

export const enum FitnessMachineStatusOpCode {
    Reset = 0x01,
    FitnessMachineStoppedOrPaused = 0x02,
    FitnessMachineStoppedBySafetyKey = 0x03,
    FitnessMachineStartedOrResumed = 0x04,
    TargetSpeedChanged = 0x05,
    TargetInclineChanged = 0x06,
    TargetResistanceLevelChanged = 0x07,
    TargetPowerChanged = 0x08,
    TargetHeartRateChanged = 0x09,
    TargetExpendedEnergyChanged = 0x0A,
    // ignore 0x0B...0x11
    IndoorBikeSimulationParametersChanged = 0x12,
    WheelCircumferenceChanged = 0x13,
    SpinDownStatus = 0x14,
    TargetedCadenceChanged = 0x15,
    ControlPermissionLost = 0xFF,
}

export const enum OpCodeResut {
    Success = 0x01,
    OpCodeNotSupported = 0x02,
    InvalidParameter = 0x03,
    OperationFailed = 0x04,
    ControlNotPermitted = 0x05,
}

const bit = (nr: number) => (1 << nr);

export const IndoorBikeDataFlag = {
    MoreData: bit(0),                       // 0x0001
    AverageSpeedPresent: bit(1),            // 0x0002
    InstantaneousCadence: bit(2),           // 0x0004
    AverageCadencePresent: bit(3),          // 0x0008
    TotalDistancePresent: bit(4),           // 0x0010
    ResistanceLevelPresent: bit(5),         // 0x0020
    InstantaneousPowerPresent: bit(6),      // 0x0040
    AveragePowerPresent: bit(7),            // 0x0080
    ExpendedEnergyPresent: bit(8),          // 0x0100
    HeartRatePresent: bit(9),               // 0x0200
    MetabolicEquivalentPresent: bit(10),    // 0x0400
    ElapsedTimePresent: bit(11),            // 0x0800
    RemainingTimePresent: bit(12),          // 0x1000
};

export const FitnessMachineFeatureFlag = {
    AverageSpeedSupported: bit(0),                  // 0x00000001 
    CadenceSupported: bit(1),                       // 0x00000002
    TotalDistanceSupported: bit(2),                 // 0x00000004
    InclinationSupported: bit(3),                   // 0x00000008
    ElevationGainSupported: bit(4),                 // 0x00000010
    PaceSupported: bit(5),                          // 0x00000020
    StepCountSupported: bit(6),                     // 0x00000040
    ResistanceLevelSupported: bit(7),               // 0x00000080
    StrideCountSupported: bit(8),                   // 0x00000100
    ExpendedEnergySupported: bit(9),                // 0x00000200
    HeartRateMeasurementSupported: bit(10),         // 0x00000400
    MetabolicEquivalentSupported: bit(11),          // 0x00000800
    ElapsedTimeSupported: bit(12),                  // 0x00001000
    RemainingTimeSupported: bit(13),                // 0x00002000
    PowerMeasurementSupported: bit(14),             // 0x00004000
    ForceOnBeltAndPowerOutputSupported: bit(15),    // 0x00008000
    UserDataRetentionSupported: bit(16),            // 0x00010000
    //  17-31 Reserved for Future Use
};

export const TargetSettingFeatureFlag = {
    SpeedTargetSettingSupported: bit(0),
    InclinationTargetSettingSupported: bit(1),
    ResistanceTargetSettingSupported: bit(2),
    PowerTargetSettingSupported: bit(3),
    HeartRateTargetSettingSupported: bit(4),
    TargetedExpendedEnergyConfigurationSupported: bit(5),
    TargetedStepNumberConfigurationSupported: bit(6),
    TargetedStrideNumberConfigurationSupported: bit(7),
    TargetedDistanceConfigurationSupported: bit(8),
    TargetedTrainingTimeConfigurationSupported: bit(9),
    TargetedTimeInTwoHeartRateZonesConfigurationSupported: bit(10),
    TargetedTimeInThreeHeartRateZonesConfigurationSupported: bit(11),
    TargetedTimeInFiveHeartRateZonesConfigurationSupported: bit(12),
    IndoorBikeSimulationParametersSupported: bit(13),
    WheelCircumferenceConfigurationSupported: bit(14),
    SpinDownControlSupported: bit(15),
    TargetedCadenceConfigurationSupported: bit(16),
};
