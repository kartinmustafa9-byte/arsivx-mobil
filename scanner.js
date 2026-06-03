// --- Gelişmiş ArşivX Yapay Zeka Evrak Tanıma Algoritması (Ultimate Fail-Safe) ---
window.arsivxFindPaperContour = function (mat) {
  if (!window.cvLoaded) return null;

  let gray = new cv.Mat();
  cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY, 0);

  // Gürültü azaltma
  cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);

  // Otsu Threshold ile Canny için dinamik eşik bulma
  let threshMat = new cv.Mat();
  let highThresh = cv.threshold(
    gray,
    threshMat,
    0,
    255,
    cv.THRESH_BINARY | cv.THRESH_OTSU,
  );
  threshMat.delete();
  let lowThresh = 0.5 * highThresh;

  let edges = new cv.Mat();
  cv.Canny(gray, edges, lowThresh, highThresh);

  // Kenarları birleştirme
  let dilated = new cv.Mat();
  let M = cv.Mat.ones(5, 5, cv.CV_8U);
  cv.dilate(
    edges,
    dilated,
    M,
    new cv.Point(-1, -1),
    1,
    cv.BORDER_CONSTANT,
    cv.morphologyDefaultBorderValue(),
  );

  // Kameranın dış çerçevesinin sahte kenar oluşturmasını engellemek için dışa siyah çerçeve çiz
  cv.rectangle(
    dilated,
    new cv.Point(0, 0),
    new cv.Point(dilated.cols - 1, dilated.rows - 1),
    new cv.Scalar(0, 0, 0, 255),
    10,
  );

  let contours = new cv.MatVector();
  let hierarchy = new cv.Mat();

  // KRİTİK DEĞİŞİKLİK: RETR_EXTERNAL sadece en dış konturları bulur. Kağıt içindeki yazıları (text) yok sayar!
  cv.findContours(
    dilated,
    contours,
    hierarchy,
    cv.RETR_EXTERNAL,
    cv.CHAIN_APPROX_SIMPLE,
  );

  let maxArea = 0;
  let largestContour = null;

  // 1. Ekranda bulunan en büyük dış nesneyi (kağıdı) bul
  for (let i = 0; i < contours.size(); ++i) {
    let cnt = contours.get(i);
    let area = cv.contourArea(cnt);

    // Ekranın en az %5'i büyüklüğünde olmalı
    if (area > maxArea && area > mat.cols * mat.rows * 0.05) {
      maxArea = area;
      if (largestContour) largestContour.delete();
      largestContour = cnt.clone();
    }
    cnt.delete(); // Bellek sızıntısını önle!
  }

  let bestPoly = null;

  if (largestContour) {
    let peri = cv.arcLength(largestContour, true);
    let approx = new cv.Mat();
    let found4 = false;

    // Deneme 1: Klasik Çokgen Yaklaşımı
    for (let eps = 0.01; eps <= 0.15; eps += 0.01) {
      cv.approxPolyDP(largestContour, approx, eps * peri, true);
      if (approx.rows === 4) {
        bestPoly = approx.clone();
        found4 = true;
        break;
      }
    }

    // Deneme 2: Dışbükey Zarf (Convex Hull) ile - Kağıt köşeleri kıvrıksa veya yırtıksa
    if (!found4) {
      let hull = new cv.Mat();
      cv.convexHull(largestContour, hull, false, true);
      let hullPeri = cv.arcLength(hull, true);
      for (let eps = 0.01; eps <= 0.2; eps += 0.01) {
        cv.approxPolyDP(hull, approx, eps * hullPeri, true);
        if (approx.rows === 4) {
          bestPoly = approx.clone();
          found4 = true;
          break;
        }
      }
      hull.delete();
    }

    // Deneme 3: Ultimate Fallback (En Küçülten Dikdörtgen) - Ne olursa olsun her şekli dikdörtgene zorlar!
    if (!found4) {
      let rotRect = cv.minAreaRect(largestContour);
      let box = new cv.Mat();
      cv.boxPoints(rotRect, box); // 4x2 float32 matris

      bestPoly = new cv.Mat(4, 1, cv.CV_32SC2);
      bestPoly.data32S[0] = Math.round(box.data32F[0]);
      bestPoly.data32S[1] = Math.round(box.data32F[1]);
      bestPoly.data32S[2] = Math.round(box.data32F[2]);
      bestPoly.data32S[3] = Math.round(box.data32F[3]);
      bestPoly.data32S[4] = Math.round(box.data32F[4]);
      bestPoly.data32S[5] = Math.round(box.data32F[5]);
      bestPoly.data32S[6] = Math.round(box.data32F[6]);
      bestPoly.data32S[7] = Math.round(box.data32F[7]);
      box.delete();
    }

    approx.delete();
    largestContour.delete();
  }

  let points = null;
  if (bestPoly) {
    let pArray = [];
    for (let i = 0; i < 4; i++) {
      pArray.push({
        x: bestPoly.data32S[i * 2],
        y: bestPoly.data32S[i * 2 + 1],
      });
    }

    // Noktaları matematiksel olarak en doğru şekilde hizala (Rotasyona dayanıklı)
    let rect = new Array(4);
    pArray.sort((a, b) => a.x + a.y - (b.x + b.y));
    rect[0] = pArray[0]; // Top-Left
    rect[2] = pArray[3]; // Bottom-Right

    pArray.sort((a, b) => a.x - a.y - (b.x - b.y));
    rect[3] = pArray[0]; // Bottom-Left
    rect[1] = pArray[3]; // Top-Right

    points = {
      topLeftCorner: rect[0],
      topRightCorner: rect[1],
      bottomRightCorner: rect[2],
      bottomLeftCorner: rect[3],
    };
    bestPoly.delete();
  }

  gray.delete();
  edges.delete();
  dilated.delete();
  M.delete();
  contours.delete();
  hierarchy.delete();

  return points;
};
window.startLiveDocumentHighlight = function (videoEl, overlayCanvas) {
  if (typeof jscanify === "undefined" || !window.cvLoaded) {
    setTimeout(
      () => window.startLiveDocumentHighlight(videoEl, overlayCanvas),
      500,
    );
    return;
  }

  const scanner = new jscanify();
  let isRunning = true;

  // Attach stop mechanism to the video element
  videoEl.dataset.highlightRunning = "true";

  function loop() {
    if (!videoEl.srcObject || videoEl.dataset.highlightRunning !== "true") {
      // Stop loop and clear canvas
      const ctx = overlayCanvas.getContext("2d");
      ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      return;
    }

    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;

    if (vw > 0 && vh > 0) {
      // Create a downscaled version for faster contour detection
      const scale = 640 / Math.max(vw, vh);
      const sw = Math.round(vw * scale);
      const sh = Math.round(vh * scale);

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = sw;
      tempCanvas.height = sh;
      tempCanvas.getContext("2d").drawImage(videoEl, 0, 0, sw, sh);

      overlayCanvas.width = videoEl.clientWidth;
      overlayCanvas.height = videoEl.clientHeight;
      const ctx = overlayCanvas.getContext("2d");
      ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      try {
        const mat = cv.imread(tempCanvas);
        const points = window.arsivxFindPaperContour(mat);

        if (points) {
          // Export points for takeDocPhoto (scaled back to original video resolution)
          window.lastDetectedPoints = [
            { x: points.topLeftCorner.x / scale, y: points.topLeftCorner.y / scale },
            { x: points.topRightCorner.x / scale, y: points.topRightCorner.y / scale },
            { x: points.bottomRightCorner.x / scale, y: points.bottomRightCorner.y / scale },
            { x: points.bottomLeftCorner.x / scale, y: points.bottomLeftCorner.y / scale }
          ];

          const drawScaleX = overlayCanvas.width / sw;
          const drawScaleY = overlayCanvas.height / sh;

          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = 4;
          ctx.lineJoin = "round";

          ctx.beginPath();
          ctx.moveTo(points.topLeftCorner.x * drawScaleX, points.topLeftCorner.y * drawScaleY);
          ctx.lineTo(points.topRightCorner.x * drawScaleX, points.topRightCorner.y * drawScaleY);
          ctx.lineTo(points.bottomRightCorner.x * drawScaleX, points.bottomRightCorner.y * drawScaleY);
          ctx.lineTo(points.bottomLeftCorner.x * drawScaleX, points.bottomLeftCorner.y * drawScaleY);
          ctx.closePath();
          ctx.stroke();

          ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
          ctx.fill();

          ctx.fillStyle = "#fff";
          const corners = [points.topLeftCorner, points.topRightCorner, points.bottomRightCorner, points.bottomLeftCorner];
          corners.forEach((p) => {
            ctx.beginPath();
            ctx.arc(p.x * drawScaleX, p.y * drawScaleY, 5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
          });

          if (scannerStatusMsg) {
            scannerStatusMsg.textContent = "Harika! Sabit tutun...";
            scannerStatusMsg.className = "scanner-status-msg success";
          }
        } else {
          // No points found, clear the global state so we don't use stale points
          window.lastDetectedPoints = null;
          
          if (scannerStatusMsg) {
            scannerStatusMsg.textContent = "Bir belge hizalayın";
            scannerStatusMsg.className = "scanner-status-msg";
          }
        }  ctx.lineTo(
            points.topRightCorner.x * drawScaleX,
            points.topRightCorner.y * drawScaleY,
          );
          ctx.lineTo(
            points.bottomRightCorner.x * drawScaleX,
            points.bottomRightCorner.y * drawScaleY,
          );
          ctx.lineTo(
            points.bottomLeftCorner.x * drawScaleX,
            points.bottomLeftCorner.y * drawScaleY,
          );
          ctx.closePath();
          ctx.stroke();

          // Light green fill
          ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
          ctx.fill();

          // Draw corner dots
          ctx.fillStyle = "#fff";
          const corners = [
            points.topLeftCorner,
            points.topRightCorner,
            points.bottomRightCorner,
            points.bottomLeftCorner,
          ];
          corners.forEach((p) => {
            ctx.beginPath();
            ctx.arc(p.x * drawScaleX, p.y * drawScaleY, 6, 0, Math.PI * 2);
            ctx.fill();
          });

          // ALSO store them for the capture button, mapped to the full video resolution!
          const videoScaleX = vw / sw;
          const videoScaleY = vh / sh;
          window.lastDetectedLivePoints = {
            timestamp: Date.now(),
            points: [
              {
                x: points.topLeftCorner.x * videoScaleX,
                y: points.topLeftCorner.y * videoScaleY,
              },
              {
                x: points.topRightCorner.x * videoScaleX,
                y: points.topRightCorner.y * videoScaleY,
              },
              {
                x: points.bottomRightCorner.x * videoScaleX,
                y: points.bottomRightCorner.y * videoScaleY,
              },
              {
                x: points.bottomLeftCorner.x * videoScaleX,
                y: points.bottomLeftCorner.y * videoScaleY,
              },
            ],
          };
        }
        mat.delete();
      } catch (e) {
        // Ignore OpenCV errors during live frame
      }
    }

    // 10 FPS is plenty for a smooth overlay without killing battery
    setTimeout(() => requestAnimationFrame(loop), 100);
  }

  loop();
};

window.stopLiveDocumentHighlight = function (videoEl) {
  if (videoEl) {
    videoEl.dataset.highlightRunning = "false";
  }
};

window.autoCropImage = function (videoEl, callback) {
  // If libraries not loaded, fallback to full image
  if (typeof jscanify === "undefined" || !window.cvLoaded) {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = videoEl.videoWidth || 1280;
    tempCanvas.height = videoEl.videoHeight || 720;
    tempCanvas.getContext("2d").drawImage(videoEl, 0, 0);
    callback(tempCanvas.toDataURL("image/jpeg", 0.95));
    return;
  }

  const scanner = new jscanify();

  // Draw original high-res frame
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = videoEl.videoWidth;
  tempCanvas.height = videoEl.videoHeight;
  const ctx = tempCanvas.getContext("2d");
  ctx.drawImage(videoEl, 0, 0);

  try {
    // Extract paper uses full resolution for max quality
    const resultCanvas = scanner.extractPaper(
      tempCanvas,
      videoEl.videoWidth,
      videoEl.videoHeight,
    );

    // Apply a "Document Magic Color" filter directly to the extracted canvas
    // This enhances the text, whitens the background, and gives it a scanner feel.
    const resCtx = resultCanvas.getContext("2d");
    const imgData = resCtx.getImageData(
      0,
      0,
      resultCanvas.width,
      resultCanvas.height,
    );
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      // Simple contrast stretching + thresholding to whiten background
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Calculate perceived brightness
      let v = 0.299 * r + 0.587 * g + 0.114 * b;

      // If it's a light color, push it to white (paper background)
      if (v > 160) {
        data[i] = Math.min(255, r * 1.3);
        data[i + 1] = Math.min(255, g * 1.3);
        data[i + 2] = Math.min(255, b * 1.3);
      } else if (v < 90) {
        // If it's dark text, push it to black
        data[i] = Math.max(0, r * 0.7);
        data[i + 1] = Math.max(0, g * 0.7);
        data[i + 2] = Math.max(0, b * 0.7);
      }
    }
    resCtx.putImageData(imgData, 0, 0);

    callback(resultCanvas.toDataURL("image/jpeg", 0.92));
  } catch (e) {
    console.error("jscanify extraction failed:", e);
    // Fallback to full frame
    callback(tempCanvas.toDataURL("image/jpeg", 0.95));
  }
};

window.detectDocumentCornersFromImage = function (imgElement, callback) {
  if (typeof jscanify === "undefined" || !window.cvLoaded) {
    callback(null);
    return;
  }

  try {
    const scanner = new jscanify();

    // We need a canvas to pass to jscanify
    const canvas = document.createElement("canvas");
    canvas.width =
      imgElement.width || imgElement.videoWidth || imgElement.naturalWidth;
    canvas.height =
      imgElement.height || imgElement.videoHeight || imgElement.naturalHeight;

    if (!canvas.width || !canvas.height) {
      callback(null);
      return;
    }

    const ctx = canvas.getContext("2d");
    ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);

    // Downscale for faster/better contour detection (often jscanify works better on smaller images)
    const scale = 800 / Math.max(canvas.width, canvas.height);
    let mat;

    if (scale < 1) {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = Math.round(canvas.width * scale);
      tempCanvas.height = Math.round(canvas.height * scale);
      tempCanvas
        .getContext("2d")
        .drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
      mat = cv.imread(tempCanvas);
    } else {
      mat = cv.imread(canvas);
    }

    const points = window.arsivxFindPaperContour(mat);

    if (points) {
      // Custom algo natively returns points object
      mat.delete();

      // Map points back to original image scale
      const finalScale = scale < 1 ? 1 / scale : 1;

      callback([
        {
          x: points.topLeftCorner.x * finalScale,
          y: points.topLeftCorner.y * finalScale,
        },
        {
          x: points.topRightCorner.x * finalScale,
          y: points.topRightCorner.y * finalScale,
        },
        {
          x: points.bottomRightCorner.x * finalScale,
          y: points.bottomRightCorner.y * finalScale,
        },
        {
          x: points.bottomLeftCorner.x * finalScale,
          y: points.bottomLeftCorner.y * finalScale,
        },
      ]);
    } else {
      mat.delete();
      callback(null);
    }
  } catch (e) {
    console.error("Corner detection failed:", e);
    callback(null);
  }
};
