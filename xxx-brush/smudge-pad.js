const glsl = require('glslify')
const vec2 = require('gl-vec2')
const framebufferFrom = require('./framebuffer-from')

module.exports = function createSmudePage (regl) {
  const withFullScreenQuad = require('./full-screen-quad')(regl)
  // These values are all the mutable state for the visualization.
  const state = {
    targetMouse: [-1000, -1000],
    prevMouse: [-1000, -1000],
    mouse: [-1000, -1000],
    mouseDirection: [1, 0],
    mouseSpeed: 0,
    brushSize: 0.05,
    colorBuffers: [
      colorColorFBO(regl),
      colorColorFBO(regl)
    ],
    velocityBuffers: [
      createVelocityFBO(regl),
      createVelocityFBO(regl)
    ],
  }

  setupEventHandlers(state)

  const updateMouse = createMouseUpdater(state)
  const updateColorBuffer = createUpdateColorBuffer(regl, state)
  const drawToScreen = createDrawToScreen(regl, state)

  return () => {
    updateMouse()
    withFullScreenQuad(() => {
      updateColorBuffer()
      drawToScreen()
    })
  }
}

function colorColorFBO(regl) {
  return framebufferFrom.draw(regl, regl({
    frag: glsl`
      precision mediump float;
      #pragma glslify: snoise2 = require(glsl-noise/simplex/2d)
      #pragma glslify: hsl2rgb = require(glsl-hsl2rgb)

      uniform vec2 ratio;
      varying vec2 vUv;

      void main() {
        float noise = min(1.0, max(0.0, (
          abs(1.5 * snoise2(vUv * 0.5 * ratio)) +
          abs(2.5 * snoise2(vUv * 1.0 * ratio)) +
          abs(0.8 * snoise2(vUv * 5.0 * ratio)) +
          abs(0.5 * snoise2(vUv * 20.0 * ratio)) +
          abs(0.6 * snoise2(vUv * 35.0 * ratio)) +
          abs(0.1 * snoise2(vUv * 50.0 * ratio))
        ) * 0.2));
        noise = mix(0.5, noise, 0.8);
        gl_FragColor = vec4(
          hsl2rgb(
            mod(vUv.x + mix(0.9, 0.5, noise), 1.0),
            0.3,
            noise * 0.8 + 0.1
          ),
        1.0);
      }
    `,
    uniforms: {
      ratio: ({viewportWidth, viewportHeight}) => [viewportWidth / viewportHeight, 1]
    }
  }))
}

function createVelocityFBO (regl) {
  const width = regl._gl.drawingBufferWidth
  const height = regl._gl.drawingBufferHeight
  return regl.framebuffer({
    width,
    height,
    colorType: 'float',
    depthStencil: false,
    color: (() => {
      const count = width * height
      const data = new Float32Array(count * 4)
      // Initialize the values
      for (let i = 0; i < count; i++) {
        data[i * 4 + 0] = 1 // x
        data[i * 4 + 1] = 1 // y
        data[i * 4 + 2] = 0 // unused
        data[i * 4 + 3] = 0 // unused
      }
      return regl.texture({
        data,
        width,
        height,
        type: 'float'
      })
    })(),
  })
}

function setupEventHandlers (state) {
  window.addEventListener('keypress', event => {
    const up = 38
    const down = 40
    switch (event.keyCode) {
      case up:
        state.brushSize *= 1.2
        break
      case down:
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
      precision mediump float;

      varying vec2 vUv;
      uniform sampler2D colorBuffer;

      void main() {
        vec4 frag = texture2D(colorBuffer, vUv);
        gl_FragColor = frag;
      }
    `,
    depth: { enable: false },
    uniforms: {
      colorBuffer: ({tick}) => state.colorBuffers[(tick + 1) % 2],
    }
  })
}

function createUpdateColorBuffer (regl, state) {
  return regl({
    frag: glsl`
      precision mediump float;

      uniform float blurDistance, brushSize, mouseSpeed, time, colorMix, pixelsMovedOverToMix;
      uniform vec2 resolution, mouse, mouseDirection;
      uniform sampler2D colorBuffer, velocityBuffer;
      varying vec2 vUv;

      #pragma glslify: blur5 = require('glsl-fast-gaussian-blur/5')
      #pragma glslify: blur9 = require('glsl-fast-gaussian-blur/9')
      #pragma glslify: blur13 = require('glsl-fast-gaussian-blur/13')
      #pragma glslify: hsl2rgb = require(glsl-hsl2rgb)

      float pixelsFrom(vec2 point) {
        return distance(point, vUv * resolution);
      }

      float getDistanceFromBrush(vec2 brushCenter) {
        return (
          // Keep in 0 to 1 range
          max(0.0, min(1.0,
            // Flip the black and white values
            1.0 -
            // Shape the curve from linear to cubic to make a softer brush.
            pow(
              // Change the distance in terms of a brush size
              pixelsFrom(brushCenter) / (brushSize * resolution.y),
              3.0
            )
          ))
        );
      }

      void main() {
        vec4 colorFromBuffer = texture2D(colorBuffer, vUv);
        vec4 blurHorizontal = blur13(colorBuffer, vUv, resolution, mouseDirection * blurDistance);

        // Blur at the mouse.
        gl_FragColor = mix(
          colorFromBuffer,
          mix(
            blurHorizontal,
            vec4(hsl2rgb(mod(time * 0.1, 1.0), 0.5, 0.5), 1.0),
            colorMix
          ),
          getDistanceFromBrush(mouse) * min(1.0, max(0.0, (mouseSpeed / resolution.y) * pixelsMovedOverToMix))
        );

        // Apply the velocity
        float stepX = 1.0 / resolution.x;
        float stepY = 1.0 / resolution.y;

        vec2 velocity = texture2D(velocityBuffer, vUv).xy;
        vec2 velocityTop = texture2D(velocityBuffer, vUv + vec2(0.0, stepY)).xy;
        vec2 velocityBottom = texture2D(velocityBuffer, vUv + vec2(0.0, -stepY)).xy;
        vec2 velocityLeft = texture2D(velocityBuffer, vUv + vec2(-stepX, 0.0)).xy;
        vec2 velocityRight = texture2D(velocityBuffer, vUv + vec2(stepX, 0.0)).xy;

        vec3 colorTop = texture2D(colorBuffer, vUv + vec2(0.0, stepY)).xyz;
        vec3 colorBottom = texture2D(colorBuffer, vUv + vec2(0.0, -stepY)).xyz;
        vec3 colorLeft = texture2D(colorBuffer, vUv + vec2(-stepX, 0.0)).xyz;
        vec3 colorRight = texture2D(colorBuffer, vUv + vec2(stepX, 0.0)).xyz;


        float topMagnitude = max(0.0, -velocityTop.y);
        float bottomMagnitude = max(0.0, velocityBottom.y);
        float leftMagnitude = max(0.0, velocityLeft.x);
        float rightMagnitude = max(0.0, -velocityRight.x);


        vec3 color = gl_FragColor.xyz;
        // color -= color * length(velocity);
        color += colorTop * topMagnitude;
        color += colorBottom * bottomMagnitude;
        color += colorLeft * leftMagnitude;
        color += colorRight * rightMagnitude;

        color -= 0.25 * color * (
          topMagnitude +
          bottomMagnitude +
          leftMagnitude +
          rightMagnitude
        );
        if (vUv.x > 0.5) {
          color = normalize(color);
        }
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    depth: { enable: false },
    uniforms: {
      colorBuffer: ({tick}) => state.colorBuffers[tick % 2],
      velocityBuffer: ({tick}) => state.velocityBuffers[tick % 2],
      resolution: ({viewportWidth, viewportHeight}) => [
        viewportWidth, viewportHeight
      ],
      time: ({time}) => time,
      mouse: () => state.mouse,
      mouseDirection: () => state.mouseDirection,
      mouseSpeed: () => state.mouseSpeed,
      brushSize: () => state.brushSize,
      blurDistance: 5,
      colorMix: 0.05,
      pixelsMovedOverToMix: 1000,
    },
    framebuffer: ({tick}) => state.colorBuffers[(tick + 1) % 2],
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
    if (mouseDirection[0] === 0 && mouseDirection[1] === 0) {
      mouseDirection[0] = 1
    } else {
      vec2.normalize(mouseDirection, mouseDirection)
    }
  }
}
