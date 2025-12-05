/**
 * FIT file type enum
 * Defines the type of data contained in the FIT file
 */
export enum FitFileType {
    DEVICE = 1,
    SETTINGS = 2,
    SPORT = 3,
    ACTIVITY = 4,
    WORKOUT = 5,
    COURSE = 6,
    SCHEDULES = 7,
    WEIGHT = 9,
    TOTALS = 10,
    GOALS = 11,
    BLOOD_PRESSURE = 14,
    MONITORING_A = 15,
    ACTIVITY_SUMMARY = 20,
    MONITORING_DAILY = 28,
    MONITORING_B = 32,
    SEGMENT = 34,
    SEGMENT_LIST = 35,
    EXD_CONFIGURATION = 40,
    MFG_RANGE_MIN = 0xF7,
    MFG_RANGE_MAX = 0xFE,
}

/**
 * FIT manufacturer enum
 * Represents equipment manufacturers
 */
export enum FitManufacturer {
    GARMIN = 1,
    GARMIN_FR405_ANTFS = 2,
    ZEPHYR = 3,
    DAYTON = 4,
    IDT = 5,
    SRM = 6,
    QUARQ = 7,
    IBIKE = 8,
    SARIS = 9,
    SPARK_HK = 10,
    TANITA = 11,
    ECHOWELL = 12,
    DYNASTREAM_OEM = 13,
    NAUTILUS = 14,
    DYNASTREAM = 15,
    TIMEX = 16,
    CONCEPT2 = 17,
    METRIGEAR = 18,
    XELIC = 19,
    BEURER = 20,
    CARDIOSPORT = 21,
    A_AND_D = 22,
    HMM = 23,
    SUUNTO = 24,
    THITA_ELEKTRONIK = 25,
    GPULSE = 26,
    CLEAN_MOBILE = 27,
    PEDAL_BRAIN = 28,
    PEAKSWARE = 29,
    SAXONAR = 30,
    LEMOND_FITNESS = 31,
    DEXCOM = 32,
    WAHOO_FITNESS = 33,
    OCTANE_FITNESS = 34,
    ARCHINOETICS = 35,
    THE_HURT_BOX = 36,
    CITIZEN_SYSTEMS = 37,
    MAGELLAN = 38,
    OSYNCE = 39,
    HOLUX = 40,
    CONCEPT2_2 = 41,
    DEVELOPMENT = 255,
    HEALTHANDLIFE = 257,
    LEZYNE = 258,
    SCRIBE_LABS = 259,
    ZWIFT = 260,
    WATTEAM = 261,
    RECON = 262,
    FAVERO_ELECTRONICS = 263,
    DYNOVELO = 264,
    STRAVA = 265,
    PRECOR = 266,
    BRYTON = 267,
    SRAM = 268,
    NAVMAN = 269,
    COBI = 270,
    SPIVI = 271,
    MIO_TECHNOLOGY_EUROPE = 272,
    ROTOR = 273,
    GEONAUTE = 274,
    ID_BIKE = 275,
    SPECIALIZED = 276,
    WTEK = 277,
    PHYSICAL_ENTERPRISES = 278,
    NORTH_POLE_ENGINEERING = 279,
    BRIM_BROTHERS = 280,
    SIGMA_SPORT = 281,
    TOMTOM = 282,
    PERIPEDAL = 283,
    WATTBIKE = 284,
    MOXY = 285,
    CICLOSPORT = 286,
    POWERBAHN = 287,
    ACORN_PROJECTS_APS = 288,
    LIFEBEAM = 289,
    BONTRAGER = 290,
    WELLGO = 291,
    SCOSCHE = 292,
    MAGURA = 293,
    WOODWAY = 294,
    ELITE = 295,
    NIELSEN_KELLERMAN = 296,
    DK_CITY = 297,
    TACX = 298,
    DIRECTION_TECHNOLOGY = 299,
    MAGTONIC = 300,
}

/**
 * Concept2 product IDs
 */
export enum Concept2Product {
    PM5 = 20,
    PM4 = 8,
    PM3 = 4,
}

/**
 * Source type enum
 * Indicates where the data originated
 */
export enum FitSourceType {
    ANT = 0,
    ANT_PLUS = 1,
    BLUETOOTH = 2,
    BLUETOOTH_LOW_ENERGY = 3,
    WIFI = 4,
    LOCAL = 5,
}

/**
 * Sport type enum
 */
export enum FitSport {
    GENERIC = 0,
    RUNNING = 1,
    CYCLING = 2,
    TRANSITION = 3,
    FITNESS_EQUIPMENT = 4,
    SWIMMING = 5,
    BASKETBALL = 6,
    SOCCER = 7,
    TENNIS = 8,
    AMERICAN_FOOTBALL = 9,
    TRAINING = 10,
    WALKING = 11,
    CROSS_COUNTRY_SKIING = 12,
    ALPINE_SKIING = 13,
    SNOWBOARDING = 14,
    ROWING = 15,
    MOUNTAINEERING = 16,
    HIKING = 17,
    MULTISPORT = 18,
    PADDLING = 19,
}

/**
 * Sub-sport type enum
 */
export enum FitSubSport {
    GENERIC = 0,
    TREADMILL = 1,
    STREET = 2,
    TRAIL = 3,
    TRACK = 4,
    SPIN = 5,
    INDOOR_CYCLING = 6,
    ROAD = 7,
    MOUNTAIN = 8,
    DOWNHILL = 9,
    RECUMBENT = 10,
    CYCLOCROSS = 11,
    HAND_CYCLING = 12,
    TRACK_CYCLING = 13,
    INDOOR_ROWING = 14,
    ELLIPTICAL = 15,
    STAIR_CLIMBING = 16,
    LAP_SWIMMING = 17,
    OPEN_WATER = 18,
}

/**
 * Event type enum
 */
export enum FitEventType {
    START = 0,
    STOP = 1,
    CONSECUTIVE_DEPRECIATED = 2,
    MARKER = 3,
    STOP_ALL = 4,
    BEGIN_DEPRECIATED = 5,
    END_DEPRECIATED = 6,
    END_ALL_DEPRECIATED = 7,
    STOP_DISABLE = 8,
    STOP_DISABLE_ALL = 9,
}

/**
 * Event enum
 */
export enum FitEvent {
    TIMER = 0,
    WORKOUT = 3,
    WORKOUT_STEP = 4,
    POWER_DOWN = 5,
    POWER_UP = 6,
    OFF_COURSE = 7,
    SESSION = 8,
    LAP = 9,
    COURSE_POINT = 10,
    BATTERY = 11,
    VIRTUAL_PARTNER_PACE = 12,
    HR_HIGH_ALERT = 13,
    HR_LOW_ALERT = 14,
    SPEED_HIGH_ALERT = 15,
    SPEED_LOW_ALERT = 16,
    CAD_HIGH_ALERT = 17,
    CAD_LOW_ALERT = 18,
    POWER_HIGH_ALERT = 19,
    POWER_LOW_ALERT = 20,
    RECOVERY_HR = 21,
    BATTERY_LOW = 22,
    TIME_DURATION_ALERT = 23,
    DISTANCE_DURATION_ALERT = 24,
    CALORIE_DURATION_ALERT = 25,
    ACTIVITY = 26,
    FITNESS_EQUIPMENT = 27,
}

/**
 * Lap trigger enum
 */
export enum FitLapTrigger {
    MANUAL = 0,
    TIME = 1,
    DISTANCE = 2,
    POSITION_START = 3,
    POSITION_LAP = 4,
    POSITION_WAYPOINT = 5,
    POSITION_MARKED = 6,
    SESSION_END = 7,
    FITNESS_EQUIPMENT = 8,
}

/**
 * Activity type enum
 */
export enum FitActivityType {
    MANUAL = 0,
    AUTO_MULTI_SPORT = 1,
}
