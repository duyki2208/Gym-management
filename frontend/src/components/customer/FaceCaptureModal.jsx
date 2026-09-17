/**
 * FaceCaptureModal.jsx
 * Modal chụp ảnh khuôn mặt để đăng ký vào DB qua InsightFace.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Camera, ScanFace, VideoOff } from 'lucide-react';
import api from '../../services/api';
import BaseModal from '../common/BaseModal';
import Button from '../common/Button';

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
    // Mirror lại để ảnh lưu đúng chiều
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
      const response = await fetch(preview);
      const blob = await response.blob();

      const formData = new FormData();
      formData.append('image', blob, 'face.jpg');
      formData.append('imageBase64', preview);

      const customerId = customer.customerId || customer._id;
      const res = await api.post(
        `/customers/${customerId}/enroll-face`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      if (res.data.success) {
        toast.success('Đăng ký khuôn mặt thành công!');
        onSuccess?.(res.data.data);
        onClose();
      } else {
        toast.error(res.data.message || 'Đăng ký khuôn mặt thất bại');
      }
    } catch (err) {
      console.error('Lỗi enroll:', err);
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi xử lý khuôn mặt');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetPreview = () => setPreview(null);

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title="Đăng ký khuôn mặt"
      subtitle={`Hội viên: ${customer?.name || 'Chưa xác định'}`}
      icon={<ScanFace size={22} />}
      maxWidth="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy bỏ
          </Button>
          {preview ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={resetPreview}>
                Chụp lại
              </Button>
              <Button
                variant="primary"
                onClick={handleEnroll}
                disabled={isProcessing}
                loading={isProcessing}
                icon={ScanFace}
              >
                Lưu khuôn mặt
              </Button>
            </div>
          ) : (
            <Button
              variant="primary"
              onClick={capturePhoto}
              disabled={!cameraReady || isProcessing}
              icon={Camera}
            >
              Chụp ảnh
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col items-center gap-4">
        {cameraError ? (
          <div className="text-center text-red-600 py-8">
            <VideoOff size={36} className="block mb-2 mx-auto" />
            <p className="font-bold">{cameraError}</p>
          </div>
        ) : (
          <>
            {/* Camera / Preview */}
            <div className="relative rounded-xl overflow-hidden bg-black w-full max-w-sm aspect-[4/3] shadow-inner border border-border-light dark:border-border-dark">
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
                <img src={preview} alt="Xem trước" className="w-full h-full object-cover" />
              )}
            </div>

            <ul className="text-xs text-gray-500 dark:text-gray-400 list-disc list-inside space-y-1 self-start w-full max-w-sm">
              <li>Đảm bảo khuôn mặt rõ ràng, đủ ánh sáng</li>
              <li>Nhìn thẳng, không đội mũ hay đeo khẩu trang</li>
              <li>Giữ khuôn mặt trong khung oval</li>
            </ul>
          </>
        )}
      </div>
    </BaseModal>
  );
};

export default FaceCaptureModal;
