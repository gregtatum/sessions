module.exports = function createDrawPass (regl) {
  return regl({
    vert: `
      precision mediump float;
      attribute vec2 position;
      varying vec2 vUv;
      void main() {
        vUv = 0.5 * (position + 1.0);
        gl_Position = vec4(position, 0, 1);
      }
    `,
    frag: `
      precision mediump float;
      varying vec2 vUv;
      uniform sampler2D sourceFBO;
      void main() {
        gl_FragColor = texture2D(sourceFBO, vUv);
      }
    `,
    attributes: {
      position: [ -4, -4, 4, -4, 0, 4 ]
    },
    uniforms: {
      sourceFBO: regl.prop('sourceFBO')
    },
    context: {
      sourceFBO: regl.prop('sourceFBO')
    },
    depth: { enable: false },
    count: 3
  })
}
