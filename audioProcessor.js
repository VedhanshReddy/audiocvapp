const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const path = require("path");
const log = require("electron-log");
const fs = require("fs");

// Get correct ffmpeg path for both dev and production
const getFfmpegPath = () => {
  if (process.env.NODE_ENV === "development") {
    return ffmpegStatic;
  }

  // In production, look for unpacked ffmpeg
  const resourcePath = process.resourcesPath;
  const ffmpegPath = path.join(
    resourcePath,
    "app.asar.unpacked",
    "node_modules",
    "ffmpeg-static",
    "ffmpeg",
  );
  log.info("Production FFmpeg path:", ffmpegPath);

  if (!fs.existsSync(ffmpegPath)) {
    throw new Error(`FFmpeg not found at ${ffmpegPath}`);
  }

  // Make sure ffmpeg is executable
  fs.chmodSync(ffmpegPath, "755");
  return ffmpegPath;
};

// Set ffmpeg path
const ffmpegPath = getFfmpegPath();
log.info("Setting FFmpeg path:", ffmpegPath);
ffmpeg.setFfmpegPath(ffmpegPath);

const effectConfigs = {
  '8d': {
    name: '8D Audio',
    filters: [
      {
        filter: "volume",
        options: "1.8"
      },
      {
        filter: "pan",
        options: "stereo|c0=c0|c1=c0"
      },
      {
        filter: "apulsator",
        options: {
          hz: "0.08",
          amount: "0.85"
        }
      }
    ],
    secondPass: [
      {
        filter: "aecho",
        options: {
          in_gain: 0.8,
          out_gain: 0.5,
          delays: "50|100",
          decays: "0.5|0.3"
        }
      }
    ]
  },
  'bass': {
    name: 'Bass Boost',
    filters: [
      {
        filter: "volume",
        options: "1.5"
      },
      {
        filter: "equalizer",
        options: {
          frequency: "50",
          width_type: "q",
          width: "2",
          gain: "10"
        }
      },
      {
        filter: "equalizer",
        options: {
          frequency: "100",
          width_type: "q",
          width: "1.5",
          gain: "10.4"
        }
      }
    ]
  },
  'club': {
    name: 'Club Effect',
    filters: [
      // EQ filters first
      {
        filter: "equalizer",
        options: {
          frequency: "50",
          width_type: "q",
          width: "2",
          gain: "10"
        }
      },
      {
        filter: "equalizer",
        options: {
          frequency: "100",
          width_type: "q",
          width: "1.5",
          gain: "10.4"
        }
      },
      {
        filter: "equalizer",
        options: {
          frequency: "250",
          width_type: "q",
          width: "1.5",
          gain: "6"
        }
      },
      {
        filter: "equalizer",
        options: {
          frequency: "2000",
          width_type: "q",
          width: "1",
          gain: "7.5"
        }
      },
      {
        filter: "equalizer",
        options: {
          frequency: "8000",
          width_type: "q",
          width: "1.5",
          gain: "5"
        }
      },
      // Volume at the end of chain
      {
        filter: "volume",
        options: "3.5"  // Adjusted volume after EQ
      }
    ],
    secondPass: [
      // Add volume control in second pass too
      {
        filter: "volume",
        options: "1.8"
      },
      {
        filter: "aecho",
        options: {
          in_gain: 0.6,
          out_gain: 0.4,
          delays: "50|150",
          decays: "0.4|0.3"
        }
      },
      {
        filter: "aecho",
        options: {
          in_gain: 0.3,
          out_gain: 0.2,
          delays: "200",
          decays: "0.2"
        }
      },
      {
        filter: "acompressor",
        options: "threshold=0.8:ratio=1.5:attack=10:release=100"
      }
    ]
  }
};

class AudioProcessor {
  static process(inputPath, outputPath, effectType, progressCallback, errorCallback) {
    return new Promise((resolve, reject) => {
      const config = effectConfigs[effectType];
      if (!config) {
        reject(new Error('Invalid effect type'));
        return;
      }

      const tempFile = path.join(path.dirname(outputPath), `_temp_${Date.now()}.mp3`);
      
      ffmpeg(inputPath)
        .toFormat('mp3')
        .audioBitrate('320k')
        .audioChannels(2)
        .audioFilters(config.filters)
        .on('start', (cmd) => {
          log.info('FFmpeg command:', cmd);
        })
        .on('progress', (progress) => {
          // First pass: 0-80%
          const percent = Math.min(80, Math.round(progress.percent || 0));
          progressCallback(percent, `Applying ${config.name}...`, 'processing');
        })
        .on('error', (err) => {
          log.error("FFmpeg error:", err);
          // Cleanup temp file if exists
          if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
          errorCallback(err.message);
          reject(err);
        })
        .on('end', () => {
          if (config.secondPass) {
            this.applySecondPass(tempFile, outputPath, config, progressCallback, errorCallback)
              .then(resolve)
              .catch(reject);
          } else {
            progressCallback(100, 'Conversion Complete!', 'success');
            resolve();
          }
        })
        .save(tempFile);
    });
  }

  static applySecondPass(tempFile, outputPath, config, progressCallback, errorCallback) {
    return new Promise((resolve, reject) => {
      ffmpeg(tempFile)
        .toFormat('mp3')
        .audioBitrate('320k')
        .audioChannels(2)
        .audioFilters(config.secondPass)
        .on("progress", (progress) => {
          // Second pass: 80-100%
          const percent = 80 + Math.min(20, Math.round((progress.percent || 0) * 0.2));
          progressCallback(percent, "Adding effects...", "processing");
        })
        .on("end", () => {
          if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
          progressCallback(100, "Conversion Complete!", "success");
          resolve();
        })
        .on("error", (err) => {
          log.error("Reverb error:", err);
          if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
          errorCallback(err.message);
          reject(err);
        })
        .save(outputPath);
    });
  }

  static checkFfmpeg() {
    try {
      const ffmpegPath = require("ffmpeg-static");
      return fs.existsSync(ffmpegPath);
    } catch (error) {
      return false;
    }
  }
}

module.exports = AudioProcessor;
