// Simple icon generator using browser canvas API
// Run this in browser console or use with HTML file

const sizes = [16, 48, 128];

function createIconCanvas(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // Transparent background
  ctx.clearRect(0, 0, size, size);
  
  // Camera body (rounded rectangle)
  const bodyW = size * 0.7;
  const bodyH = size * 0.5;
  const bodyX = (size - bodyW) / 2;
  const bodyY = (size - bodyH) / 2 + size * 0.05;
  const radius = size * 0.1;
  
  // Draw rounded rectangle
  ctx.fillStyle = '#4285f4';
  ctx.beginPath();
  ctx.moveTo(bodyX + radius, bodyY);
  ctx.lineTo(bodyX + bodyW - radius, bodyY);
  ctx.quadraticCurveTo(bodyX + bodyW, bodyY, bodyX + bodyW, bodyY + radius);
  ctx.lineTo(bodyX + bodyW, bodyY + bodyH - radius);
  ctx.quadraticCurveTo(bodyX + bodyW, bodyY + bodyH, bodyX + bodyW - radius, bodyY + bodyH);
  ctx.lineTo(bodyX + radius, bodyY + bodyH);
  ctx.quadraticCurveTo(bodyX, bodyY + bodyH, bodyX, bodyY + bodyH - radius);
  ctx.lineTo(bodyX, bodyY + radius);
  ctx.quadraticCurveTo(bodyX, bodyY, bodyX + radius, bodyY);
  ctx.closePath();
  ctx.fill();
  
  // Lens (outer circle)
  const lensSize = size * 0.3;
  const lensX = size / 2;
  const lensY = bodyY + bodyH / 2;
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(lensX, lensY, lensSize / 2, 0, Math.PI * 2);
  ctx.fill();
  
  // Inner lens
  ctx.fillStyle = '#4285f4';
  ctx.beginPath();
  ctx.arc(lensX, lensY, lensSize * 0.3, 0, Math.PI * 2);
  ctx.fill();
  
  // Flash
  const flashSize = size * 0.12;
  ctx.fillStyle = 'white';
  ctx.fillRect(bodyX + bodyW * 0.7, bodyY + size * 0.05, flashSize, flashSize);
  
  return canvas;
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createIconCanvas };
}
