const { spawn, execSync } = require('child_process');
const log = require('electron-log');
const fs = require('fs');
const path = require('path');
const ffmpegStatic = require('ffmpeg-static');

class DependencyChecker {
    static async checkDependencies(progressCallback) {
        try {
            progressCallback(0, 'Checking ffmpeg...');
            const ffmpegPath = await this.getFfmpegPath();
            
            if (ffmpegPath) {
                log.info('Using ffmpeg at:', ffmpegPath);
                process.env.FFMPEG_PATH = ffmpegPath;
                progressCallback(100, 'FFmpeg ready');
                return true;
            }

            throw new Error('FFmpeg not found. Please try reinstalling the application.');
        } catch (error) {
            log.error('FFmpeg check failed:', error);
            throw error;
        }
    }

    static async getFfmpegPath() {
        // Try bundled ffmpeg first
        if (fs.existsSync(ffmpegStatic)) {
            return ffmpegStatic;
        }

        // Try system ffmpeg locations
        const systemPaths = [
            '/opt/homebrew/bin/ffmpeg',
            '/usr/local/bin/ffmpeg',
            '/usr/bin/ffmpeg'
        ];

        for (const p of systemPaths) {
            if (fs.existsSync(p)) {
                return p;
            }
        }

        return null;
    }

    static async checkSystemFfmpeg() {
        try {
            execSync('ffmpeg -version');
            return true;
        } catch (error) {
            return false;
        }
    }

    static async checkDependencyExists(dep) {
        const commonPaths = [
            '/usr/local/bin',
            '/usr/bin',
            '/opt/homebrew/bin',
            '/opt/local/bin',
            process.env.PATH
        ];

        try {
            execSync(`which ${dep}`);
            return true;
        } catch (error) {
            for (const basePath of commonPaths) {
                if (!basePath) continue;
                const paths = basePath.split(':');
                for (const path of paths) {
                    const execPath = `${path}/${dep}`;
                    if (fs.existsSync(execPath)) {
                        log.info(`Found ${dep} at ${execPath}`);
                        return true;
                    }
                }
            }
            return false;
        }
    }

    static async installDependencies(missing, progressCallback) {
        try {
            if (process.platform === 'darwin') {
                // Install using Homebrew on macOS
                progressCallback(20, `Installing ${missing.join(', ')}...`);
                await this.runCommand('brew', ['install', ...missing], progressCallback);
            } else if (process.platform === 'win32') {
                // Install using winget on Windows
                for (const dep of missing) {
                    progressCallback(20, `Installing ${dep}...`);
                    const packageId = dep === 'ffmpeg' ? 'Gyan.FFmpeg' : 'sox.sox';
                    await this.runCommand('winget', ['install', '-e', '--id', packageId], progressCallback);
                }
            }
            
            progressCallback(100, 'Dependencies installed successfully');
            return true;
        } catch (error) {
            throw new Error(`Failed to install ${missing.join(', ')}. Please install manually.`);
        }
    }

    static runCommand(cmd, args, progressCallback) {
        return new Promise((resolve, reject) => {
            const proc = spawn(cmd, args, { stdio: 'pipe' });
            let output = '';
            
            proc.stdout.on('data', (data) => {
                output += data.toString();
                log.info(`${cmd} output: ${data}`);
            });

            proc.stderr.on('data', (data) => {
                output += data.toString();
                log.error(`${cmd} error: ${data}`);
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    resolve(output);
                } else {
                    reject(new Error(`${cmd} failed with code ${code}: ${output}`));
                }
            });
        });
    }
}

module.exports = DependencyChecker;
