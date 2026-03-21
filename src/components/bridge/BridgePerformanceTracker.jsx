class BridgePerformanceTracker {
  constructor() {
    this.frameCount = 0;
    this.fps = 60;
    this.lastTime = performance.now();
    this.frameTimings = [];
    this.stats = {
      avgFrameTime: 0,
      peakFrameTime: 0,
      minFrameTime: Infinity,
      particleCount: 0,
      soundCount: 0,
      memoryUsage: 0
    };
  }

  recordFrame() {
    const now = performance.now();
    const frameTime = now - this.lastTime;
    this.lastTime = now;

    this.frameTimings.push(frameTime);
    if (this.frameTimings.length > 60) {
      this.frameTimings.shift();
    }

    this.frameCount++;
    
    // Update stats every 60 frames
    if (this.frameCount % 60 === 0) {
      this.updateStats();
    }

    return frameTime;
  }

  updateStats() {
    const timings = this.frameTimings;
    if (timings.length === 0) return;

    this.stats.avgFrameTime = timings.reduce((a, b) => a + b) / timings.length;
    this.stats.peakFrameTime = Math.max(...timings);
    this.stats.minFrameTime = Math.min(...timings);
    this.fps = Math.round(1000 / this.stats.avgFrameTime);

    // Memory profiling
    if (performance.memory) {
      this.stats.memoryUsage = Math.round(performance.memory.usedJSHeapSize / 1048576);
    }
  }

  getStats() {
    return {
      ...this.stats,
      fps: this.fps,
      frameCount: this.frameCount
    };
  }

  isPerformanceGood() {
    return this.fps >= 55 && this.stats.avgFrameTime < 18;
  }

  getPerformanceWarnings() {
    const warnings = [];
    
    if (this.fps < 55) {
      warnings.push(`Low FPS: ${this.fps}`);
    }
    if (this.stats.avgFrameTime > 18) {
      warnings.push(`High frame time: ${this.stats.avgFrameTime.toFixed(1)}ms`);
    }
    if (this.stats.memoryUsage > 500) {
      warnings.push(`High memory: ${this.stats.memoryUsage}MB`);
    }
    
    return warnings;
  }
}

export default BridgePerformanceTracker;