const glsl = require('glslify')

module.exports = function createDrawReactionDiffusion (regl, texture) {
  return regl({
    frag: glsl`
      precision mediump float;
      uniform sampler2D texture;
      varying vec2 vUv;

      void main () {
        vec4 texture = texture2D(texture, vUv);
        float a = texture.x;
        float b = texture.y;
        float brightness = a - b;
        brightness = mix(0.8, 0.2, brightness * brightness * brightness);
        gl_FragColor = vec4(brightness * vec3(1.0), 1.0);
      }
    `,
    uniforms: {
      texture
    },
  })
}
