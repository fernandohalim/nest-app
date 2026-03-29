"use client";

import { useEffect, useRef, useState } from "react";

interface CameraScannerProps {
  onCapture: (file: File) => void;
  onClose: () => void;
  onUploadFallback: () => void;
}

export default function CameraScanner({
  onCapture,
  onClose,
  onUploadFallback,
}: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string>("");
  const [isReady, setIsReady] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            setIsReady(true);
          };
        }
      } catch (err: any) {
        console.error("camera access failed:", err);
        if (err.name === "NotAllowedError") {
          setError(
            "camera access denied. please enable it in your settings or upload a file.",
          );
        } else if (err.name === "NotFoundError") {
          setError("no camera found on this device.");
        } else {
          setError(
            "failed to start camera. you can still upload a file instead.",
          );
        }
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleSnap = () => {
    if (!videoRef.current || !canvasRef.current) return;

    // trigger the flash animation!
    setFlash(true);
    setTimeout(() => setFlash(false), 150);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("failed to capture image.");
          return;
        }
        const file = new File([blob], `receipt-scan-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });

        // Add a tiny delay so the user sees the flash before it closes
        setTimeout(() => {
          onCapture(file);
        }, 200);
      },
      "image/jpeg",
      0.8,
    );
  };

  return (
    // Outer Wrapper: Full screen on mobile, blurred backdrop on desktop
    <div className="fixed inset-0 z-[100] bg-black sm:bg-stone-900/90 sm:backdrop-blur-sm flex flex-col sm:items-center sm:justify-center animate-in fade-in duration-300">
      {/* Inner Device Container: Forces a mobile aspect ratio on desktop */}
      <div className="w-full h-full sm:max-w-sm sm:h-[800px] sm:max-h-[90vh] sm:rounded-[2.5rem] sm:border-8 sm:border-stone-800 overflow-hidden relative flex flex-col bg-black sm:shadow-2xl">
        {/* Flash Overlay */}
        <div
          className={`absolute inset-0 bg-white z-[60] pointer-events-none transition-opacity duration-150 ${flash ? "opacity-100" : "opacity-0"}`}
        />

        {/* top bar */}
        <div className="absolute top-0 left-0 right-0 p-6 pt-safe flex justify-between items-center z-20 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          <span className="text-white text-xs font-black tracking-widest uppercase px-3 py-1.5 bg-black/50 backdrop-blur-md rounded-full border border-white/10">
            scan receipt
          </span>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-black/50 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-white transition-all active:scale-90"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* camera viewfinder */}
        <div className="flex-1 relative flex items-center justify-center bg-stone-950 overflow-hidden">
          {error ? (
            <div className="p-8 text-center flex flex-col items-center gap-4 z-10">
              <div className="w-16 h-16 rounded-full bg-stone-800 flex items-center justify-center text-2xl border border-stone-700">
                📸
              </div>
              <p className="text-stone-400 text-sm">{error}</p>
            </div>
          ) : (
            <>
              {!isReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-4 bg-stone-950">
                  <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs text-stone-500 font-medium tracking-widest uppercase">
                    warming up ai...
                  </span>
                </div>
              )}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${isReady ? "opacity-100" : "opacity-0"}`}
              />

              {/* Ultra-Premium Receipt Frame Guide */}
              {isReady && (
                <div className="absolute inset-x-8 top-24 bottom-24 pointer-events-none flex items-center justify-center z-10">
                  {/* The dark overlay outside the frame (creates a focus window) */}
                  <div className="absolute -inset-[1000px] border-[1000px] border-black/40 rounded-[1024px]"></div>

                  {/* The 4 active corners */}
                  <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-emerald-400 rounded-tl-2xl opacity-80"></div>
                  <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-emerald-400 rounded-tr-2xl opacity-80"></div>
                  <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-emerald-400 rounded-bl-2xl opacity-80"></div>
                  <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-emerald-400 rounded-br-2xl opacity-80"></div>

                  {/* Pulsing Instruction Badge */}
                  <div className="absolute bottom-6 px-4 py-2 bg-black/60 backdrop-blur-md rounded-full border border-white/10 animate-pulse">
                    <span className="text-[10px] font-medium tracking-wide text-stone-200">
                      Align receipt within frame
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {/* bottom controls */}
        <div className="h-40 bg-black flex items-center justify-around px-8 pb-safe z-20 relative before:absolute before:inset-x-0 before:-top-24 before:h-24 before:bg-gradient-to-t before:from-black before:to-transparent before:pointer-events-none">
          {/* fallback gallery button */}
          <button
            onClick={onUploadFallback}
            className="w-12 h-12 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-stone-300 hover:bg-stone-700 hover:text-white active:scale-95 transition-all shadow-lg"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </button>

          {/* glowing shutter button */}
          <button
            onClick={handleSnap}
            disabled={!isReady || !!error}
            className="relative w-20 h-20 flex items-center justify-center group active:scale-90 transition-transform duration-200 disabled:opacity-50 disabled:active:scale-100"
          >
            <div className="absolute inset-0 rounded-full border-[3px] border-emerald-400/40 group-hover:border-emerald-400 group-hover:scale-110 transition-all duration-300 shadow-[0_0_20px_rgba(52,211,153,0.3)]"></div>
            <div className="w-[60px] h-[60px] rounded-full bg-white shadow-lg group-hover:bg-stone-200 transition-colors flex items-center justify-center z-10">
              <div className="w-12 h-12 rounded-full border-2 border-stone-300/60"></div>
            </div>
          </button>

          {/* empty div to balance flex spacing */}
          <div className="w-12 h-12"></div>
        </div>
      </div>
    </div>
  );
}
