/**
 * X11-based Stream Capture for Docker/Xvfb environments
 * Captures display directly using FFmpeg x11grab
 * More reliable than puppeteer-stream for Teams meetings
 */

const { spawn } = require('child_process');
const { PassThrough } = require('stream');
const fs = require('fs');

/**
 * Check if running in X11 environment (Docker/Linux)
 */
function isX11Available() {
  const display = process.env.DISPLAY;
  const isDocker = process.env.RUNNING_IN_DOCKER === 'true';
  const isLinux = process.platform === 'linux';

  console.log(`🖥️ X11 Check - DISPLAY: ${display}, Docker: ${isDocker}, Linux: ${isLinux}`);

  return !!(display && isLinux);
}

/**
 * Capture stream using X11 display grab + PulseAudio (works in Docker with Xvfb + PulseAudio)
 * @param {Object} options - Capture options
 * @returns {Stream} - Readable stream of media data in raw format suitable for FFmpeg
 */
async function captureStreamViaX11(options = {}) {
  if (!isX11Available()) {
    throw new Error('X11 display not available - this method only works in Linux/Docker with DISPLAY set');
  }

  const display = process.env.DISPLAY || ':99';
  const resolution = options.resolution || '1920x1080';
  const framerate = options.framerate || 30;

  console.log(`🎬 Starting X11 screen + audio capture...`);
  console.log(`📺 Display: ${display}`);
  console.log(`📐 Resolution: ${resolution}`);
  console.log(`🎞️ Framerate: ${framerate}`);

  // Check if PulseAudio is available
  const { execSync } = require('child_process');
  let hasPulseAudio = false;
  try {
    execSync('pactl info', { stdio: 'ignore' });
    hasPulseAudio = true;
    console.log('✅ PulseAudio detected - will capture audio');
  } catch (error) {
    console.log('⚠️ PulseAudio not available - capturing video only');
  }

  const outputStream = new PassThrough();

  // FFmpeg command to capture X11 display + audio
  // Output raw video+audio in a format that can be piped to another FFmpeg process
  const ffmpegArgs = [
    // Video input from X11
    '-f', 'x11grab',
    '-video_size', resolution,
    '-framerate', framerate.toString(),
    '-i', display,
  ];

  // Add audio input if PulseAudio is available
  if (hasPulseAudio) {
    ffmpegArgs.push(
      '-f', 'pulse',
      '-i', 'virtual_speaker.monitor'  // Capture from the monitor of our virtual speaker
    );
  }

  // Output configuration
  ffmpegArgs.push(
    '-f', 'matroska',  // Use Matroska container for streaming
    '-c:v', 'libx264',  // H.264 video codec
    '-preset', 'ultrafast',  // Fast encoding
    '-tune', 'zerolatency',  // Low latency
    '-pix_fmt', 'yuv420p'
  );

  if (hasPulseAudio) {
    ffmpegArgs.push(
      '-c:a', 'aac',  // AAC audio codec
      '-b:a', '128k'  // Audio bitrate
    );
  }

  ffmpegArgs.push('-');  // Output to stdout

  console.log('🚀 FFmpeg X11+Audio capture command:', 'ffmpeg', ffmpegArgs.join(' '));

  const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let frameCount = 0;
  let errorOutput = '';

  // Pipe FFmpeg stdout to our stream
  ffmpegProcess.stdout.on('data', (chunk) => {
    frameCount++;
    if (frameCount % 300 === 0) {  // Log every ~10 seconds at 30fps
      console.log(`📹 X11 Capture: ${frameCount} frames captured`);
    }
    outputStream.write(chunk);
  });

  // Collect error output for debugging
  ffmpegProcess.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    errorOutput += text;

    // Log important FFmpeg messages
    if (text.includes('Stream #') || text.includes('Video:') || text.includes('fps')) {
      console.log('🎥 FFmpeg X11:', text.trim());
    }
  });

  // Handle process errors
  ffmpegProcess.on('error', (error) => {
    console.error('❌ X11 capture process error:', error);
    outputStream.destroy(error);
  });

  // Handle process exit
  ffmpegProcess.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error(`❌ X11 capture exited with code ${code}, signal ${signal}`);
      console.error('FFmpeg error output:', errorOutput);
      outputStream.destroy(new Error(`X11 capture failed with code ${code}`));
    } else {
      console.log('✅ X11 capture ended gracefully');
      outputStream.end();
    }
  });

  // Cleanup function
  const cleanup = () => {
    try {
      if (ffmpegProcess && !ffmpegProcess.killed) {
        console.log('🛑 Stopping X11 capture...');
        ffmpegProcess.kill('SIGTERM');

        // Force kill after 5 seconds if still running
        setTimeout(() => {
          if (!ffmpegProcess.killed) {
            console.log('⚠️ Force killing X11 capture process');
            ffmpegProcess.kill('SIGKILL');
          }
        }, 5000);
      }
    } catch (error) {
      console.error('❌ Error during X11 capture cleanup:', error);
    }
  };

  // Attach cleanup handlers
  outputStream.on('close', cleanup);
  outputStream.on('end', cleanup);
  outputStream.stopCapture = cleanup;

  // Wait a moment to ensure FFmpeg started successfully
  await new Promise(resolve => setTimeout(resolve, 2000));

  if (ffmpegProcess.killed || ffmpegProcess.exitCode !== null) {
    throw new Error('X11 capture failed to start: ' + errorOutput);
  }

  console.log('✅ X11 stream capture initialized successfully');
  return outputStream;
}

/**
 * Capture using PulseAudio (for audio in Docker)
 * Note: Requires PulseAudio to be installed and configured
 */
async function captureAudioViaPulse(options = {}) {
  console.log('🎤 Attempting PulseAudio capture...');

  // Check if PulseAudio is available
  const { execSync } = require('child_process');
  try {
    execSync('pactl info', { stdio: 'ignore' });
    console.log('✅ PulseAudio detected');
  } catch (error) {
    throw new Error('PulseAudio not available');
  }

  const outputStream = new PassThrough();

  const ffmpegArgs = [
    '-f', 'pulse',
    '-i', 'default',
    '-f', 'wav',
    '-acodec', 'pcm_s16le',
    '-ar', '16000',
    '-ac', '1',
    '-'
  ];

  console.log('🚀 FFmpeg PulseAudio command:', 'ffmpeg', ffmpegArgs.join(' '));

  const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  ffmpegProcess.stdout.pipe(outputStream);

  ffmpegProcess.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    if (text.includes('Stream #') || text.includes('Audio:')) {
      console.log('🎤 FFmpeg PulseAudio:', text.trim());
    }
  });

  ffmpegProcess.on('error', (error) => {
    console.error('❌ PulseAudio capture error:', error);
    outputStream.destroy(error);
  });

  const cleanup = () => {
    if (ffmpegProcess && !ffmpegProcess.killed) {
      ffmpegProcess.kill('SIGTERM');
    }
  };

  outputStream.on('close', cleanup);
  outputStream.stopCapture = cleanup;

  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('✅ PulseAudio capture initialized');
  return outputStream;
}

module.exports = {
  captureStreamViaX11,
  captureAudioViaPulse,
  isX11Available
};
