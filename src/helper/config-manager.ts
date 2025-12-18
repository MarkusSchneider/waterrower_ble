import debug from 'debug';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { mkdirSync } from 'fs';
import * as path from 'path';

const logger = debug('CONFIG_MANAGER');

export type SessionMode = 'training' | 'record' | 'replay';

export interface AppConfig {
    port: number;
    fitFilesDirectory: string;
    garminCredentials?: {
        email: string;
        password: string;
    };
    hrmDevice?: {
        id: string;
        name: string;
    };
    waterRowerPort?: string;
    ssl?: {
        enabled: boolean;
        keyPath: string;
        certPath: string;
        port: number;
    };
    sessionMode?: SessionMode;
    recordingFile?: string;
}

const DEFAULT_CONFIG: AppConfig = {
    port: 3000,
    fitFilesDirectory: './data/fit-files',
    garminCredentials: undefined,
    hrmDevice: undefined,
    waterRowerPort: undefined,
    ssl: {
        enabled: false,
        keyPath: './data/certs/privkey.pem',
        certPath: './data/certs/fullchain.pem',
        port: 3443
    },
    sessionMode: 'training',
    recordingFile: undefined
};

export class ConfigManager {
    private configPath: string;
    private config: AppConfig;

    constructor(configDir: string = './data') {
        // Ensure config directory exists
        if (!existsSync(configDir)) {
            mkdirSync(configDir, { recursive: true });
        }

        this.configPath = path.join(configDir, 'config.json');
        this.config = this.loadConfig();
    }

    private loadConfig(): AppConfig {
        try {
            if (existsSync(this.configPath)) {
                const data = readFileSync(this.configPath, 'utf-8');
                const loaded = JSON.parse(data) as AppConfig;
                logger('Config loaded from:', this.configPath);
                return { ...DEFAULT_CONFIG, ...loaded };
            }
        } catch (err) {
            logger('Error loading config:', err);
        }
        logger('Using default config');
        return DEFAULT_CONFIG;
    }

    private saveConfig(): void {
        try {
            writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
            logger('Config saved to:', this.configPath);
        } catch (err) {
            logger('Error saving config:', err);
        }
    }

    public getGarminCredentials(): AppConfig['garminCredentials'] {
        return this.config.garminCredentials;
    }

    public setGarminCredentials(email: string, password: string): void {
        this.config.garminCredentials = { email, password };
        this.saveConfig();
        logger('Garmin credentials saved');
    }

    public clearGarminCredentials(): void {
        this.config.garminCredentials = undefined;
        this.saveConfig();
        logger('Garmin credentials cleared');
    }

    public getHRMDevice(): AppConfig['hrmDevice'] {
        return this.config.hrmDevice;
    }

    public setHRMDevice(id: string, name: string): void {
        this.config.hrmDevice = { id, name };
        this.saveConfig();
        logger(`HRM device saved: ${name} (${id})`);
    }

    public clearHRMDevice(): void {
        this.config.hrmDevice = undefined;
        this.saveConfig();
        logger('HRM device cleared');
    }

    public getWaterRowerPort(): string | undefined {
        return this.config.waterRowerPort;
    }

    public setWaterRowerPort(port: string): void {
        this.config.waterRowerPort = port;
        this.saveConfig();
        logger(`WaterRower port saved: ${port}`);
    }

    public clearWaterRowerPort(): void {
        this.config.waterRowerPort = undefined;
        this.saveConfig();
        logger('WaterRower port cleared');
    }

    public getPort(): number {
        return this.config.port;
    }

    public setPort(port: number): void {
        this.config.port = port;
        this.saveConfig();
        logger(`Port saved: ${port}`);
    }

    public getFitFilesDirectory(): string {
        return this.config.fitFilesDirectory;
    }

    public setFitFilesDirectory(directory: string): void {
        this.config.fitFilesDirectory = directory;
        this.saveConfig();
        logger(`FIT files directory saved: ${directory}`);
    }

    public getConfig(): AppConfig {
        return { ...this.config };
    }

    public getSSLConfig(): AppConfig['ssl'] {
        return this.config.ssl;
    }

    public setSSLConfig(enabled: boolean, keyPath?: string, certPath?: string, port?: number): void {
        this.config.ssl = {
            enabled,
            keyPath: keyPath || this.config.ssl?.keyPath || DEFAULT_CONFIG.ssl!.keyPath,
            certPath: certPath || this.config.ssl?.certPath || DEFAULT_CONFIG.ssl!.certPath,
            port: port || this.config.ssl?.port || DEFAULT_CONFIG.ssl!.port
        };
        this.saveConfig();
        logger(`SSL config updated: enabled=${enabled}`);
    }

    public getSessionMode(): SessionMode {
        return this.config.sessionMode ?? 'training';
    }

    public setSessionMode(mode: SessionMode): void {
        this.config.sessionMode = mode;
        this.saveConfig();
        logger(`Session mode set to: ${mode}`);
    }

    public getRecordingFile(): string | undefined {
        return this.config.recordingFile;
    }

    public setRecordingFile(filename: string): void {
        this.config.recordingFile = filename;
        this.saveConfig();
        logger(`Recording file set to: ${filename}`);
    }

    public clearAllConfig(): void {
        this.config = DEFAULT_CONFIG;
        this.saveConfig();
        logger('All config cleared');
    }
}
