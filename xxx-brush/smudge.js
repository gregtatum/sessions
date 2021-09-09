const glsl = require('glslify')
const vec2 = require('gl-vec2')
const framebufferFrom = require('./framebuffer-from')
const {
  createVelocityFBO,
  createUpdateVelocityBuffer
} = require('./smudge-velocity')
const {
  colorColorFBO,
  createUpdateColorBuffer
} = require('./smudge-color')

module.exports = function createSmudePage (regl) {
  const withFullScreenQuad = require('./full-screen-quad')(regl)
  // These values are all the mutable state for the visualization.
  const state = {
    targetMouse: [-1000, -1000],
    prevMouse: [-1000, -1000],
    mouse: [-1000, -1000],
    mouseDirection: [1, 0],
    mouseSpeed: 0,
    brushSize: 0.025,
    damping: 0.999,
    baseHue: Math.random(),
    colorBuffers: null,
    velocityBuffers: [
      createVelocityFBO(regl),
      createVelocityFBO(regl)
    ],
  }
  state.colorBuffers = [
    colorColorFBO(regl, state),
    colorColorFBO(regl, state)
  ]

  setupEventHandlers(state)

  const updateMouse = createMouseUpdater(state)
  const updateVelocityBuffer = createUpdateVelocityBuffer(regl, state)
  const updateColorBuffer = createUpdateColorBuffer(regl, state)
  const drawToScreen = createDrawToScreen(regl, state)

  return () => {
    updateMouse()
    withFullScreenQuad(({tick}) => {
      updateVelocityBuffer()
      updateColorBuffer()
      drawToScreen()
    })
  }
}

function setupEventHandlers (state) {
  window.addEventListener('keypress', event => {
    switch (event.charCode || event.keyCode) {
      case 93: // ]
      case 38: //up
        state.brushSize *= 1.2
        break
      case 91: // [
      case 40: // down
        state.brushSize /= 1.2
        break
    }
  })

  window.addEventListener('mousemove', event => {
    const x = event.clientX * window.devicePixelRatio
    // Flip the Y direction into texture space, where Y is flipped.
    const y = (window.innerHeight - event.clientY) * window.devicePixelRatio
    state.targetMouse[0] = x
    state.targetMouse[1] = y
  })
}

function createDrawToScreen (regl, state) {
  return regl({
    frag: glsl`
      precision highp float;

      varying vec2 vUv;
      uniform sampler2D fbo;

      void main() {
        vec4 frag = texture2D(fbo, vUv);
        gl_FragColor = frag;

        // Visualize the velocity buffer:
        // gl_FragColor = vec4(
        //   max(0.0, frag.x),
        //   max(0.0, -frag.x),
        //   0.0,
        //   1.0
        // );
      }
    `,
    depth: { enable: false },
    uniforms: {
      fbo: ({tick}) => state.colorBuffers[tick % 2],
      // fbo: ({tick}) => state.velocityBuffers[(tick + 1) % 2],
    }
  })
}

function createMouseUpdater (state) {
  return () => {
    const { mouseDirection, mouse, prevMouse, targetMouse } = state
    // Slowly move towards the target mouse
    prevMouse[0] = mouse[0]
    prevMouse[1] = mouse[1]
    if (targetMouse[0] !== -1000) {
      if (mouse[0] === -1000) {
        mouse[0] = targetMouse[0]
        mouse[1] = targetMouse[1]
        prevMouse[0] = targetMouse[0]
        prevMouse[1] = targetMouse[1]
      } else {
        const mixA = 0.90;
        const mixB = 1 - mixA
        mouse[0] = mouse[0] * mixA + targetMouse[0] * mixB
        mouse[1] = mouse[1] * mixA + targetMouse[1] * mixB
      }
    }

    // Update mouse direction and speed
    mouseDirection[0] = mouse[0] - prevMouse[0]
    mouseDirection[1] = mouse[1] - prevMouse[1]
    state.mouseSpeed = vec2.length(mouseDirection)
    if (state.mouseSpeed > 100) {
      debugger
    }
    if (mouseDirection[0] === 0 && mouseDirection[1] === 0) {
      mouseDirection[0] = 1
    } else {
      vec2.normalize(mouseDirection, mouseDirection)
    }
  }
}
