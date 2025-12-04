import cors from 'cors';
import debug from 'debug';
import express, {
    Request,
    Response,
} from 'express';
import {
    existsSync,
    mkdirSync,
} from 'fs';
import path from 'path';

import { HeartRateMonitor } from '../ble/heart-rate-monitor';
import { FitFileGenerator } from '../fit/fit-file-generator';
import {
    GarminCredentials,
    GarminUploader,
} from '../garmin/garmin-uploader';
import {
    SessionState,
    TrainingSession,
} from '../training/training-session';
import { WaterRower } from '../waterrower-serial/waterrower-serial';

const logger = debug('WEB_SERVER');

export interface WebServerOptions {
    port: number;
    waterRower: WaterRower;
    heartRateMonitor: HeartRateMonitor;
    garminCredentials: GarminCredentials;
    fitFilesDirectory: string;
}

export class WebServer {
    private app: express.Application;
    private waterRower: WaterRower;
    private heartRateMonitor: HeartRateMonitor;
    private currentSession: TrainingSession | null;
    private fitGenerator: FitFileGenerator;
    private garminUploader: GarminUploader;
    private garminCredentials?: GarminCredentials;
    private fitFilesDirectory: string;
    private sessionHistory: any[] = [];

    constructor(private options: WebServerOptions) {
        this.app = express();
        this.waterRower = options.waterRower;
        this.heartRateMonitor = options.heartRateMonitor;
        this.garminCredentials = options.garminCredentials;
        this.fitFilesDirectory = options.fitFilesDirectory;
        this.currentSession = null;
        this.fitGenerator = new FitFileGenerator();
        this.garminUploader = new GarminUploader();

        // Ensure FIT files directory exists
        if (!existsSync(this.fitFilesDirectory)) {
            mkdirSync(this.fitFilesDirectory, { recursive: true });
        }

        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware(): void {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, 'public')));

        // Request logging
        this.app.use((req, res, next) => {
            logger(`${req.method} ${req.path}`);
            next();
        });
    }

    private setupRoutes(): void {
        // Health check
        this.app.get('/api/health', (req, res) => { res.json({ status: 'ok', timestamp: new Date() }); });

        // Get current session status
        this.app.get('/api/session/status', (req, res) => { this.handleGetStatus(req, res); });

        // Start training session
        this.app.post('/api/session/start', async (req, res) => { await this.handleStartSession(req, res); });

        // Stop training session
        this.app.post('/api/session/stop', async (req, res) => { await this.handleStopSession(req, res); });

        // Pause training session
        this.app.post('/api/session/pause', (req, res) => { this.handlePauseSession(req, res); });

        // Resume training session
        this.app.post('/api/session/resume', (req, res) => { this.handleResumeSession(req, res); });

        // Get current session data
        this.app.get('/api/session/data', (req, res) => { this.handleGetSessionData(req, res); });

        // Get session history
        this.app.get('/api/sessions', (req, res) => { res.json({ sessions: this.sessionHistory }); });

        // Configure Garmin credentials
        this.app.post('/api/garmin/configure', async (req, res) => { await this.handleConfigureGarmin(req, res); });

        // Upload to Garmin
        this.app.post('/api/garmin/upload/:sessionId', async (req, res) => { await this.handleUploadToGarmin(req, res); });

        // Check Garmin status
        this.app.get('/api/garmin/status', (req, res) => { res.json({ configured: !!this.garminCredentials, authenticated: this.garminUploader.isLoggedIn() }); });

        // Heart Rate Monitor (HRM) endpoints used by the web UI - delegate to handlers
        this.app.get('/api/hrm/status', (req, res) => { this.handleGetHRMStatus(req, res); });
        this.app.get('/api/hrm/discover', (req, res) => { this.handleDiscoverHRM(req, res); });
        this.app.post('/api/hrm/connect', (req, res) => { this.handleConnectHRM(req, res); });
        this.app.post('/api/hrm/disconnect', (req, res) => { this.handleDisconnectHRM(req, res); });

        // WaterRower connection endpoints used by the web UI - delegate to handlers
        this.app.get('/api/waterrower/status', (req, res) => { this.handleGetWaterRowerStatus(req, res); });
        this.app.post('/api/waterrower/connect', (req, res) => { this.handleConnectWaterRower(req, res); });
        this.app.post('/api/waterrower/disconnect', (req, res) => { this.handleDisconnectWaterRower(req, res); });

        // Serve the web UI
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });
    }

    private handleGetStatus(req: Request, res: Response): void {
        if (!this.currentSession) {
            res.json({
                state: SessionState.IDLE,
                session: null
            });
            return;
        }

        const summary = this.currentSession.getSummary();
        res.json({
            state: this.currentSession.getState(),
            session: summary
        });
    }

    private async handleStartSession(req: Request, res: Response): Promise<void> {
        try {
            if (this.currentSession && this.currentSession.getState() !== SessionState.FINISHED) {
                res.status(400).json({
                    error: 'A session is already active. Please stop it first.'
                });
                return;
            }

            logger('Starting new training session...');
            this.currentSession = new TrainingSession(
                this.waterRower,
                this.heartRateMonitor
            );

            // Setup event handlers
            this.currentSession.on('started', (data) => {
                logger('Session started:', data);
            });

            this.currentSession.on('datapoint', (dataPoint) => {
                // Could emit this via WebSocket for real-time updates
                logger('New datapoint:', dataPoint);
            });

            await this.currentSession.start();

            res.json({
                success: true,
                sessionId: this.currentSession.getSessionId(),
                message: 'Training session started'
            });
        } catch (error: any) {
            logger('Error starting session:', error);
            res.status(500).json({
                error: error.message || 'Failed to start session'
            });
        }
    }

    private async handleStopSession(req: Request, res: Response): Promise<void> {
        try {
            if (!this.currentSession) {
                res.status(400).json({ error: 'No active session' });
                return;
            }

            logger('Stopping training session...');
            const dataPoints = this.currentSession.stop();
            const summary = this.currentSession.getSummary();

            // Generate FIT file
            const fitFilePath = path.join(
                this.fitFilesDirectory,
                `${summary.id}.fit`
            );

            const fitBuffer = this.fitGenerator.generateFitFile(
                summary,
                dataPoints,
                { outputPath: fitFilePath }
            );

            // Store session in history
            this.sessionHistory.push({
                ...summary,
                fitFilePath,
                uploadedToGarmin: false
            });

            const response: any = {
                success: true,
                summary,
                fitFile: fitFilePath,
                dataPoints: dataPoints.length
            };

            // Auto-upload to Garmin if configured
            if (this.garminCredentials && req.body.autoUpload !== false) {
                try {
                    if (!this.garminUploader.isLoggedIn()) {
                        await this.garminUploader.login(this.garminCredentials);
                    }

                    const uploadResult = await this.garminUploader.uploadActivityFromBuffer(
                        fitBuffer,
                        `WaterRower - ${summary.distance}m`
                    );

                    response.garminUpload = uploadResult;

                    if (uploadResult.success) {
                        // Update history
                        const historyEntry = this.sessionHistory[this.sessionHistory.length - 1];
                        historyEntry.uploadedToGarmin = true;
                        historyEntry.garminActivityId = uploadResult.activityId;
                    }
                } catch (error: any) {
                    logger('Auto-upload to Garmin failed:', error);
                    response.garminUpload = {
                        success: false,
                        error: error.message
                    };
                }
            }

            res.json(response);
        } catch (error: any) {
            logger('Error stopping session:', error);
            res.status(500).json({
                error: error.message || 'Failed to stop session'
            });
        }
    }

    private handlePauseSession(req: Request, res: Response): void {
        try {
            if (!this.currentSession) {
                res.status(400).json({ error: 'No active session' });
                return;
            }

            this.currentSession.pause();
            res.json({ success: true, message: 'Session paused' });
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    private handleResumeSession(req: Request, res: Response): void {
        try {
            if (!this.currentSession) {
                res.status(400).json({ error: 'No active session' });
                return;
            }

            this.currentSession.resume();
            res.json({ success: true, message: 'Session resumed' });
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    private handleGetSessionData(req: Request, res: Response): void {
        if (!this.currentSession) {
            res.status(400).json({ error: 'No active session' });
            return;
        }

        const dataPoints = this.currentSession.getDataPoints();
        const summary = this.currentSession.getSummary();

        res.json({
            summary,
            dataPoints,
            state: this.currentSession.getState()
        });
    }

    private async handleConfigureGarmin(req: Request, res: Response): Promise<void> {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                res.status(400).json({ error: 'Email and password are required' });
                return;
            }

            this.garminCredentials = { email, password };

            // Test login
            await this.garminUploader.login(this.garminCredentials);

            res.json({
                success: true,
                message: 'Garmin Connect configured and authenticated'
            });
        } catch (error: any) {
            logger('Garmin configuration error:', error);
            res.status(500).json({
                error: error.message || 'Failed to configure Garmin Connect'
            });
        }
    }

    private async handleUploadToGarmin(req: Request, res: Response): Promise<void> {
        try {
            const { sessionId } = req.params;

            if (!this.garminCredentials) {
                res.status(400).json({
                    error: 'Garmin Connect not configured. Please configure credentials first.'
                });
                return;
            }

            const session = this.sessionHistory.find(s => s.id === sessionId);
            if (!session) {
                res.status(404).json({ error: 'Session not found' });
                return;
            }

            if (!this.garminUploader.isLoggedIn()) {
                await this.garminUploader.login(this.garminCredentials);
            }

            const uploadResult = await this.garminUploader.uploadActivity(session.fitFilePath);

            if (uploadResult.success) {
                session.uploadedToGarmin = true;
                session.garminActivityId = uploadResult.activityId;
            }

            res.json(uploadResult);
        } catch (error: any) {
            logger('Upload error:', error);
            res.status(500).json({
                error: error.message || 'Failed to upload to Garmin'
            });
        }
    }

    private handleGetHRMStatus(req: Request, res: Response): void {
        try {
            const connected = this.heartRateMonitor?.isConnected?.() ?? false;
            const deviceName = (this.heartRateMonitor && typeof (this.heartRateMonitor as any).getDeviceName === 'function')
                ? (this.heartRateMonitor as any).getDeviceName()
                : undefined;
            res.json({ connected, deviceName });
        } catch (error: any) {
            res.status(500).json({ error: error.message || 'Failed to get HRM status' });
        }
    }

    private async handleDiscoverHRM(req: Request, res: Response): Promise<void> {
        try {
            const devices = await this.heartRateMonitor.discover();
            res.status(200).json(devices);
        } catch (error) {
            console.error('Error discovering HRM devices:', error);
            res.status(500).json({ message: 'Error discovering HRM devices' });
        }
    }

    private async handleConnectHRM(req: Request, res: Response): Promise<void> {
        try {
            const { deviceId } = req.body || {};
            if (!deviceId) {
                res.status(400).json({ success: false, error: 'deviceId required' });
                return;
            }

            await this.heartRateMonitor.connect(deviceId);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message || 'Failed to connect' });
        }
    }

    private handleDisconnectHRM(req: Request, res: Response): void {
        try {
            this.heartRateMonitor.disconnect();
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message || 'Failed to disconnect' });
        }
    }

    private handleGetWaterRowerStatus(req: Request, res: Response): void {
        try {
            const connected = this.waterRower?.isConnected?.() ?? false;
            const deviceName = (this.waterRower && typeof (this.waterRower as any).getDeviceName === 'function')
                ? (this.waterRower as any).getDeviceName()
                : undefined;
            res.json({ connected, deviceName });
        } catch (error: any) {
            res.status(500).json({ error: error.message || 'Failed to get WaterRower status' });
        }
    }

    private async handleConnectWaterRower(req: Request, res: Response): Promise<void> {
        try {
            if (this.waterRower && typeof (this.waterRower as any).connectSerial === 'function') {
                await (this.waterRower as any).connectSerial();
                res.json({ success: this.waterRower.isConnected ? this.waterRower.isConnected() : true });
            } else if (this.waterRower && typeof (this.waterRower as any).connect === 'function') {
                await (this.waterRower as any).connect();
                res.json({ success: this.waterRower.isConnected ? this.waterRower.isConnected() : true });
            } else {
                res.status(500).json({ success: false, error: 'WaterRower not available' });
            }
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message || 'Failed to connect' });
        }
    }

    private handleDisconnectWaterRower(req: Request, res: Response): void {
        try {
            if (this.waterRower && typeof (this.waterRower as any).disconnect === 'function') {
                (this.waterRower as any).disconnect();
                res.json({ success: true });
            } else {
                res.status(500).json({ success: false, error: 'WaterRower not available' });
            }
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message || 'Failed to disconnect' });
        }
    }

    public start(): void {
        this.app.listen(this.options.port, () => {
            logger(`Web server running on http://localhost:${this.options.port}`);
            console.log(`\n🚣 WaterRower Training Server`);
            console.log(`📡 Web interface: http://localhost:${this.options.port}`);
            console.log(`🔌 API endpoint: http://localhost:${this.options.port}/api`);
            console.log(`\n`);
        });
    }
}
