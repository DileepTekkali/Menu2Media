const sharp = require('sharp');

class EmptyZoneDetectorService {
  constructor() {
    this.minEmptyScore = 0.6;
    this.sampleGridSize = 10;
  }

  getDimensions(format) {
    const dimensions = {
      'square': { width: 1080, height: 1080 },
      'story': { width: 1080, height: 1920 },
      'landscape': { width: 1200, height: 630 }
    };
    return dimensions[format] || dimensions['square'];
  }

  async analyzeImage(imageBuffer, format = 'square') {
    const { width, height } = this.getDimensions(format);
    
    try {
      const grid = await this.createContentGrid(imageBuffer, width, height);
      const zones = this.findEmptyZones(grid, width, height, format);
      const rankedZones = this.rankZonesForText(zones, format);
      
      return {
        success: true,
        grid,
        zones: rankedZones,
        bestZone: rankedZones[0] || null,
        dimensions: { width, height }
      };
    } catch (error) {
      console.error('Empty zone detection error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async createContentGrid(imageBuffer, targetWidth, targetHeight) {
    const gridSize = this.sampleGridSize;
    const cellWidth = Math.floor(targetWidth / gridSize);
    const cellHeight = Math.floor(targetHeight / gridSize);
    
    const grid = [];
    
    for (let y = 0; y < gridSize; y++) {
      const row = [];
      for (let x = 0; x < gridSize; x++) {
        const cellData = await sharp(imageBuffer)
          .extract({
            left: x * cellWidth,
            top: y * cellHeight,
            width: cellWidth,
            height: cellHeight
          })
          .raw()
          .toBuffer();
        
        const grayscaleData = await sharp(imageBuffer)
          .extract({
            left: x * cellWidth,
            top: y * cellHeight,
            width: cellWidth,
            height: cellHeight
          })
          .grayscale()
          .raw()
          .toBuffer();
        
        const darkness = this.calculateDarkness(cellData);
        const saturation = this.calculateSaturation(cellData);
        const edgeDensity = this.calculateEdgeDensity(grayscaleData, cellWidth, cellHeight);
        const brightness = 1 - darkness;
        
        let contentScore, emptyScore;
        
        const isVibrantFood = saturation > 0.5 && brightness > 0.3;
        const isDarkEmpty = darkness > 0.5;
        
        if (isVibrantFood) {
          contentScore = Math.min(1, saturation * 0.4 + brightness * 0.3 + edgeDensity * 0.3);
          emptyScore = 1 - contentScore;
        } else if (isDarkEmpty) {
          emptyScore = darkness * 0.8 + (1 - saturation) * 0.2;
          contentScore = 1 - emptyScore;
        } else {
          contentScore = saturation * 0.6 + edgeDensity * 0.4;
          emptyScore = 1 - contentScore;
        }
        
        row.push({
          x, y,
          cellX: x * cellWidth,
          cellY: y * cellHeight,
          cellWidth,
          cellHeight,
          darkness,
          saturation,
          edgeDensity,
          brightness,
          contentScore,
          emptyScore: Math.min(1, Math.max(0, emptyScore))
        });
      }
      grid.push(row);
    }
    
    return grid;
  }

  calculateDarkness(rgbBuffer) {
    if (!rgbBuffer || rgbBuffer.length < 3) return 0.5;
    
    let totalDarkness = 0;
    const pixelCount = Math.floor(rgbBuffer.length / 3);
    
    for (let i = 0; i < rgbBuffer.length; i += 3) {
      const r = rgbBuffer[i];
      const g = rgbBuffer[i + 1];
      const b = rgbBuffer[i + 2];
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      totalDarkness += (1 - luminance);
    }
    
    return totalDarkness / pixelCount;
  }

  calculateSaturation(rgbBuffer) {
    if (!rgbBuffer || rgbBuffer.length < 3) return 0.5;
    
    let totalSaturation = 0;
    const pixelCount = Math.floor(rgbBuffer.length / 3);
    
    for (let i = 0; i < rgbBuffer.length; i += 3) {
      const r = rgbBuffer[i] / 255;
      const g = rgbBuffer[i + 1] / 255;
      const b = rgbBuffer[i + 2] / 255;
      
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 2;
      
      if (max === min) {
        totalSaturation += 0;
      } else {
        const d = max - min;
        const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        totalSaturation += s;
      }
    }
    
    return totalSaturation / pixelCount;
  }

  calculateEdgeDensity(grayscaleBuffer, width, height) {
    if (!grayscaleBuffer || grayscaleBuffer.length < 9) return 0;
    
    let edgeSum = 0;
    const maxY = Math.min(height - 1, Math.floor(Math.sqrt(grayscaleBuffer.length / width)) - 1);
    const maxX = Math.min(width - 1, width - 1);
    
    for (let y = 1; y < maxY; y++) {
      for (let x = 1; x < maxX; x++) {
        const idx = y * width + x;
        if (idx >= grayscaleBuffer.length - width - 1) continue;
        
        const sobelX = 
          -1 * (grayscaleBuffer[idx - width - 1] || 0) +
          1 * (grayscaleBuffer[idx - width + 1] || 0) +
          -2 * (grayscaleBuffer[idx - 1] || 0) +
          2 * (grayscaleBuffer[idx + 1] || 0) +
          -1 * (grayscaleBuffer[idx + width - 1] || 0) +
          1 * (grayscaleBuffer[idx + width + 1] || 0);
        
        const sobelY = 
          -1 * (grayscaleBuffer[idx - width - 1] || 0) +
          -2 * (grayscaleBuffer[idx - width] || 0) +
          -1 * (grayscaleBuffer[idx - width + 1] || 0) +
          1 * (grayscaleBuffer[idx + width - 1] || 0) +
          2 * (grayscaleBuffer[idx + width] || 0) +
          1 * (grayscaleBuffer[idx + width + 1] || 0);
        
        edgeSum += Math.sqrt(sobelX * sobelX + sobelY * sobelY) / 255;
      }
    }
    
    const maxPossibleEdges = (maxX - 1) * (maxY - 1);
    return maxPossibleEdges > 0 ? Math.min(1, edgeSum / maxPossibleEdges) : 0;
  }

  findEmptyZones(grid, width, height, format) {
    const zones = [];
    const gridSize = this.sampleGridSize;
    const minZoneSize = 2;
    
    const visited = Array(gridSize).fill(null).map(() => Array(gridSize).fill(false));
    
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        if (visited[y][x]) continue;
        
        const cell = grid[y][x];
        if (cell.emptyScore < this.minEmptyScore) {
          visited[y][x] = true;
          continue;
        }
        
        const zone = this.floodFillZone(grid, x, y, visited);
        const zoneInfo = this.analyzeZone(zone, width, height, format);
        
        if (zoneInfo.width >= minZoneSize && zoneInfo.height >= minZoneSize) {
          zones.push(zoneInfo);
        }
      }
    }
    
    return zones;
  }

  floodFillZone(grid, startX, startY, visited, threshold) {
    const zone = [];
    const queue = [[startX, startY]];
    const gridSize = this.sampleGridSize;
    
    while (queue.length > 0) {
      const [x, y] = queue.shift();
      
      if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) continue;
      if (visited[y][x]) continue;
      
      const cell = grid[y][x];
      if (cell.emptyScore < this.minEmptyScore) continue;
      
      visited[y][x] = true;
      zone.push(cell);
      
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    
    return zone;
  }

  analyzeZone(zone, width, height, format) {
    if (zone.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0, area: 0, avgEmptyScore: 0 };
    }
    
    const gridSize = this.sampleGridSize;
    const cellWidth = width / gridSize;
    const cellHeight = height / gridSize;
    
    let minGridX = gridSize, maxGridX = 0, minGridY = gridSize, maxGridY = 0;
    let totalEmptyScore = 0;
    
    for (const cell of zone) {
      minGridX = Math.min(minGridX, cell.x);
      maxGridX = Math.max(maxGridX, cell.x);
      minGridY = Math.min(minGridY, cell.y);
      maxGridY = Math.max(maxGridY, cell.y);
      totalEmptyScore += cell.emptyScore;
    }
    
    const pixelX = minGridX * cellWidth;
    const pixelY = minGridY * cellHeight;
    const pixelWidth = (maxGridX - minGridX + 1) * cellWidth;
    const pixelHeight = (maxGridY - minGridY + 1) * cellHeight;
    
    return {
      x: Math.round(pixelX),
      y: Math.round(pixelY),
      width: Math.round(pixelWidth),
      height: Math.round(pixelHeight),
      area: pixelWidth * pixelHeight,
      avgEmptyScore: totalEmptyScore / zone.length,
      centerX: Math.round(pixelX + pixelWidth / 2),
      centerY: Math.round(pixelY + pixelHeight / 2)
    };
  }

  rankZonesForText(zones, format) {
    const scoredZones = zones.map(zone => {
      let score = zone.avgEmptyScore * 100;
      
      const minWidth = format === 'landscape' ? 300 : 200;
      const minHeight = 100;
      
      if (zone.width >= minWidth && zone.height >= minHeight) {
        score += 20;
      } else if (zone.width >= minWidth * 0.7 && zone.height >= minHeight * 0.7) {
        score += 10;
      }
      
      const centerX = zone.x + zone.width / 2;
      const aspectRatio = zone.width / zone.height;
      
      if (format === 'landscape') {
        if (zone.x < centerX * 0.3) score += 30;
      } else if (format === 'story') {
        if (zone.y < 300) score += 25;
        if (aspectRatio > 1.5) score += 15;
      } else {
        if (zone.y < 200) score += 20;
        if (aspectRatio > 1.2) score += 10;
      }
      
      return { ...zone, score };
    });
    
    return scoredZones.sort((a, b) => b.score - a.score);
  }

  getRecommendedTextPosition(zone, format, options = {}) {
    const { x, y, width, height, centerX, centerY } = zone;
    const padding = options.padding || 20;
    const maxWidth = options.maxWidth || width - padding * 2;
    const preferredHeight = options.preferredHeight || 60;
    
    let textX, textY, textWidth;
    
    if (format === 'landscape') {
      textX = x + padding;
      textY = centerY - preferredHeight / 2;
      textWidth = Math.min(maxWidth, width * 0.6);
    } else if (format === 'story') {
      textX = centerX - maxWidth / 2;
      textY = Math.max(y + padding, centerY - preferredHeight * 1.5);
      textWidth = maxWidth;
    } else {
      textX = centerX - maxWidth / 2;
      textY = Math.max(y + padding, y + height * 0.3);
      textWidth = maxWidth;
    }
    
    return {
      x: Math.round(textX),
      y: Math.round(textY),
      width: Math.round(textWidth),
      height: preferredHeight,
      zone: { x, y, width, height }
    };
  }

  calculateOptimalTextSize(text, maxWidth, format) {
    const baseFontSizes = {
      'square': { min: 28, max: 64, default: 42 },
      'story': { min: 36, max: 96, default: 56 },
      'landscape': { min: 24, max: 72, default: 48 }
    };
    
    const config = baseFontSizes[format] || baseFontSizes.square;
    
    const charWidth = 0.6;
    const estimatedWidth = text.length * charWidth;
    const scaleFactor = maxWidth / estimatedWidth;
    
    let fontSize = config.default * Math.sqrt(scaleFactor);
    fontSize = Math.max(config.min, Math.min(config.max, fontSize));
    
    const charsPerLine = Math.floor(maxWidth / (fontSize * charWidth));
    const lines = Math.ceil(text.length / charsPerLine);
    
    return {
      fontSize: Math.round(fontSize),
      lineHeight: Math.round(fontSize * 1.2),
      charsPerLine,
      estimatedLines: lines,
      maxWidth: Math.round(fontSize * charWidth * charsPerLine)
    };
  }
}

module.exports = new EmptyZoneDetectorService();
