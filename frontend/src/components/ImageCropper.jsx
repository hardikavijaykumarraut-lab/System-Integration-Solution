import { useState, useRef } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, RotateCcw, ZoomIn } from 'lucide-react';

const ImageCropper = ({ image, crop, setCrop, completedCrop, setCompletedCrop }) => {
  const imgRef = useRef(null);

  const onImageLoad = (e) => {
    const { width, height } = e.currentTarget;
    // Set initial crop to center square
    const size = Math.min(width, height);
    setCrop({
      unit: 'px',
      x: (width - size) / 2,
      y: (height - size) / 2,
      width: size,
      height: size,
      aspect: 1,
    });
  };

  return (
    <div className="relative w-full h-96 bg-gray-100 rounded-lg overflow-hidden">
      <ReactCrop
        crop={crop}
        onChange={(c) => setCrop(c)}
        onComplete={(c) => setCompletedCrop(c)}
        aspect={1}
        circularCrop
        ruleOfThirds
        minHeight={50}
        minWidth={50}
      >
        <img
          ref={imgRef}
          src={image}
          alt="Crop preview"
          onLoad={onImageLoad}
          className="max-h-full max-w-full object-contain"
        />
      </ReactCrop>
    </div>
  );
};

export default ImageCropper;
