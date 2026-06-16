import { useCallback, useEffect, useRef, useState } from 'react';
// packages
import Vapi from '@vapi-ai/web';

// components
import * as Dialog from '@radix-ui/react-dialog';
import { Box, Flex } from '@radix-ui/themes';
// icons
import { Mic, MicOff, X } from 'lucide-react';

// animation files
import Lottie from 'lottie-react';
import voiceAnimationData from './voiceAnimation.json';
import voiceLoading from './voiceLoading.json';

// styles
import './styles.css';

declare global {
  interface Window {
    VapiVoice: any;
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const VoiceSimulator = ({ open, onClose }: Props) => {
  const lottieRef = useRef<any>(null);
  const [vapiCall, setVapiCall] = useState<any>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [callStarted, setCallStarted] = useState<boolean>(false);

  const initializeVapi = useCallback(async () => {
    try {
      const vapi = new Vapi('2b65e677-41f0-4d89-9a09-519d0899058d');
      
      await vapi?.start('df836aeb-af10-4f07-bee1-333419d73d25', {
        transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en-US' },
      });
      setVapiCall(vapi);

      // Ensure the mic starts unmuted
      vapi?.setMuted && vapi?.setMuted(false);
      setIsMuted(false);

      // Listen for volume-level events to control the Lottie animation
      vapi?.on('volume-level', (volume: number) => {
        if (lottieRef?.current) {
          if (volume > 0) {
            lottieRef?.current?.play && lottieRef?.current?.play();
            lottieRef?.current?.setSpeed && lottieRef?.current?.setSpeed(0.2 + volume);
          } else {
            lottieRef?.current?.setSpeed && lottieRef?.current?.setSpeed(0.2);
          }
        }
      });

      vapi?.on('call-start', () => {
        setCallStarted(true);
      });

      vapi?.on('call-end', () => {
        setCallStarted(false);
        setTimeout(() => {
          onClose && onClose();
        }, 1000);
      });
    } catch (error) {
      console.error('Vapi error', error);
    }
  }, [onClose]);

  useEffect(() => {
    initializeVapi();
  }, [initializeVapi]);

  // Stop Vapi when the modal closes or the component unmounts.
  useEffect(() => {
    if (!open && vapiCall && vapiCall?.stop) {
      vapiCall?.stop();
    }
    return () => {
      if (vapiCall && vapiCall?.stop) {
        vapiCall?.stop();
      }
    };
  }, [open, vapiCall]);

  // Toggle mute state and update Vapi
  const toggleMute = useCallback(() => {
    if (vapiCall) {
      const newMutedState = !isMuted;
      vapiCall?.setMuted(newMutedState);
      setIsMuted(newMutedState);
    }
  }, [vapiCall, isMuted]);

  const handleClose = useCallback(() => {
    try {
      vapiCall?.stop();
    } catch (error) {
      onClose && onClose();
    }
  }, [vapiCall, onClose]);

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Title className="hidden"></Dialog.Title>
        <Dialog.Overlay className="fixed inset-0  h-full w-full bg-coolGrey-700 bg-opacity-80" />

        <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 transform rounded-lg bg-white p-6 shadow-xl">

          <Box className="flex flex-col items-center">
            <Lottie
              key={callStarted ? 'voiceAnimation' : 'voiceLoading'}
              animationData={callStarted ? voiceAnimationData : voiceLoading}
              loop={true}
              lottieRef={lottieRef}
              className="h-18 w-18"
            />

            {callStarted && (
              <Flex className="items-center gap-16">
                <Flex
                  className={`relative h-14 w-14 cursor-pointer items-center justify-center rounded-full ${isMuted ? 'bg-red-100 transition hover:bg-red-200' : 'bg-blue-100 transition hover:bg-blue-200'}`}
                  onClick={toggleMute}
                >
                  {isMuted ? (
                    <MicOff className="h-8 w-8 text-red-500" />
                  ) : (
                    <Mic className="h-8 w-8 text-accent" />
                  )}
                </Flex>
                <Flex
                  onClick={handleClose}
                  className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-red-500 p-2 transition hover:bg-red-600"
                >
                  <X className="h-8 w-8 text-white" />
                </Flex>
              </Flex>
            )}
            <Box className="mt-4 w-full">
              <Box id="vapi-voice-simulation-container" style={{ width: '100%', height: '100%' }} />
            </Box>
          </Box>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default VoiceSimulator;
