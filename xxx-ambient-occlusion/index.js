const regl = require('../common/regl')({
  extensions: ['webgl_draw_buffers', 'oes_texture_float']
})
const resl = require('resl')
const glsl = require('glslify')
const withScene = require('./scene')(regl)
const { drawBox, boxModel } = require('./draw-box')(regl)
const clear = { depth: 1, color: [0, 0, 0, 1] }

const {drawSceneToFramebuffer, drawPostProcessing} = require('./post-process')(regl)
const drawPass = require('./post-process/draw-pass')(regl)
const drawOutput = require('./post-process/output')(regl, drawPass)

const {
  drawToGeometryBuffers,
  withGeometryBuffers,
  geometryBuffers
} = require('./geometry')(regl)

const drawLight = regl({
  frag: glsl`
    precision mediump float;
    varying vec2 vUv;
    uniform sampler2D albedoTexture, normalTexture, positionTexture;

    void main () {
      vec3 albedo = texture2D(albedoTexture, vUv).xyz;
      vec3 normal = texture2D(normalTexture, vUv).xyz;

      float brightness = dot(normal, vec3(0.0, 1.0, 0.0));
      gl_FragColor = vec4(
        mix(brightness * albedo, albedo, 0.8),
        1.0
      );
    }
  `,
})

let i = 0
resl({
  manifest: {},
  onDone: (assets) => {
    const frameLoop = regl.frame(({viewportWidth, viewportHeight}) => {
      try {
        const stutter = false;
        if (stutter && i++ % 3 !== 0) {
          // Make this stutter to preserve device energy while developing.
          return
        }

        geometryBuffers.resize(viewportWidth, viewportHeight)

        withScene(() => {
          drawToGeometryBuffers(() => {
            regl.clear({
              color: [0, 0, 0, 255],
              depth: 1
            })
            drawBox()
          });

          withGeometryBuffers(() => {
            drawLight();
          });
        });

        // drawSceneToFramebuffer(props => {
        //   draw();
        // })

        // drawPostProcessing(({sceneFBO}) => {
        //   drawOutput({sourceFBO: sceneFBO})
        // })

        window.frameDone()
      } catch (error) {
        console.error(error)
        frameLoop.cancel()
      }
    })
  }
})
