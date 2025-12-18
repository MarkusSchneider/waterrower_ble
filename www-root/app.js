const API_BASE = window.location.origin + '/api';
const socket = io();

let selectedHRM = null;
let hrmDevices = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkGarminStatus();
    setupSocketListeners();
    loadSessionMode();
});

// Toggle configuration menu
function toggleConfigMenu() {
    const menu = document.getElementById('configMenu');
    const overlay = document.getElementById('configOverlay');
    menu.classList.toggle('open');
    overlay.classList.toggle('show');

    // Load FIT files when menu opens
    if (menu.classList.contains('open')) {
        refreshFitFiles();
    }
}

// Setup real-time WebSocket listeners
function setupSocketListeners() {
    // Session updates - real-time
    socket.on('session:updated', (data) => {
        updateUI(data);
    });

    // Real-time datapoints during active session
    socket.on('session:datapoint', (dataPoint) => {
        if (dataPoint) {
            document.getElementById('timeValue').textContent = formatTime(dataPoint.elapsedTime);
            document.getElementById('distanceValue').textContent = Math.round(dataPoint.distance || 0);
            document.getElementById('strokeRateValue').textContent = Math.round(dataPoint.strokeRate || 0);
            // Convert speed from mm/s to km/h (mm/s * 3.6 / 1000)
            const speedKmh = (dataPoint.speed || 0) * 3.6 / 1000;
            document.getElementById('speedValue').textContent = speedKmh.toFixed(1);
            document.getElementById('powerValue').textContent = Math.round(dataPoint.power || 0);
            document.getElementById('heartRateValue').textContent = dataPoint.heartRate ? Math.round(dataPoint.heartRate) : '--';
            document.getElementById('caloriesValue').textContent = Math.round(dataPoint.calories || 0);
        }
    });

    // HRM status changes
    socket.on('hrm:updated', (data) => {
        updateHRMUI(data);
    });

    // WaterRower status changes
    socket.on('waterrower:updated', (data) => {
        updateWaterRowerUI(data);
    });

    // Garmin status changes
    socket.on('garmin:updated', (data) => {
        updateGarminStatusUI(data);
    });

    // Server shutdown notification
    socket.on('server:shutdown', () => {
        console.log('Server is shutting down');
        showDisconnectOverlay();
    });

    // Connection status
    socket.on('connect', () => {
        console.log('Connected to server');
        hideDisconnectOverlay();
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        // Give it a moment to see if it's just a reconnection
        setTimeout(() => {
            if (!socket.connected) {
                showDisconnectOverlay();
            }
        }, 2000);
    });

    // Reconnection events
    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        showDisconnectOverlay();
    });

    socket.on('reconnect', (attemptNumber) => {
        console.log('Reconnected after', attemptNumber, 'attempts');
        hideDisconnectOverlay();
    });

    socket.on('reconnect_failed', () => {
        console.error('Reconnection failed');
        showDisconnectOverlay();
    });
}

function showDisconnectOverlay() {
    const overlay = document.getElementById('disconnectOverlay');
    overlay.classList.add('show');
}

function hideDisconnectOverlay() {
    const overlay = document.getElementById('disconnectOverlay');
    overlay.classList.remove('show');
}

function updateUI(data) {
    const stateIndicator = document.getElementById('sessionState');
    stateIndicator.textContent = data.state.toUpperCase();
    stateIndicator.className = 'state-indicator state-' + data.state;

    const btnStart = document.getElementById('btnStart');
    const btnPause = document.getElementById('btnPause');
    const btnResume = document.getElementById('btnResume');
    const btnStop = document.getElementById('btnStop');

    // Reset all button states first
    btnPause.classList.remove('hidden');
    btnResume.classList.add('hidden');
    stateIndicator.classList.remove('recording');

    if (data.state === 'active') {
        btnStart.disabled = true;
        btnPause.disabled = false;
        btnStop.disabled = false;
        stateIndicator.classList.add('recording');
    } else if (data.state === 'paused') {
        btnStart.disabled = true;
        btnPause.classList.add('hidden');
        btnResume.classList.remove('hidden');
        btnStop.disabled = false;
    } else {
        // idle, finished, or any other state
        btnStart.disabled = false;
        btnPause.disabled = true;
        btnStop.disabled = true;
    }
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

async function startSession() {
    try {
        const response = await fetch(`${API_BASE}/session/start`, { method: 'POST' });
        const data = await response.json();

        if (response.ok && data.success) {
            showAlert('success', 'Training session started!');
        } else {
            showAlert('error', data.error || 'Failed to start session');
        }
    } catch (error) {
        console.error(error);
        showAlert('error', 'Error starting session: ' + error.message);
    }
}

async function stopSession() {
    try {
        const response = await fetch(`${API_BASE}/session/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ autoUpload: true })
        });
        const data = await response.json();

        if (data.success) {
            let message = 'Session saved! FIT file generated.';
            if (data.garminUpload && data.garminUpload.success) {
                message += ' Uploaded to Garmin Connect!';
            }
            showAlert('success', message);
        } else {
            showAlert('error', data.error || 'Failed to stop session');
        }
    } catch (error) {
        console.error(error);
        showAlert('error', 'Error stopping session: ' + error.message);
    }
}

async function pauseSession() {
    try {
        const response = await fetch(`${API_BASE}/session/pause`, { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            showAlert('success', 'Session paused');
        }
    } catch (error) {
        console.error(error);
        showAlert('error', 'Error pausing session: ' + error.message);
    }
}

async function resumeSession() {
    try {
        const response = await fetch(`${API_BASE}/session/resume`, { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            showAlert('success', 'Session resumed');
        }
    } catch (error) {
        console.error(error);
        showAlert('error', 'Error resuming session: ' + error.message);
    }
}

async function configureGarmin() {
    const email = document.getElementById('garminEmail').value;
    const password = document.getElementById('garminPassword').value;

    if (!email || !password) {
        showGarminAlert('error', 'Please enter both email and password');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/garmin/configure`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            showGarminAlert('success', 'Garmin Connect configured successfully!');
            document.getElementById('garminPassword').value = '';
            checkGarminStatus();
        } else {
            showGarminAlert('error', data.error || 'Configuration failed');
        }
    } catch (error) {
        console.error(error);
        showGarminAlert('error', 'Error: ' + error.message);
    }
}

async function checkGarminStatus() {
    try {
        const response = await fetch(`${API_BASE}/garmin/status`);
        const data = await response.json();

        const statusText = data.configured && data.authenticated ?
            '✅ Connected' :
            (data.configured ? '⚠️ Configured but not authenticated' : '❌ Not configured');

        document.getElementById('garminStatus').textContent = statusText;
        document.getElementById('garminEmail').value = data.email;
    } catch (error) {
        console.error('Error checking Garmin status:', error);
    }
}

function showAlert(type, message) {
    // Create temporary alert at top of first card
    const card = document.querySelector('.card');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    card.insertBefore(alert, card.firstChild);

    setTimeout(() => alert.remove(), 5000);
}

function showGarminAlert(type, message) {
    const alertDiv = document.getElementById('garminAlert');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    alertDiv.classList.remove('hidden');

    setTimeout(() => alertDiv.classList.add('hidden'), 5000);
}

function updateHRMUI(data) {
    const hrmStatus = document.getElementById('hrmStatus');
    const btnConnect = document.getElementById('btnConnectHRM');
    const btnDisconnect = document.getElementById('btnDisconnectHRM');
    const hrmStatusText = document.getElementById('hrmStatusText');
    const hrmBattery = document.getElementById('hrmBattery');

    if (data.connected) {
        hrmStatus.textContent = `Connected (${data.deviceName || 'HRM'})`;
        hrmStatus.className = 'state-indicator state-active';
        btnConnect.classList.add('hidden');
        btnDisconnect.classList.remove('hidden');
        hrmStatusText.textContent = 'Connected';
        hrmStatusText.className = 'state-indicator state-connected';

        // Update battery level
        if (data.batteryLevel !== null && data.batteryLevel !== undefined) {
            const batteryPercent = data.batteryLevel;
            let batteryColor = '#10b981'; // green
            let batteryIcon = '🔋';

            if (batteryPercent <= 20) {
                batteryColor = '#ef4444'; // red
                batteryIcon = '🪫';
            } else if (batteryPercent <= 40) {
                batteryColor = '#f59e0b'; // orange
            }

            hrmBattery.innerHTML = `<span style="color: ${batteryColor}; font-weight: 600;">${batteryIcon} ${batteryPercent}%</span>`;
            hrmBattery.hidden = false;
        } else {
            hrmBattery.hidden = true;
        }
    } else {
        hrmStatus.textContent = 'Disconnected';
        hrmStatus.className = 'state-indicator state-idle';
        btnConnect.classList.add('hidden');
        btnDisconnect.classList.add('hidden');
        hrmStatusText.textContent = 'Disconnected';
        hrmStatusText.className = 'state-indicator state-disconnected';
        hrmBattery.hidden = true;
    }
}

function updateWaterRowerUI(data) {
    const wrStatus = document.getElementById('wrStatus');
    const btnConnect = document.getElementById('btnConnectWR');
    const wrStatusText = document.getElementById('wrStatusText');

    if (data.connected) {
        wrStatus.textContent = 'Connected';
        wrStatus.className = 'state-indicator state-active';
        btnConnect.disabled = true;
        wrStatusText.textContent = 'Connected';
        wrStatusText.className = 'state-indicator state-connected';
    } else {
        wrStatus.textContent = 'Disconnected';
        wrStatus.className = 'state-indicator state-idle';
        btnConnect.disabled = false;
        wrStatusText.textContent = 'Disconnected';
        wrStatusText.className = 'state-indicator state-disconnected';
    }
}

function updateGarminStatusUI(data) {
    const statusText = data.configured && data.authenticated ?
        '✅ Connected' :
        (data.configured ? '⚠️ Configured but not authenticated' : '❌ Not configured');

    document.getElementById('garminStatus').textContent = statusText;

    // Restore email if configured
    if (data.email) {
        document.getElementById('garminEmail').value = data.email;
    } else {
        document.getElementById('garminEmail').value = '';
    }
}

async function discoverHRM() {
    try {
        const btnDiscover = document.getElementById('btnDiscoverHRM');
        btnDiscover.disabled = true;
        btnDiscover.textContent = 'Discovering...';
        const response = await fetch(`${API_BASE}/hrm/discover`);
        const data = await response.json();
        btnDiscover.disabled = false;
        btnDiscover.textContent = 'Discover Devices';

        if (data.length > 0) {
            selectedHRM = data[0].id;
            hrmDevices = data;
            const select = document.getElementById('hrmDeviceSelect');
            select.innerHTML = hrmDevices.map(d =>
                `<option value="${d.id}">${d.name || d.id}</option>`
            ).join('');
            select.style.display = '';
            document.getElementById('btnConnectHRM').classList.remove('hidden');
            showHRMAlert('success', `Found ${hrmDevices.length} device(s)`);
        } else {
            showHRMAlert('error', 'No HRM devices found.');
        }
    } catch (error) {
        console.error(error);
        showHRMAlert('error', 'Discovery error: ' + error.message);
        document.getElementById('btnDiscoverHRM').disabled = false;
        document.getElementById('btnDiscoverHRM').textContent = 'Discover Devices';
    }
}

function selectHRMDevice() {
    const select = document.getElementById('hrmDeviceSelect');
    selectedHRM = select.value;
}

async function connectHRM() {
    if (!selectedHRM) {
        showHRMAlert('error', 'Select a device first.');
        return;
    }
    try {
        const selectedDevice = hrmDevices.find(d => d.id === selectedHRM);
        const response = await fetch(`${API_BASE}/hrm/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceId: selectedHRM,
                deviceName: selectedDevice?.name || 'Unknown Device'
            })
        });
        const data = await response.json();
        if (data.success) {
            showHRMAlert('success', 'Connected to HRM!');
        } else {
            showHRMAlert('error', data.error || 'Failed to connect');
        }
    } catch (error) {
        console.error(error);
        showHRMAlert('error', 'Connection error: ' + error.message);
    }
}

async function disconnectHRM() {
    try {
        const response = await fetch(`${API_BASE}/hrm/disconnect`, { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            showHRMAlert('success', 'Disconnected from HRM');
        } else {
            showHRMAlert('error', data.error || 'Failed to disconnect');
        }
    } catch (error) {
        console.error(error);
        showHRMAlert('error', 'Error: ' + error.message);
    }
}

function showHRMAlert(type, message) {
    const alertDiv = document.getElementById('hrmAlert');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    alertDiv.classList.remove('hidden');
    setTimeout(() => alertDiv.classList.add('hidden'), 5000);
}

async function connectWR() {
    try {
        const btnConnect = document.getElementById('btnConnectWR');
        btnConnect.disabled = true;
        btnConnect.textContent = 'Connecting...';
        const response = await fetch(`${API_BASE}/waterrower/connect`, { method: 'POST' });
        const data = await response.json();
        btnConnect.disabled = false;
        btnConnect.textContent = 'Connect';
        if (data.success) {
            showWRAlert('success', 'Connected to WaterRower!');
        } else {
            showWRAlert('error', data.error || 'Failed to connect');
        }
    } catch (error) {
        console.error(error);
        showWRAlert('error', 'Connection error: ' + error.message);
        document.getElementById('btnConnectWR').disabled = false;
        document.getElementById('btnConnectWR').textContent = 'Connect';
    }
}

function showWRAlert(type, message) {
    const alertDiv = document.getElementById('wrAlert');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    alertDiv.classList.remove('hidden');
    setTimeout(() => alertDiv.classList.add('hidden'), 5000);
}

// FIT Files functions
async function refreshFitFiles() {
    try {
        const response = await fetch(`${API_BASE}/fit-files`);
        const data = await response.json();

        const listDiv = document.getElementById('fitFilesList');

        if (!data.files || data.files.length === 0) {
            listDiv.innerHTML = '<p style="text-align: center; color: #666;">No FIT files found</p>';
            return;
        }

        listDiv.innerHTML = data.files.map(file => {
            const date = new Date(file.created);
            const dateStr = date.toLocaleString();
            const sizeKB = (file.size / 1024).toFixed(1);

            return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #e5e7eb;">
                    <div style="flex: 1;">
                        <div style="font-weight: 500; color: #333;">${file.filename}</div>
                        <div style="font-size: 0.85em; color: #666;">${dateStr} • ${sizeKB} KB</div>
                    </div>
                    <button class="btn-secondary" onclick="downloadFitFile('${file.filename}')" style="flex:0; padding: 6px 12px; font-size: 0.9em; min-width: 50px;">
                        📥
                    </button>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading FIT files:', error);
        showFitFilesAlert('error', 'Failed to load FIT files: ' + error.message);
    }
}

function downloadFitFile(filename) {
    window.location.href = `${API_BASE}/fit-files/${filename}`;
}

function showFitFilesAlert(type, message) {
    const alertDiv = document.getElementById('fitFilesAlert');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    alertDiv.classList.remove('hidden');
    setTimeout(() => alertDiv.classList.add('hidden'), 5000);
}

// Session Mode functions
async function loadSessionMode() {
    try {
        const response = await fetch(`${API_BASE}/session/mode`);
        const data = await response.json();

        // Set the radio button for current mode
        const radios = document.getElementsByName('sessionMode');
        radios.forEach(radio => {
            if (radio.value === data.mode) {
                radio.checked = true;
            }
        });

        // Show/hide replay file selection based on mode
        updateReplayFileSelection(data.mode);

        // If in replay mode, load recordings
        if (data.mode === 'replay') {
            await refreshRecordings();
            // Set selected recording file if one is configured
            if (data.recordingFile) {
                const select = document.getElementById('recordingFileSelect');
                select.value = data.recordingFile;
            }
        }
    } catch (error) {
        console.error('Error loading session mode:', error);
    }
}

async function updateSessionMode() {
    const selectedMode = document.querySelector('input[name="sessionMode"]:checked').value;

    try {
        const body = { mode: selectedMode };

        // If replay mode, include the selected recording file
        if (selectedMode === 'replay') {
            const recordingFile = document.getElementById('recordingFileSelect')?.value;
            if (recordingFile) {
                body.recordingFile = recordingFile;
            }
        }

        const response = await fetch(`${API_BASE}/session/mode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (data.success) {
            showSessionModeAlert('success', `Session mode set to: ${selectedMode}`);
            updateReplayFileSelection(selectedMode);

            // Load recordings if switching to replay mode
            if (selectedMode === 'replay') {
                await refreshRecordings();
            }
        } else {
            showSessionModeAlert('error', data.error || 'Failed to update session mode');
        }
    } catch (error) {
        console.error('Error updating session mode:', error);
        showSessionModeAlert('error', 'Error updating session mode: ' + error.message);
    }
}

function updateReplayFileSelection(mode) {
    const replaySection = document.getElementById('replayFileSelection');
    if (mode === 'replay') {
        replaySection.classList.remove('hidden');
    } else {
        replaySection.classList.add('hidden');
    }
}

async function refreshRecordings() {
    try {
        const response = await fetch(`${API_BASE}/recordings`);
        const data = await response.json();

        const select = document.getElementById('recordingFileSelect');
        select.innerHTML = '<option value="">-- Choose a recording --</option>';

        if (data.recordings && data.recordings.length > 0) {
            data.recordings.forEach(recording => {
                const option = document.createElement('option');
                option.value = recording;
                option.textContent = recording;
                select.appendChild(option);
            });
        }

        showSessionModeAlert('success', `Found ${data.recordings?.length || 0} recordings`);
    } catch (error) {
        console.error('Error loading recordings:', error);
        showSessionModeAlert('error', 'Failed to load recordings: ' + error.message);
    }
}

async function updateRecordingFile() {
    const selectedFile = document.getElementById('recordingFileSelect').value;

    if (!selectedFile) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/session/mode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'replay', recordingFile: selectedFile })
        });

        const data = await response.json();

        if (data.success) {
            showSessionModeAlert('success', `Recording file set to: ${selectedFile}`);
        } else {
            showSessionModeAlert('error', data.error || 'Failed to set recording file');
        }
    } catch (error) {
        console.error('Error setting recording file:', error);
        showSessionModeAlert('error', 'Error: ' + error.message);
    }
}

function showSessionModeAlert(type, message) {
    const alertDiv = document.getElementById('sessionModeAlert');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    alertDiv.classList.remove('hidden');
    setTimeout(() => alertDiv.classList.add('hidden'), 5000);
}
