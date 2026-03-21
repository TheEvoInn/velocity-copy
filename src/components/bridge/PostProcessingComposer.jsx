import * as THREE from 'three';
import { BloomShader } from './shaders/BloomShader';
import { GlitchShader } from './shaders/GlitchShader';
import { ScanlineShader } from './shaders/ScanlineShader';

class PostProcessingComposer {
  constructor(renderer, camera, scene) {
    this.renderer = renderer;
    this.camera = camera;
    this.scene = scene;
    
    // Create render targets
    const pixelRatio = renderer.getPixelRatio();
    const width = window.innerWidth * pixelRatio;
    const height = window.innerHeight * pixelRatio;
    
    this.renderTarget = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat
    });
    
    // Create shader passes
    this.bloomPass = this.createShaderPass(BloomShader);
    this.glitchPass = this.createShaderPass(GlitchShader);
    this.scanlinePass = this.createShaderPass(ScanlineShader);
    
    // Settings
    this.settings = {
      bloomEnabled: true,
      bloomStrength: 1.2,
      bloomRadius: 1.0,
      bloomThreshold: 0.7,
      
      glitchEnabled: false,
      glitchStrength: 0.0,
      
      scanlineEnabled: true,
      scanlineIntensity: 0.12,
      scanlineFrequency: 1.0
    };
    
    this.time = 0;
  }

  createShaderPass(shader) {
    const material = new THREE.ShaderMaterial({
      uniforms: JSON.parse(JSON.stringify(shader.uniforms)),
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader
    });
    
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    
    const scene = new THREE.Scene();
    scene.add(mesh);
    
    return { mesh, material, scene, geometry };
  }

  renderPass(inputTexture, outputTarget, pass) {
    pass.material.uniforms.tDiffuse.value = inputTexture;
    this.renderer.setRenderTarget(outputTarget);
    this.renderer.render(pass.scene, this.camera);
  }

  render() {
    this.time += 0.016; // ~60fps
    
    // Render main scene to render target
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(this.scene, this.camera);
    
    let current = this.renderTarget.texture;
    let temp = new THREE.WebGLRenderTarget(
      this.renderTarget.width,
      this.renderTarget.height,
      { type: THREE.HalfFloatType }
    );
    
    // Apply bloom
    if (this.settings.bloomEnabled) {
      this.bloomPass.material.uniforms.bloomStrength.value = this.settings.bloomStrength;
      this.bloomPass.material.uniforms.bloomRadius.value = this.settings.bloomRadius;
      this.bloomPass.material.uniforms.bloomThreshold.value = this.settings.bloomThreshold;
      this.renderPass(current, temp, this.bloomPass);
      current = temp.texture;
    }
    
    // Apply glitch
    if (this.settings.glitchEnabled && this.settings.glitchStrength > 0) {
      this.glitchPass.material.uniforms.glitchStrength.value = this.settings.glitchStrength;
      this.glitchPass.material.uniforms.time.value = this.time;
      this.renderPass(current, temp, this.glitchPass);
      current = temp.texture;
    }
    
    // Apply scanlines
    if (this.settings.scanlineEnabled) {
      this.scanlinePass.material.uniforms.scanlineIntensity.value = this.settings.scanlineIntensity;
      this.scanlinePass.material.uniforms.scanlineFrequency.value = this.settings.scanlineFrequency;
      this.scanlinePass.material.uniforms.time.value = this.time;
      this.renderPass(current, null, this.scanlinePass); // Render to screen
    } else if (current !== this.renderTarget.texture) {
      // Final copy to screen if scanlines disabled
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
    }
    
    temp.dispose();
  }

  onWindowResize(width, height) {
    const pixelRatio = this.renderer.getPixelRatio();
    this.renderTarget.setSize(width * pixelRatio, height * pixelRatio);
  }

  updateSetting(key, value) {
    if (key in this.settings) {
      this.settings[key] = value;
    }
  }

  dispose() {
    this.renderTarget.dispose();
    this.bloomPass.geometry.dispose();
    this.bloomPass.material.dispose();
    this.glitchPass.geometry.dispose();
    this.glitchPass.material.dispose();
    this.scanlinePass.geometry.dispose();
    this.scanlinePass.material.dispose();
  }
}

export default PostProcessingComposer;