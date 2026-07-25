/**
 * FaceCaptureModal.jsx
 * Modal chụp ảnh khuôn mặt để đăng ký vào DB qua InsightFace.
 * KHÔNG dùng face-api.js — chỉ chụp JPEG và POST lên backend.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const FaceCaptureModal = ({ customer, onClose, onSuccess }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState(null); // base64 ảnh đã chụp

  // Khởi động camera
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
    };
  }, []);

  const handleVideoPlay = () => setCameraReady(true);

  // Chụp ảnh từ video
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !cameraReady) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    const ctx = canvas.getContext('2d');
    // Mirror lại để ảnh lưu đúng chiều (không bị lật như gương)
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, -canvas.width, 0);

    const imageBase64 = canvas.toDataURL('image/jpeg', 0.9);
    setPreview(imageBase64);
  }, [cameraReady]);

  // Gửi ảnh lên backend
  const handleEnroll = async () => {
    if (!preview) {
      toast.error('Vui lòng chụp ảnh trước');
      return;
    }
    setIsProcessing(true);

    try {
      // Convert base64 → Blob
      const response = await fetch(preview);
      const blob = await response.blob();

      const formData = new FormData();
      formData.append('image', blob, 'face.jpg');
      formData.append('imageBase64', preview); // Dùng làm avatar

      const customerId = customer.customerId || customer._id;
      const res = await api.post(
        `/customers/${customerId}/enroll-face`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      if (res.data.success) {
        toast.success('Đăng ký khuôn mặt thành công!');
        if (onSuccess) onSuccess(res.data.data?.avatarUrl || preview); // Trả ảnh về để cập nhật avatar
        onClose();
      } else {
        toast.error(res.data.message || 'Lỗi đăng ký khuôn mặt');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Lỗi kết nối đến Face Service';
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetPreview = () => setPreview(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Đăng ký khuôn mặt
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{customer?.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col items-center gap-4">
          {cameraError ? (
            <div className="text-center text-red-600 py-8">
              <span className="material-symbols-outlined text-4xl block mb-2">videocam_off</span>
              <p className="font-bold">{cameraError}</p>
            </div>
          ) : (
            <>
              {/* Camera / Preview */}
              <div className="relative rounded-xl overflow-hidden bg-black w-full max-w-sm aspect-[4/3]">
                {!preview ? (
                  <>
                    <video
                      ref={videoRef}
                      onPlay={handleVideoPlay}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                    {!cameraReady && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    {/* Khung hướng dẫn */}
                    {cameraReady && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-40 h-48 border-4 border-dashed border-white/60 rounded-full opacity-60" />
                      </div>
                    )}
                    <p className="absolute bottom-3 left-0 right-0 text-center">
                      <span className="bg-black/60 text-white text-xs px-3 py-1 rounded-full">
                        Nhìn thẳng vào camera
                      </span>
                    </p>
                  </>
                ) : (
                  // Hiển thị ảnh đã chụp
                  <img src={preview} alt="Xem trước" className="w-full h-full object-cover" />
                )}
              </div>

              {/* Hướng dẫn */}
              <ul className="text-xs text-gray-500 list-disc list-inside space-y-1 self-start w-full max-w-sm">
                <li>Đảm bảo khuôn mặt rõ ràng, đủ ánh sáng</li>
                <li>Nhìn thẳng, không đội mũ hay đeo khẩu trang</li>
                <li>Giữ khuôn mặt trong khung oval</li>
              </ul>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-5 border-t border-gray-100 dark:border-gray-700 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-bold border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Hủy
          </button>

          <div className="flex gap-2">
            {preview ? (
              <>
                <button
                  type="button"
                  onClick={resetPreview}
                  className="px-5 py-2.5 rounded-xl font-bold border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Chụp lại
                </button>
                <button
                  type="button"
                  onClick={handleEnroll}
                  disabled={isProcessing}
                  className="px-5 py-2.5 rounded-xl font-bold bg-primary text-background-dark hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">face_retouching_natural</span>
                      Lưu khuôn mặt
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={capturePhoto}
                disabled={!cameraReady || isProcessing}
                className="px-5 py-2.5 rounded-xl font-bold bg-primary text-background-dark hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">camera</span>
                Chụp ảnh
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FaceCaptureModal;
