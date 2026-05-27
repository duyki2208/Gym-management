import React, { useRef, useState, useEffect } from 'react';
import * as faceapi from '@vladmandic/face-api';
import toast from 'react-hot-toast';

const AutoCheckIn = ({ customers, onCheckIn, isCheckingIn }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceMatcher, setFaceMatcher] = useState(null);
  const [statusText, setStatusText] = useState("Đang khởi tạo thuật toán...");
  const [cameraError, setCameraError] = useState("");
  // Ref to prevent multiple check-ins for the same face
  const lastCheckInRef = useRef({ time: 0, id: null });

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models';
        setStatusText("Đang tải AI Models...");
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
        setStatusText("Sẵn sàng quét khuôn mặt");
      } catch (err) {
        console.error("Lỗi tải models:", err);
        setCameraError("Không tải được AI Models.");
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    // Generate Face Matcher
    if (modelsLoaded && customers.length > 0) {
      const labeledDescriptors = [];
      customers.forEach(c => {
        if (c.faceDescriptor && c.faceDescriptor.length === 128) {
          const arr = new Float32Array(c.faceDescriptor);
          labeledDescriptors.push(
            new faceapi.LabeledFaceDescriptors(c._id.toString(), [arr])
          );
        }
      });
      
      if (labeledDescriptors.length > 0) {
        const matcher = new faceapi.FaceMatcher(labeledDescriptors, 0.45); // 0.45 is similarity threshold
        setFaceMatcher(matcher);
        setStatusText(`Đã nạp ${labeledDescriptors.length} mẫu khuôn mặt. Sẵn sàng.`);
      } else {
        setStatusText("Chưa có khách hàng nào có mẫu sinh trắc học.");
      }
    }
  }, [modelsLoaded, customers]);

  useEffect(() => {
    if (!modelsLoaded) return;
    
    // Khởi động Camera
    const startVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Lỗi mở camera:", err);
        setCameraError("Không thể mở Camera. Vui lòng kiểm tra quyền.");
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
    const matchAndDraw = async () => {
      if (!videoRef.current || !canvasRef.current || videoRef.current.paused || videoRef.current.ended) {
        return; // Dừng vòng lặp nếu component bị unmount hoặc video pause
      }

      const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
      if (displaySize.width > 0 && faceMatcher) {
         faceapi.matchDimensions(canvasRef.current, displaySize);

         const detection = await faceapi.detectSingleFace(
            videoRef.current, 
            new faceapi.TinyFaceDetectorOptions()
         ).withFaceLandmarks().withFaceDescriptor();

         if (!canvasRef.current || !videoRef.current) return;

         if (detection) {
             const resizedDetection = faceapi.resizeResults(detection, displaySize);
             const ctx = canvasRef.current.getContext('2d');
             ctx.clearRect(0, 0, displaySize.width, displaySize.height);
             
             const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
             
             // Vẽ box
             const box = resizedDetection.detection.box;
             
             // Xử lý giữ 3s
             let labelText = bestMatch.label !== "unknown" ? "Khớp lệnh" : "Không rõ";
             let boxColor = bestMatch.label !== "unknown" ? "#10B981" : "#EF4444";
             
             if (bestMatch.label !== "unknown") {
                 const now = Date.now();
                 if (lastCheckInRef.current.holdId !== bestMatch.label) {
                     // Bắt đầu đếm
                     lastCheckInRef.current.holdId = bestMatch.label;
                     lastCheckInRef.current.firstSeen = now;
                 }
                 
                 const timeHeld = now - lastCheckInRef.current.firstSeen;
                 
                 if (timeHeld < 3000) {
                     // Đang chờ đủ 3s
                     const timeLeft = Math.ceil((3000 - timeHeld) / 1000);
                     labelText = `Giữ yên ${timeLeft}s...`;
                     boxColor = "#F59E0B"; // Yellow
                 } else {
                     // Đã đủ 3s, tiến hành check in
                     labelText = "Đã xác nhận!";
                     if (now - (lastCheckInRef.current.time || 0) > 10000 || lastCheckInRef.current.id !== bestMatch.label) {
                         lastCheckInRef.current.time = now;
                         lastCheckInRef.current.id = bestMatch.label;
                         
                         const customer = customers.find(c => c._id === bestMatch.label);
                         if (customer && !isCheckingIn) {
                            onCheckIn(customer);
                         }
                     }
                 }
             } else {
                 // Nếu không nhận diện được ai, reset hold
                 lastCheckInRef.current.holdId = null;
                 lastCheckInRef.current.firstSeen = 0;
             }

             const drawBox = new faceapi.draw.DrawBox(box, { 
                 label: labelText,
                 boxColor: boxColor
             });
             drawBox.draw(canvasRef.current);
         } else {
             const ctx = canvasRef.current.getContext('2d');
             ctx.clearRect(0, 0, displaySize.width, displaySize.height);
             lastCheckInRef.current.holdId = null;
             lastCheckInRef.current.firstSeen = 0;
         }
      }

      // Vòng lặp Real-time
      requestAnimationFrame(matchAndDraw);
    };

    matchAndDraw();
  };

  if (cameraError) {
      return (
          <div className="bg-red-50 p-6 rounded-xl border border-red-200 text-center">
              <span className="material-symbols-outlined text-red-500 text-4xl mb-2">videocam_off</span>
              <p className="text-red-700 font-bold">{cameraError}</p>
          </div>
      );
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 bg-white dark:bg-gray-800 p-6 rounded-xl border shadow-sm">
        <div className="w-full md:w-1/2 flex flex-col items-center">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-500">face_retouching_natural</span>
                Giao Diện Quét
            </h3>
            
            <div className="relative rounded-2xl overflow-hidden border-4 border-gray-100 dark:border-gray-700 bg-black shadow-inner w-full max-w-sm aspect-[4/3]">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video 
                    ref={videoRef} 
                    onPlay={handleVideoPlay}
                    autoPlay 
                    muted 
                    className="w-full h-full object-cover"
                    style={{ transform: "scaleX(-1)" }}
                />
                <canvas 
                    ref={canvasRef} 
                    className="absolute top-0 left-0 w-full h-full pointer-events-none"
                    style={{ transform: "scaleX(-1)" }}
                />
            </div>
            
            <p className={`mt-4 text-sm font-medium px-3 py-1 rounded-full ${faceMatcher ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
               {statusText}
            </p>
        </div>
        
        
    </div>
  );
};

export default AutoCheckIn;
