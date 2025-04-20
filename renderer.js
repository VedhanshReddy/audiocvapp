const { ipcRenderer } = require('electron');
const AudioProcessor = require('./audioProcessor');
const { exec, spawn } = require('child_process');
const path = require('path');

// Elements
const convertBtn = document.getElementById('convertBtn');
const status = document.getElementById('status');
const progressBar = document.getElementById('progressBar');

// Variables to store file paths
let inputFile = '';
let outputFolder = '';
let startTime = 0;
let conversionStartTime = 0;

// Function to open file selection dialog
async function selectFile() {
  const filePaths = await ipcRenderer.invoke('dialog:openFile');
  if (filePaths.length > 0) {
    inputFile = filePaths[0];
    const fileName = path.basename(inputFile);
    const fileInfo = document.getElementById('fileInfo');
    fileInfo.style.display = 'block';
    fileInfo.textContent = `Selected: ${fileName}`;
  }
}

// Function to open output folder selection dialog
async function selectFolder() {
  const folderPaths = await ipcRenderer.invoke('dialog:openFolder');
  if (folderPaths.length > 0) {
    outputFolder = folderPaths[0]; // Save folder path
    document.getElementById('outputFolder').value = outputFolder;
  }
}

// Handle file selection
document.getElementById('fileSelectBtn').addEventListener('click', selectFile);

// Handle output folder selection
document.getElementById('folderSelectBtn').addEventListener('click', selectFolder);

// Update progress display
function updateProgress(progress, stage) {
    requestAnimationFrame(() => {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        const status = document.getElementById('status');
        const timeRemaining = document.getElementById('timeRemaining');
        
        progressBar.style.width = `${progress}%`;
        progressText.textContent = ` (${progress}%)`;
        status.textContent = getDetailedStatus(stage, progress);
        
        if (progress > 0 && progress < 100) {
            const elapsedSeconds = (Date.now() - conversionStartTime) / 1000;
            const estimatedTotalSeconds = (elapsedSeconds / progress) * 100;
            const remainingSeconds = Math.round(estimatedTotalSeconds - elapsedSeconds);
            timeRemaining.textContent = `Estimated time remaining: ${remainingSeconds} seconds`;
        } else if (progress === 100) {
            timeRemaining.textContent = `Completed in ${Math.round((Date.now() - conversionStartTime) / 1000)} seconds`;
            progressBar.style.width = '100%';
            progressText.textContent = '100%';
        }
    });
}

function getDetailedStatus(stage, progress) {
    const stageDetails = {
        'Loading...': 'Analyzing audio file and preparing for conversion',
        'Applying 8D effect...': 'Creating spatial audio effect and applying panning',
        'Converting...': 'Processing audio with enhanced stereo separation',
        'Adding effects...': 'Applying final audio effects and reverb',
        'Finishing...': 'Finalizing output file'
    };

    return stageDetails[stage] || stage;
}

// Handle conversion when button is clicked
document.getElementById('convertBtn').addEventListener('click', async () => {
    const status = document.getElementById('status');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const timeRemaining = document.getElementById('timeRemaining');
    const convertBtn = document.getElementById('convertBtn');
    
    if (!inputFile || !outputFolder) {
        status.textContent = 'Please select input file and output folder';
        return;
    }

    try {
        // Reset UI state first
        convertBtn.disabled = true;
        status.className = 'status-text';
        status.textContent = 'Initializing conversion...';
        progressBar.style.width = '0%';
        timeRemaining.textContent = 'Calculating...';
        
        // Small delay to ensure UI updates are visible
        await new Promise(resolve => setTimeout(resolve, 100));
        
        conversionStartTime = Date.now();
        const originalName = path.basename(inputFile, path.extname(inputFile));
        const outputPath = path.join(outputFolder, `${originalName}-8d${path.extname(inputFile)}`);
        
        // Start conversion
        await AudioProcessor.process(
            inputFile, 
            outputPath,
            updateProgress,
            (error) => {
                status.textContent = error;
                status.classList.add('error');
                progressBar.style.width = '0%';
                timeRemaining.textContent = '';
            }
        );

        // Update completion state
        const totalTime = Math.round((Date.now() - conversionStartTime) / 1000);
        status.textContent = 'Conversion Complete!';
        status.classList.add('success');
        timeRemaining.textContent = `Completed in ${totalTime} seconds`;
        progressBar.style.width = '100%';
        progressText.textContent = '100%';

    } catch (error) {
        console.error('Conversion error:', error);
        status.textContent = error.message || 'Unknown error occurred';
        status.classList.add('error');
        timeRemaining.textContent = '';
        progressBar.style.width = '0%';
    } finally {
        convertBtn.disabled = false;
    }
});
