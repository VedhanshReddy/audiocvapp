const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const path = require('path');
const log = require('electron-log');
const fs = require('fs');

// Get correct ffmpeg path for both dev and production
const getFfmpegPath = () => {
    if (process.env.NODE_ENV === 'development') {
        return ffmpegStatic;
    }
    
    // In production, look for unpacked ffmpeg
    const resourcePath = process.resourcesPath;
    const ffmpegPath = path.join(resourcePath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', 'ffmpeg');
    log.info('Production FFmpeg path:', ffmpegPath);
    
    if (!fs.existsSync(ffmpegPath)) {
        throw new Error(`FFmpeg not found at ${ffmpegPath}`);
    }
    
    // Make sure ffmpeg is executable
    fs.chmodSync(ffmpegPath, '755');
    return ffmpegPath;
};

// Set ffmpeg path
const ffmpegPath = getFfmpegPath();
log.info('Setting FFmpeg path:', ffmpegPath);
ffmpeg.setFfmpegPath(ffmpegPath);

class AudioProcessor {
    static process(inputPath, outputPath, progressCallback, errorCallback) {
        return new Promise((resolve, reject) => {
            log.info('Starting conversion:', { input: inputPath, output: outputPath });
            
            // Create temp file in the same directory as output
            const tempFile = path.join(path.dirname(outputPath), '_temp_' + Date.now() + '.mp3');
            
            ffmpeg(inputPath)
                .toFormat('mp3')
                .audioBitrate('320k')  // High quality MP3
                .audioChannels(2)      // Ensure stereo
                .audioFilters([
                    {
                        filter: 'pan',
                        options: 'stereo|c0=c0|c1=c0'
                    },
                    {
                        filter: 'apulsator',
                        options: {
                            hz: '0.08',
                            amount: '0.85'
                        }
                    }
                ])
                .on('start', (cmd) => {
                    log.info('FFmpeg command:', cmd);
                })
                .on('progress', (progress) => {
                    const percent = Math.round((progress.percent || 0) * 0.5);
                    progressCallback(percent, 'Applying 8D effect...', 'processing');
                })
                .on('error', (err) => {
                    log.error('FFmpeg error:', err);
                    // Cleanup temp file if exists
                    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                    errorCallback(err.message);
                    reject(err);
                })
                .on('end', () => {
                    // Apply reverb in second pass
                    ffmpeg(tempFile)
                        .toFormat('mp3')
                        .audioBitrate('320k')
                        .audioChannels(2)
                        .audioFilters([
                            {
                                filter: 'aecho',
                                options: {
                                    in_gain: 0.8,
                                    out_gain: 0.5,
                                    delays: '50|100',
                                    decays: '0.5|0.3'
                                }
                            }
                        ])
                        .on('progress', (progress) => {
                            const percent = 50 + Math.round((progress.percent || 0) * 0.5);
                            progressCallback(percent, 'Adding reverb...', 'processing');
                        })
                        .on('end', () => {
                            // Cleanup and finish
                            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                            progressCallback(100, 'Conversion Complete!', 'success');
                            resolve();
                        })
                        .on('error', (err) => {
                            log.error('Reverb error:', err);
                            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                            errorCallback(err.message);
                            reject(err);
                        })
                        .save(outputPath);
                })
                .save(tempFile);
        });
    }

    static checkFfmpeg() {
        try {
            const ffmpegPath = require('ffmpeg-static');
            return fs.existsSync(ffmpegPath);
        } catch (error) {
            return false;
        }
    }
}

module.exports = AudioProcessor;
