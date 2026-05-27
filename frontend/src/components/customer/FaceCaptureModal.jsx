import React, { useRef, useState, useEffect } from 'react';
import * as faceapi from '@vladmandic/face-api';
import toast from 'react-hot-toast';

const FaceCaptureModal = ({ onClose, onCapture }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [faceData, setFaceData] = useState(null);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error("Lỗi tải models:", err);
        toast.error("Lỗi tải mô hình AI. Xem console.");
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    if (!modelsLoaded) return;
    
    const startVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Lỗi mở camera:", err);
        toast.error("Không thể mở Camera. Vui lòng cấp quyền.");
      }
    };

    startVideo();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [modelsLoaded]);

  const handleVideoPlay = () => {
    if (detecting) return;
    setDetecting(true);

    const matchAndDraw = async () => {
      if (!videoRef.current || !canvasRef.current || videoRef.current.paused || videoRef.current.ended) {
        setDetecting(false);
        return;
      }

      const detection = await faceapi.detectSingleFace(
        videoRef.current, 
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks().withFaceDescriptor();

      if (!canvasRef.current || !videoRef.current) return;

      if (canvasRef.current && videoRef.current) {
        const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
        if (displaySize.width > 0) {
          faceapi.matchDimensions(canvasRef.current, displaySize);

          if (detection) {
            const resizedDetection = faceapi.resizeResults(detection, displaySize);
            const ctx = canvasRef.current.getContext('2d');
            ctx.clearRect(0, 0, displaySize.width, displaySize.height);
            faceapi.draw.drawDetections(canvasRef.current, resizedDetection);
            // faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedDetection);
            
            // Set data temporarily to allow button to be enabled
            setFaceData({
                descriptor: Array.from(detection.descriptor), // Convert Float32Array to simple Array
                box: detection.detection.box
            });
          } else {
             const ctx = canvasRef.current.getContext('2d');
             ctx.clearRect(0, 0, displaySize.width, displaySize.height);
             setFaceData(null);
          }
        }
      }

      setTimeout(() => matchAndDraw(), 100);
    };

    matchAndDraw();
  };

  const handleCapture = () => {
      if (!faceData) return;
      
      // Chụp ảnh base64 từ video
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const imageUrl = canvas.toDataURL('image/jpeg', 0.8);

      onCapture({
          imageUrl,
          descriptor: faceData.descriptor
      });
      toast.success("Mẫu khuôn mặt đã được lưu!");
      onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Chụp mẫu sinh trắc học</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 flex flex-col items-center">
            {!modelsLoaded ? (
                <div className="p-10 flex flex-col items-center justify-center">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-4 text-gray-500 font-medium">Đang tải mô hình AI...</p>
                </div>
            ) : (
                <div className="relative rounded-xl overflow-hidden border-2 border-gray-100 bg-black max-w-full inline-block">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video 
                        ref={videoRef} 
                        onPlay={handleVideoPlay}
                        autoPlay 
                        muted 
                        className="w-full h-auto object-cover max-h-[60vh]"
                        style={{ transform: "scaleX(-1)" }} // Mirror effect for better UX
                    />
                    <canvas 
                        ref={canvasRef} 
                        className="absolute top-0 left-0 w-full h-full pointer-events-none"
                        style={{ transform: "scaleX(-1)" }}
                    />
                    
                    {!faceData && (
                        <div className="absolute bottom-4 left-0 right-0 text-center">
                             <span className="bg-black/60 text-white px-4 py-2 rounded-lg text-sm">Hãy nhìn thẳng vào Camera...</span>
                        </div>
                    )}
                </div>
            )}
            
            <div className="mt-6 flex justify-end gap-3 w-full">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2.5 rounded-xl font-bold border border-gray-200 text-gray-700 hover:bg-gray-50"
                 >
                    Hủy
                 </button>
                 <button
                    type="button"
                    onClick={handleCapture}
                    disabled={!faceData}
                    className="px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 bg-primary text-white hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/30"
                 >
                    <span className="material-symbols-outlined">camera</span>
                    Lấy Mẫu Khuôn Mặt
                 </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default FaceCaptureModal;
