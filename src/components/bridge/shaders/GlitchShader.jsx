export const GlitchShader = {
  uniforms: {
    tDiffuse: { value: null },
    glitchStrength: { value: 0.0 },
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
    uniform float glitchStrength;
    uniform float time;

    varying vec2 vUv;

    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    void main() {
      vec2 uv = vUv;
      
      // Apply glitch effect based on strength
      if (glitchStrength > 0.0) {
        // Horizontal displacement glitch
        float glitchAmount = random(vec2(time, floor(uv.y * 20.0))) * glitchStrength;
        uv.x += glitchAmount * 0.05;
        
        // RGB channel separation
        float r = texture2D(tDiffuse, uv + vec2(glitchAmount * 0.01, 0.0)).r;
        float g = texture2D(tDiffuse, uv).g;
        float b = texture2D(tDiffuse, uv - vec2(glitchAmount * 0.01, 0.0)).b;
        
        gl_FragColor = vec4(r, g, b, 1.0);
      } else {
        gl_FragColor = texture2D(tDiffuse, uv);
      }
    }
  `
};