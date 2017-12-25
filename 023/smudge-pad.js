const glsl = require('glslify')
const vec2 = require('gl-vec2')
const framebufferFrom = require('./framebuffer-from')

module.exports = function createSmudePage (regl) {
  const withFullScreenQuad = require('./full-screen-quad')(regl)

  // These values are all the mutable state for the visualization.
  const prevMouse = [-1000, -1000]
  const nextMouse = [-1000, -1000]
  const pMouse = [-1000, -1000]
  const mouse = [-1000, -1000]
  const mouseDirection = []
  let mouseSpeed = 0;
  let brushSize = 0.05
  const framebuffers = [makeFBO(regl), makeFBO(regl)]

  // Set up some simple handlers to allow interaction.
  window.addEventListener('keypress', event => {
    const up = 38
    const down = 40
    switch (event.keyCode) {
      case up:
        brushSize *= 1.2
        break
      case down:
        brushSize /= 1.2
        break
    }
  })

  window.addEventListener('mousemove', event => {
    const { clientX, clientY } = event
    const x = clientX * window.devicePixelRatio
    // Flip the Y direction into texture space, where Y is flipped.
    const y = (window.innerHeight - clientY) * window.devicePixelRatio
    if (prevMouse[0] === -1000) {
      prevMouse[0] = x
      prevMouse[1] = y
    } else {
      prevMouse[0] = nextMouse[0]
      prevMouse[1] = nextMouse[1]
    }
    nextMouse[0] = x
    nextMouse[1] = y
  })

  const drawFBO = regl({
    frag: glsl`
      precision mediump float;

      varying vec2 vUv;
      uniform sampler2D fbo;

      void main() {
        vec4 frag = texture2D(fbo, vUv);
        gl_FragColor = frag;
      }
    `,
    depth: { enable: false },
    uniforms: {
      fbo: ({tick}) => framebuffers[(tick + 1) % 2],
    }
  })

  const updateFBO = regl({
    frag: glsl`
      precision mediump float;

      uniform float blurDistance, brushSize, mouseSpeed, time, colorMix, pixelsMovedOverToMix;
      uniform vec2 resolution, mouse, prevMouse, mouseDirection;
      uniform sampler2D fbo;
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
        vec4 frag = texture2D(fbo, vUv);
        vec4 blurHorizontal = blur13(fbo, vUv, resolution, mouseDirection * blurDistance);
        gl_FragColor = mix(
          frag,
          mix(
            blurHorizontal,
            vec4(hsl2rgb(mod(time * 0.1, 1.0), 0.5, 0.5), 1.0),
            colorMix
          ),
          getDistanceFromBrush(mouse) * min(1.0, max(0.0, (mouseSpeed / resolution.y) * pixelsMovedOverToMix))
        );
      }
    `,
    depth: { enable: false },
    uniforms: {
      fbo: ({tick}) => framebuffers[tick % 2],
      resolution: ({viewportWidth, viewportHeight}) => [
        viewportWidth, viewportHeight
      ],
      prevMouse: () => prevMouse,
      nextMouse: () => nextMouse,
      time: ({time}) => time,
      mouse: () => {
        pMouse[0] = mouse[0]
        pMouse[1] = mouse[1]
        if (nextMouse[0] !== -1000) {
          if (mouse[0] === -1000) {
            mouse[0] = nextMouse[0]
            mouse[1] = nextMouse[1]
          } else {
            const mixA = 0.90;
            const mixB = 1 - mixA
            mouse[0] = mouse[0] * mixA + nextMouse[0] * mixB
            mouse[1] = mouse[1] * mixA + nextMouse[1] * mixB
          }
        }
        return mouse
      },
      mouseDirection: () => {
        mouseDirection[0] = mouse[0] - pMouse[0]
        mouseDirection[1] = mouse[1] - pMouse[1]
        mouseSpeed = vec2.length(mouseDirection)
        if (mouseDirection[0] === 0 && mouseDirection[1] === 0) {
          mouseDirection[0] = 1
        } else {
          vec2.normalize(mouseDirection, mouseDirection)
        }
        return mouseDirection
      },
      mouseSpeed: () => mouseSpeed,
      brushSize: () => brushSize,
      blurDistance: 5,
      colorMix: 0.05,
      pixelsMovedOverToMix: 1000,
    },
    framebuffer: ({tick}) => framebuffers[(tick + 1) % 2],
  })

  return () => {
    withFullScreenQuad(() => {
      updateFBO()
      drawFBO()
    })
  }
}

function makeFBO(regl) {
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
