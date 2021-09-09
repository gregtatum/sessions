const regl = require('../common/regl')({
  extensions: [
    'webgl_draw_buffers',
    'oes_texture_float',
    'angle_instanced_arrays'
  ]
})
const resl = require('resl')
const glsl = require('glslify')
const withScene = require('./scene')(regl)
// const { drawBox, boxModel } = require('./draw-box')(regl)
const { updateFlock, drawFlock } = require('./flock')(regl)
const clear = { depth: 1, color: [0, 0, 0, 1] }

const {drawSceneToFramebuffer, drawPostProcessing} = require('./post-process')(regl)
const drawPass = require('./post-process/draw-pass')(regl)
const drawOutput = require('./post-process/output')(regl, drawPass)
const { drawSSAONoisy, drawSSAOBlur, withSsaoFBO } = require('./ssao')(regl);

const {
  drawToGeometryBuffers,
  withGeometryBuffers,
  geometryBuffers
} = require('./geometry')(regl)

const drawLight = regl({
  frag: glsl`
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D albedoTexture, normalTexture, positionTexture, ssaoFBO;

    void main () {
      vec3 albedo = texture2D(albedoTexture, vUv).xyz;
      vec3 normal = texture2D(normalTexture, vUv).xyz;
      float ssao = texture2D(ssaoFBO, vUv).x;

      float brightness = dot(normal, vec3(0.0, 1.0, 0.0));

      vec3 lighting = mix(brightness * albedo, albedo, 0.8);
      lighting = 1.5 * mix(lighting, lighting * ssao, 0.7);

      gl_FragColor = vec4(lighting, 1.0);
    }
  `,
})

let i = 0
resl({
  manifest: {},
  onDone: (assets) => {
    // Generate some box position and sizing informatino.
    const dist = 0.3;
    const boxes = Array(20).fill().map(() => ({
      position: [
        Math.random() * dist - (dist * 0.5),
        Math.random() * dist - (dist * 0.5),
        Math.random() * dist - (dist * 0.5),
      ],
      size: Math.random() * 0.25 + 0.25
    }));

    const frameLoop = regl.frame(({viewportWidth, viewportHeight}) => {
      try {
        const stutter = false;
        if (stutter && i++ % 3 !== 0) {
          // Make this stutter to preserve device energy while developing.
          return
        }

        geometryBuffers.resize(viewportWidth, viewportHeight)

        withScene(() => {
          updateFlock();
          drawToGeometryBuffers(() => {
            regl.clear({
              color: [0, 0, 0, 255],
              depth: 1
            })

            drawFlock();
          });

          withGeometryBuffers(() => {
            drawSSAONoisy(); // This is drawn to an internal buffer.
          });

          drawSSAOBlur(); // This is drawn to an internal buffer.

          withGeometryBuffers(() => {
            withSsaoFBO(() => {
              drawLight();
            });
          });
        });

        window.frameDone()
      } catch (error) {
        console.error(error)
        frameLoop.cancel()
      }
    })
  }
})
