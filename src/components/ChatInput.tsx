import React, { useState, useRef } from 'react';
import { Send, Mic, Square } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string, sender?: string) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend }) => {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleSend = async () => {
    if (message.trim()) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? { mimeType: 'audio/webm;codecs=opus' }
        : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        await sendToGroq();
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendToGroq = async () => {
    const groqApiKey = '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';
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('temperature', '0.6');
    formData.append('response_format', 'verbose_json');

    try {
      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || response.statusText);
      }

      const result = await response.json();
      setMessage(result.text || '');
    } catch (err: any) {
      console.error('Transcription failed:', err);
    }
  };

  return (
    <div className="relative flex items-center w-full border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-2 sm:px-4 sm:py-2">
      {/* Text Input */}
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your message..."
        className="flex-1 bg-transparent border-none outline-none resize-none text-sm sm:text-base text-gray-800 dark:text-gray-200 px-2 overflow-y-auto custom-scrollbar"
        style={{
          height: 'auto', // Automatically adjust height
  
          display: 'flex',
          alignItems: 'center',
        }}
      />

      {/* Mic Button */}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={`p-1 sm:p-2 rounded-lg transition-colors duration-200 flex items-center justify-center ${
          isRecording
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'hover:bg-gray-200 dark:hover:bg-gray-700'
        }`}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isRecording ? <Square size={18} /> : <Mic size={18} />}
      </button>

      {/* Send Button */}
      <button
        onClick={handleSend}
        disabled={!message.trim()}
        className={`p-1 sm:p-2 rounded-lg transition-colors duration-200 ml-1 sm:ml-2 flex items-center justify-center ${
          message.trim()
            ? 'bg-blue-500 hover:bg-blue-600 text-white'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
        }`}
        aria-label="Send message"
      >
        <Send size={18} />
      </button>
    </div>
  );
};

export default ChatInput;
