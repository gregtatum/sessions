const glsl = require('glslify')

module.exports = function createDrawReactionDiffusion (regl, texture) {
  return regl({
    frag: glsl`
      precision mediump float;
      uniform sampler2D texture;
      varying vec2 vUv;

      void main () {
        vec4 texture = texture2D(texture, vUv);
        gl_FragColor = vec4(texture.xyz, 1.0);
      }
    `,
    uniforms: {
      texture
    },
  })
}
