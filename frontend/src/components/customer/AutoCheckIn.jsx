/**
 * AutoCheckIn.jsx
 * Nhận diện khuôn mặt tự động qua InsightFace microservice.
 * Browser chỉ capture frame và POST lên Node.js — KHÔNG xử lý AI trực tiếp.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { ScanFace, VideoOff } from 'lucide-react';
import api from '../../services/api';

const CAPTURE_INTERVAL_MS = 1500; // Chụp mỗi 1.5 giây

const AutoCheckIn = ({ onCheckIn, isCheckingIn }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const lastCheckInRef = useRef({ time: 0, id: null }); // Chống spam check-in
  const requestPendingRef = useRef(false);

  const [cameraError, setCameraError] = useState('');
  const [statusText, setStatusText] = useState('Đang khởi động camera...');
  const [statusColor, setStatusColor] = useState('yellow'); // 'yellow' | 'green' | 'red'
  const [lastMatched, setLastMatched] = useState(null); // { name, code, confidence }

  // ──────────────────────────────────────────────
  // Khởi động camera
  // ──────────────────────────────────────────────
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setStatusText('Sẵn sàng quét khuôn mặt');
        setStatusColor('green');
      } catch (err) {
        console.error('Lỗi mở camera:', err);
        setCameraError('Không thể mở Camera. Vui lòng cấp quyền truy cập.');
      }
    };

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ──────────────────────────────────────────────
  // Chụp frame và gửi lên server
  // ──────────────────────────────────────────────
  const captureAndRecognize = useCallback(async () => {
    if (!videoRef.current || videoRef.current.paused || isCheckingIn || requestPendingRef.current) return;
    if (videoRef.current.videoWidth === 0) return;

    // Vẽ frame hiện tại lên canvas ẩn
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);

    requestPendingRef.current = true;
    canvas.toBlob(async (blob) => {
      if (!blob) { requestPendingRef.current = false; return; }
      try {
        const formData = new FormData();
        formData.append('image', blob, 'frame.jpg');

        const res = await api.post('/checkins/recognize', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 8000,
        });

        const data = res.data;
        if (data.duplicate) return;
        if (data.rejected) {
          setStatusText(data.message || "Không thể check-in");
          setStatusColor('red');
          return;
        }

        if (!data.matched) {
          // Không nhận diện được — reset trạng thái hiện tại
          if (data.reason !== 'no_face_detected') {
            setStatusText('Đang tìm kiếm...');
            setStatusColor('yellow');
          }
          return;
        }

        // Khớp — kiểm tra chống spam (cùng người trong vòng 10 giây)
        const now = Date.now();
        if (
          lastCheckInRef.current.id === data.member._id &&
          now - lastCheckInRef.current.time < 10000
        ) {
          return;
        }

        lastCheckInRef.current = { id: data.member._id, time: now };

        if (data.warning === "expired") {
          setStatusText(`⚠️ Hết hạn: ${data.member.name}`);
          setStatusColor('red');
          toast.error(`Hội viên ${data.member.name} đã hết hạn gói tập!`);
        } else if (data.warning === "frozen") {
          setStatusText(`❄️ Bảo lưu: ${data.member.name}`);
          setStatusColor('yellow');
          toast.error(`Hội viên ${data.member.name} đang bảo lưu gói tập!`);
        } else {
          setStatusText(`✅ Nhận diện: ${data.member.name}`);
          setStatusColor('green');
        }

        setLastMatched({
          name: data.member.name,
          code: data.member.code,
          confidence: data.confidence,
        });

        // Gọi callback để trang CheckIn xử lý popup + âm thanh, truyền cờ true báo hiệu đã được check-in
        if (onCheckIn) onCheckIn(data.member, true);

      } catch (err) {
        if (err.response?.status === 503) {
          setStatusText('⚠️ Face Service chưa khởi động');
          setStatusColor('red');
        }
        // Lỗi mạng thông thường — im lặng, thử lại sau
      } finally {
        requestPendingRef.current = false;
      }
    }, 'image/jpeg', 0.85);
  }, [isCheckingIn, onCheckIn]);

  // Bắt đầu vòng lặp khi video phát
  const handleVideoPlay = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(captureAndRecognize, CAPTURE_INTERVAL_MS);
  };

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────
  if (cameraError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <VideoOff size={36} className="text-red-500 block mb-2 mx-auto" />
        <p className="font-semibold text-red-700">{cameraError}</p>
      </div>
    );
  }

  const statusBg = {
    yellow: 'bg-yellow-100 text-yellow-700',
    green:  'bg-green-100 text-green-700',
    red:    'bg-red-100 text-red-700',
  }[statusColor];

  return (
    <div className="flex flex-col gap-6 rounded-lg border border-border-light bg-surface-light p-5 dark:border-border-dark dark:bg-surface-dark md:flex-row">
      {/* Camera Panel */}
      <div className="w-full md:w-1/2 flex flex-col items-center">
        <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-text-light dark:text-text-dark">
          <ScanFace size={19} className="text-text-muted-light dark:text-text-muted-dark" />
          Nhận diện khuôn mặt
        </h3>

        <div className="relative aspect-[4/3] w-full max-w-sm overflow-hidden rounded-lg border border-border-light bg-black dark:border-border-dark">
          <video
            ref={videoRef}
            onPlay={handleVideoPlay}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          {/* Canvas ẩn dùng để capture frame */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <p className={`mt-4 rounded-full px-4 py-1.5 text-sm font-medium ${statusBg}`}>
          {statusText}
        </p>
      </div>

      {/* Info Panel */}
      <div className="w-full md:w-1/2 flex flex-col justify-center gap-4">
        <div className="rounded-lg border border-border-light bg-background-light p-5 dark:border-border-dark dark:bg-background-dark">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted-light dark:text-text-muted-dark">Lần nhận diện gần nhất</p>
          {lastMatched ? (
            <div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{lastMatched.name}</p>
              <p className="mt-1 text-sm text-gray-500">Mã: <span className="font-medium">{lastMatched.code}</span></p>
              <p className="text-xs text-green-600 mt-1">
                Độ chính xác: {(lastMatched.confidence * 100).toFixed(1)}%
              </p>
            </div>
          ) : (
            <p className="text-gray-400 italic">Chưa nhận diện được ai</p>
          )}
        </div>

        <div className="rounded-lg border border-border-light p-4 text-sm text-text-muted-light dark:border-border-dark dark:text-text-muted-dark">
          <p className="mb-1 font-medium text-text-light dark:text-text-dark">Hướng dẫn nhận diện</p>
          <p>Nhìn thẳng vào camera và giữ khuôn mặt trong khung hình. Hệ thống sẽ tự động ghi nhận khi tìm thấy hội viên.</p>
        </div>
      </div>
    </div>
  );
};

export default AutoCheckIn;
