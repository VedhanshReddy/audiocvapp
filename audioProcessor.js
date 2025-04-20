const { spawn } = require('child_process');

class AudioProcessor {
    static process(inputPath, outputDir, progressCallback, errorCallback) {
        return new Promise((resolve, reject) => {
            const python = spawn('python3', [
                '-u', // Force unbuffered output
                'converter.py',
                inputPath,
                outputDir
            ]);

            python.stdout.on('data', (data) => {
                const out = data.toString().trim();
                
                if (out.startsWith('PROGRESS:')) {
                    const progress = parseInt(out.split(':')[1]);
                    const stage = progress < 25 ? 'Loading...' :
                                 progress < 50 ? 'Applying 8D effect...' :
                                 progress < 75 ? 'Converting...' :
                                 progress < 100 ? 'Adding effects...' : 'Finishing...';
                    progressCallback(progress, stage);
                } else if (out.startsWith('ERROR:')) {
                    const error = out.split(':')[1];
                    if (errorCallback) errorCallback(error);
                }
            });

            let errorOutput = '';
            python.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            python.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    if (errorCallback) errorCallback(errorOutput);
                    reject(new Error(`Python process exited with code ${code}\n${errorOutput}`));
                }
            });

            python.on('error', (err) => {
                if (errorCallback) errorCallback(err.message);
                reject(new Error(`Python process error: ${err.message}`));
            });
        });
    }
}

module.exports = AudioProcessor;
