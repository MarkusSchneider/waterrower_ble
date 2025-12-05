import cors from 'cors';
import debug from 'debug';
import express, {
    Request,
    Response,
} from 'express';
import { createServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { readdirSync, statSync, readFileSync, existsSync } from 'fs';

import { HeartRateMonitor } from '../ble/heart-rate-monitor';
import { FitFileGenerator } from '../fit/fit-file-generator';
import {
    GarminUploader,
} from '../garmin/garmin-uploader';
import {
    SessionState,
    TrainingSession,
} from '../training/training-session';
import { WaterRower } from '../waterrower-serial/waterrower-serial';
import { ConfigManager } from '../helper/config-manager';

const logger = debug('WEB_SERVER');

export interface WebServerOptions {
    waterRower: WaterRower;
    heartRateMonitor: HeartRateMonitor;
    configManager: ConfigManager;
}

export class WebServer {
    private app: express.Application;
    private httpServer: any;
    private httpsServer: any;
    private io: SocketIOServer;
    private waterRower: WaterRower;
    private heartRateMonitor: HeartRateMonitor;
    private currentSession: TrainingSession | null;
    private fitGenerator: FitFileGenerator;
    private garminUploader: GarminUploader;
    private configManager: ConfigManager;

    constructor(private options: WebServerOptions) {
        this.app = express();
        this.httpServer = createServer(this.app);

        // Try to create HTTPS server if SSL is enabled and certificates exist
        const sslConfig = this.configManager.getSSLConfig();
        if (sslConfig?.enabled && this.checkSSLCertificates(sslConfig)) {
            try {
                const httpsOptions = {
                    key: readFileSync(sslConfig.keyPath),
                    cert: readFileSync(sslConfig.certPath)
                };
                this.httpsServer = createHttpsServer(httpsOptions, this.app);
                logger('HTTPS server initialized');
            } catch (error) {
                logger('Failed to create HTTPS server:', error);
                this.httpsServer = null;
            }
        }

        // Initialize Socket.IO on HTTPS if available, otherwise HTTP
        this.io = new SocketIOServer(this.httpsServer || this.httpServer, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST']
            }
        });
        this.waterRower = options.waterRower;
        this.heartRateMonitor = options.heartRateMonitor;
        this.configManager = options.configManager;
        this.currentSession = null;
        this.garminUploader = new GarminUploader();
        this.fitGenerator = new FitFileGenerator(options.configManager);

        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketIO();
        this.setupDeviceEventListeners();
    }

    private setupSessionEventListeners(session: TrainingSession): void {
        // Subscribe to session lifecycle events
        session.on('started', () => {
            logger('Session started event received');
            this.emitSessionStatus();
        });

        session.on('paused', () => {
            logger('Session paused event received');
            this.emitSessionStatus();
        });

        session.on('resumed', () => {
            logger('Session resumed event received');
            this.emitSessionStatus();
        });

        session.on('stopped', () => {
            logger('Session stopped event received');
            this.emitSessionStatus();
        });

        session.on('datapoint', (dataPoint) => {
            // Emit real-time datapoint via WebSocket
            this.io.emit('session:datapoint', dataPoint);
            // Also emit updated summary
            this.emitSessionStatus();
        });

        session.on('error', (error) => {
            logger('Session error:', error);
            this.io.emit('session:error', { error: error.message });
        });
    }

    private setupDeviceEventListeners(): void {
        // Listen to WaterRower lifecycle events
        this.waterRower.on('initialized', () => {
            logger('WaterRower initialized');
            this.emitWaterRowerStatus();
        });

        this.waterRower.on('close', () => {
            logger('WaterRower connection closed');
            this.emitWaterRowerStatus();
            // If there's an active session, stop it
            if (this.currentSession && this.currentSession.getState() === SessionState.ACTIVE) {
                logger('Stopping session due to WaterRower disconnection');
                this.currentSession.stop();
            }
        });

        this.waterRower.on('error', (error) => {
            logger('WaterRower error:', error);
            this.io.emit('waterrower:error', { error: error.message });
            this.emitWaterRowerStatus();
        });

        // Listen to HeartRateMonitor lifecycle events
        this.heartRateMonitor.on('ready', () => {
            logger('HeartRateMonitor ready');
        });

        this.heartRateMonitor.on('connected', () => {
            logger('HeartRateMonitor connected');
            this.emitHRMStatus();
        });

        this.heartRateMonitor.on('disconnected', () => {
            logger('HeartRateMonitor disconnected');
            this.emitHRMStatus();
        });

        this.heartRateMonitor.on('error', (error) => {
            logger('HeartRateMonitor error:', error);
            this.io.emit('hrm:error', { error: error.message });
            this.emitHRMStatus();
        });
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
        // Start training session
        this.app.post('/api/session/start', async (req, res) => { await this.handleStartSession(req, res); });

        // Stop training session
        this.app.post('/api/session/stop', async (req, res) => { await this.handleStopSession(req, res); });

        // Pause training session
        this.app.post('/api/session/pause', (req, res) => { this.handlePauseSession(req, res); });

        // Resume training session
        this.app.post('/api/session/resume', (req, res) => { this.handleResumeSession(req, res); });

        // Configure Garmin credentials
        this.app.post('/api/garmin/configure', async (req, res) => { await this.handleConfigureGarmin(req, res); });

        // Check Garmin status
        this.app.get('/api/garmin/status', (req, res) => {
            res.json({
                configured: !!this.configManager.getGarminCredentials(),
                authenticated: this.garminUploader.isLoggedIn()
            });
        });

        // FIT file endpoints
        this.app.get('/api/fit-files', (req, res) => { this.handleListFitFiles(req, res); });
        this.app.get('/api/fit-files/:filename', (req, res) => { this.handleDownloadFitFile(req, res); });

        // Heart Rate Monitor (HRM) endpoints used by the web UI - delegate to handlers
        this.app.get('/api/hrm/discover', (req, res) => { this.handleDiscoverHRM(req, res); });
        this.app.post('/api/hrm/connect', (req, res) => { this.handleConnectHRM(req, res); });
        this.app.post('/api/hrm/disconnect', (req, res) => { this.handleDisconnectHRM(req, res); });

        // WaterRower connection endpoints used by the web UI - delegate to handlers
        this.app.post('/api/waterrower/connect', (req, res) => { this.handleConnectWaterRower(req, res); });

        // Serve the web UI
        this.app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
    }

    private setupSocketIO(): void {
        this.io.on('connection', (socket) => {
            logger(`Client connected: ${socket.id}`);

            // Send initial status on connection
            this.emitSessionStatus();
            this.emitHRMStatus();
            this.emitWaterRowerStatus();
            this.emitGarminStatus();

            socket.on('disconnect', () => {
                logger(`Client disconnected: ${socket.id}`);
            });
        });
    }

    private emitSessionStatus(): void {
        if (!this.currentSession) {
            this.io.emit('session:updated', {
                state: SessionState.IDLE,
                session: null
            });
            return;
        }

        const summary = this.currentSession.getSummary();
        this.io.emit('session:updated', {
            state: this.currentSession.getState(),
            session: summary
        });
    }

    private emitHRMStatus(): void {
        try {
            const connected = this.heartRateMonitor.isConnected();
            const deviceName = this.heartRateMonitor.getDeviceName();
            this.io.emit('hrm:updated', { connected, deviceName });
        } catch (error: any) {
            logger('Error emitting HRM status:', error);
        }
    }

    private emitWaterRowerStatus(): void {
        try {
            const connected = this.waterRower.isConnected();
            const deviceName = 'Waterrower';
            this.io.emit('waterrower:updated', { connected, deviceName });
        } catch (error: any) {
            logger('Error emitting WaterRower status:', error);
        }
    }

    private emitGarminStatus(): void {
        this.io.emit('garmin:updated', {
            configured: !!this.configManager.getGarminCredentials(),
            authenticated: this.garminUploader.isLoggedIn()
        });
    }

    private async handleStartSession(req: Request, res: Response): Promise<void> {
        try {
            // Check if WaterRower is connected (required)
            if (!this.waterRower.isConnected()) {
                res.status(400).json({
                    error: 'WaterRower is not connected. Please connect the WaterRower before starting a training session.'
                });
                return;
            }

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

            // Setup event listeners for the new session
            this.setupSessionEventListeners(this.currentSession);

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
            const fitFilePath = this.fitGenerator.generateFitFile(
                summary,
                dataPoints,
            );

            const response = {
                success: true,
                summary,
                dataPoints: dataPoints.length
            };

            // Auto-upload to Garmin if configured
            const garminCredentials = this.configManager.getGarminCredentials();
            if (garminCredentials && req.body.autoUpload !== false) {
                try {
                    if (!this.garminUploader.isLoggedIn()) {
                        await this.garminUploader.login(garminCredentials);
                    }

                    const uploadResult = await this.garminUploader.uploadActivity(fitFilePath);

                } catch (error: any) {
                    logger('Auto-upload to Garmin failed:', error);
                    response.success = false;
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

    private async handleConfigureGarmin(req: Request, res: Response): Promise<void> {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                res.status(400).json({ error: 'Email and password are required' });
                return;
            }

            const garminCredentials = { email, password };

            // Save to config
            this.configManager.setGarminCredentials(email, password);

            // Test login
            await this.garminUploader.login(garminCredentials);

            this.emitGarminStatus();
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
            const { deviceId, deviceName } = req.body || {};
            if (!deviceId) {
                res.status(400).json({ success: false, error: 'deviceId required' });
                return;
            }

            await this.heartRateMonitor.connect(deviceId);

            // Save device selection to config
            const name = deviceName || 'Unknown Device';
            this.configManager.setHRMDevice(deviceId, name);
            logger(`HRM device saved to config: ${name}`);

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

    private async handleConnectWaterRower(req: Request, res: Response): Promise<void> {
        try {
            this.waterRower.connectSerial();
            const success = this.waterRower.isConnected();

            // Save the port to config if connected
            if (success) {
                const port = this.waterRower.getPortName();
                if (port) {
                    this.configManager.setWaterRowerPort(port);
                    logger(`WaterRower port saved to config: ${port}`);
                }
            }

            res.json({ success });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message || 'Failed to connect' });
        }
    }

    private handleListFitFiles(req: Request, res: Response): void {
        try {
            const fitFilesDir = this.configManager.getFitFilesDirectory();
            const files = readdirSync(fitFilesDir)
                .filter(file => file.endsWith('.fit'))
                .map(file => {
                    const filePath = path.join(fitFilesDir, file);
                    const stats = statSync(filePath);
                    return {
                        filename: file,
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime
                    };
                })
                .sort((a, b) => b.created.getTime() - a.created.getTime()); // Newest first

            res.json({ files });
        } catch (error: any) {
            logger('Error listing FIT files:', error);
            res.status(500).json({ error: error.message || 'Failed to list FIT files' });
        }
    }

    private handleDownloadFitFile(req: Request, res: Response): void {
        try {
            const { filename } = req.params;

            // Validate filename to prevent directory traversal
            if (!filename || filename.includes('..') || !filename.endsWith('.fit')) {
                res.status(400).json({ error: 'Invalid filename' });
                return;
            }

            const fitFilesDir = this.configManager.getFitFilesDirectory();
            const filePath = path.join(fitFilesDir, filename);

            // Send file for download
            res.download(filePath, filename, (err) => {
                if (err) {
                    logger('Error downloading FIT file:', err);
                    if (!res.headersSent) {
                        res.status(404).json({ error: 'File not found' });
                    }
                }
            });
        } catch (error: any) {
            logger('Error downloading FIT file:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: error.message || 'Failed to download FIT file' });
            }
        }
    }

    private checkSSLCertificates(sslConfig: { keyPath: string; certPath: string }): boolean {
        try {
            return existsSync(sslConfig.keyPath) && existsSync(sslConfig.certPath);
        } catch {
            return false;
        }
    }

    public start(): void {
        const port = this.configManager.getPort();
        const sslConfig = this.configManager.getSSLConfig();

        // Start HTTP server
        this.httpServer.listen(port, () => {
            logger(`HTTP server running on http://localhost:${port}`);
            console.log(`\n🚣 WaterRower Training Server`);
            console.log(`📡 Web interface: http://localhost:${port}`);
            console.log(`🔌 API endpoint: http://localhost:${port}/api`);
        });

        // Start HTTPS server if available
        if (this.httpsServer && sslConfig?.enabled) {
            const httpsPort = sslConfig.port;
            this.httpsServer.listen(httpsPort, () => {
                logger(`HTTPS server running on https://localhost:${httpsPort}`);
                console.log(`🔒 Secure interface: https://localhost:${httpsPort}`);
                console.log(`🔐 Secure API endpoint: https://localhost:${httpsPort}/api\n`);
            });
        } else {
            console.log(``);
        }
    }

    public shutdown(): Promise<void> {
        return new Promise((resolve) => {
            logger('Shutting down web server...');

            // Notify all connected clients about shutdown
            this.io.emit('server:shutdown', {
                message: 'Server is shutting down',
                timestamp: new Date().toISOString()
            });

            // Give clients time to receive the shutdown message
            setTimeout(() => {
                // Close all socket connections
                this.io.close(() => {
                    logger('Socket.IO server closed');
                });

                // Close HTTP server
                this.httpServer.close(() => {
                    logger('HTTP server closed');
                });

                // Close HTTPS server if running
                if (this.httpsServer) {
                    this.httpsServer.close(() => {
                        logger('HTTPS server closed');
                    });
                }

                resolve();
            }, 500);
        });
    }
}
