import React, { useState, useRef, useEffect } from 'react';
import {
  IoDownloadOutline,
  IoPauseOutline,
  IoPlayOutline,
} from 'react-icons/io5';
import WaveSurfer from 'wavesurfer.js';

function AudioPlayer({ src }) {
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Initialize WaveSurfer
  useEffect(() => {
    const options = {
      container: waveformRef.current,
      waveColor: '#ddd',
      //   progressColor: "#5B5BD6",
      cursorColor: '#5B5BD6',
      barWidth: 0,
      barRadius: 0,
      responsive: true,
      height: 40,
      normalize: true,
      backend: 'WebAudio' as const,
    };

    wavesurferRef.current = WaveSurfer.create(options);
    wavesurferRef.current.load(src);

    // Cleanup on unmount
    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }
    };
  }, [src]);

  // Play/Pause toggle
  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    wavesurferRef.current.playPause();
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
      }}
    >
      <button onClick={handlePlayPause} style={{ flex: 'none' }}>
        {isPlaying ? (
          <IoPauseOutline color="white" size="24" />
        ) : (
          <IoPlayOutline color="white" size="24" />
        )}
      </button>
      <div
        id="waveform"
        ref={waveformRef}
        style={{ flexGrow: 1, maxWidth: 'calc(100% - 100px)' }} // Make sure the waveform takes up the remaining space
      />
      <a href={src} download style={{ flex: 'none' }}>
        <IoDownloadOutline color="white" size="24" />

      </a>

    </div>
  );
}

export default AudioPlayer;
