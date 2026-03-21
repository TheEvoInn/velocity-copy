export const ScanlineShader = {
  uniforms: {
    tDiffuse: { value: null },
    scanlineIntensity: { value: 0.15 },
    scanlineFrequency: { value: 1.0 },
    time: { value: 0.0 }
  },

  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float scanlineIntensity;
    uniform float scanlineFrequency;
    uniform float time;

    varying vec2 vUv;

    void main() {
      vec3 texel = texture2D(tDiffuse, vUv).rgb;
      
      // Create moving scanlines
      float scanline = sin((vUv.y + time * 0.5) * 3.14159 * scanlineFrequency) * 0.5 + 0.5;
      float effect = mix(1.0, scanline, scanlineIntensity);
      
      // Apply slight vertical stripes
      float stripe = mod(vUv.y * 200.0, 2.0) > 1.0 ? 1.0 : 0.98;
      effect *= stripe;
      
      gl_FragColor = vec4(texel * effect, 1.0);
    }
  `
};