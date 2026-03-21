export const BloomShader = {
  uniforms: {
    tDiffuse: { value: null },
    bloomStrength: { value: 1.0 },
    bloomRadius: { value: 1.0 },
    bloomThreshold: { value: 0.7 }
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
    uniform float bloomStrength;
    uniform float bloomRadius;
    uniform float bloomThreshold;

    varying vec2 vUv;

    vec3 getBloom(sampler2D tex, vec2 uv, float radius, float strength) {
      vec3 color = texture2D(tex, uv).rgb;
      
      // Extract bright areas
      float brightness = dot(color, vec3(0.299, 0.587, 0.114));
      
      if (brightness < bloomThreshold) {
        return vec3(0.0);
      }
      
      vec3 bloom = color * (brightness - bloomThreshold) * strength;
      
      // Horizontal blur
      for (float x = -3.0; x <= 3.0; x += 1.0) {
        vec2 offset = vec2(x * radius / 512.0, 0.0);
        vec3 sampleColor = texture2D(tex, uv + offset).rgb;
        float sampleBrightness = dot(sampleColor, vec3(0.299, 0.587, 0.114));
        if (sampleBrightness > bloomThreshold) {
          bloom += sampleColor * (sampleBrightness - bloomThreshold) * strength * (1.0 - abs(x) / 3.0);
        }
      }
      
      return bloom / 7.0;
    }

    void main() {
      vec3 texel = texture2D(tDiffuse, vUv).rgb;
      vec3 bloom = getBloom(tDiffuse, vUv, bloomRadius, bloomStrength);
      
      gl_FragColor = vec4(texel + bloom, 1.0);
    }
  `
};