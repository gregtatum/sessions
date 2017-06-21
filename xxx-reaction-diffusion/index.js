const regl = require('../common/regl')({
  extensions: ['OES_texture_float']
})
const glsl = require('glslify')

const pixels = regl.texture({
  type: 'float',
  data: (() => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const { width, height } = regl._gl.canvas
    const radius = Math.min(width, height) * 0.01
    canvas.width = width
    canvas.height = height
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(
      0,
      0,
      width,
      height
    )
    for (let i = 0; i < 1000; i++) {
      ctx.fillStyle = '#00ff00'
      ctx.fillRect(
        Math.random() * width - radius,
        Math.random() * height - radius,
        radius * 2,
        radius * 2
      )
    }

    return canvas
  })()
})

const drawReactionDiffusion = regl({
  vert: glsl`
    precision mediump float;
    attribute vec2 position;
    varying vec2 vUv;
    void main () {
      vUv = position;
      gl_Position = vec4(2.0 * position - 1.0, 0, 1);
    }
  `,
  frag: glsl`
    precision highp float;
    uniform sampler2D texture;
    uniform float time, viewportWidth, viewportHeight, neighborX, neighborY;
    varying vec2 vUv;

    float DIFFUSION_RATE_A = 1.0;
    float DIFFUSION_RATE_B = 0.5;
    float FEED_RATE = 0.055;
    float KILL_RATE = 0.062;
    // float FEED_RATE = 0.0367;
    // float KILL_RATE = 0.0649;
    float TIME_SCALE = 1.0;

    void main () {
      vec4 center = texture2D(texture, vUv);
      float a = center.x;
      float b = center.y;
      vec4 adjacentNeighbors = 0.20 * (
        texture2D(texture, vUv + vec2(neighborX, 0.0)) +
        texture2D(texture, vUv + vec2(0.0, neighborY)) +
        texture2D(texture, vUv + vec2(-neighborX, 0.0)) +
        texture2D(texture, vUv + vec2(0.0, -neighborY))
      );
      vec4 cornerNeighbors = 0.05 * (
        texture2D(texture, vUv + vec2(neighborX, neighborY)) +
        texture2D(texture, vUv + vec2(neighborX, -neighborY)) +
        texture2D(texture, vUv + vec2(-neighborX, -neighborY)) +
        texture2D(texture, vUv + vec2(-neighborX, neighborY))
      );

      vec2 toCenter = 0.002 * (vUv - 0.5);

      float laplacianA = -a + adjacentNeighbors.x + cornerNeighbors.x;
      float laplacianB = -b + adjacentNeighbors.y + cornerNeighbors.y;
      float reaction = a * b * b;
      float feed = FEED_RATE * (1.0 - a);
      float kill = (KILL_RATE + FEED_RATE) * b;
      gl_FragColor = vec4(
        toCenter.x + a + (DIFFUSION_RATE_A * laplacianA - reaction + feed) * TIME_SCALE,
        toCenter.y + b + (DIFFUSION_RATE_B * laplacianB + reaction - kill) * TIME_SCALE,
        0.0,
        1.0
      );
    }
  `,
  attributes: {
    position: [
      -2, 0,
      0, -2,
      2, 2]
  },
  uniforms: {
    texture: pixels,
    time: ({tick}) => 0.001 * tick,
    viewportWidth: regl.context('viewportWidth'),
    viewportHeight: regl.context('viewportHeight'),
    neighborX: ({viewportWidth}) => 1 / viewportWidth,
    neighborY: ({viewportHeight}) => 1 / viewportHeight,
  },
  count: 3
})

const fbo = regl.framebuffer({
  color: regl.texture({ wrap: 'clamp' }),
  colorType: 'float',
  depth: false
})

const copyTexture = regl({
  vert: glsl`
    precision mediump float;
    attribute vec2 position;
    varying vec2 vUv;
    void main () {
      vUv = position;
      gl_Position = vec4(2.0 * position - 1.0, 0, 1);
    }
  `,
  frag: glsl`
    precision mediump float;
    uniform sampler2D texture;
    varying vec2 vUv;

    void main () {
      gl_FragColor = texture2D(texture, vUv);
    }
  `,
  attributes: {
    position: [
      -2, 0,
      0, -2,
      2, 2]
  },
  uniforms: {
    texture: pixels,
  },
  count: 3
})

const drawPixels = regl({
  vert: glsl`
    precision mediump float;
    attribute vec2 position;
    varying vec2 vUv;
    void main () {
      vUv = position;
      gl_Position = vec4(2.0 * position - 1.0, 0, 1);
    }
  `,
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
  attributes: {
    position: [
      -2, 0,
      0, -2,
      2, 2]
  },
  uniforms: {
    texture: pixels,
  },
  count: 3
})

fbo.use(() => {
  copyTexture()
})

regl.frame(({viewportWidth, viewportHeight}) => {
  fbo.resize(viewportWidth, viewportHeight)
  fbo.use(() => {
    regl.clear({
      color: [0, 0, 0, 1]
    })
    drawReactionDiffusion()
    pixels({
      copy: true
    })
  })
  drawPixels()
})
