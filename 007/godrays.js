module.exports = function createDraw (regl) {
  return regl({
    vert: `
      precision mediump float;
      attribute vec2 position;
      varying vec2 uv;
      void main () {
        uv = position;
        gl_Position = vec4(2.0 * position - 1.0, 0.0, 1);
      }
    `,
    frag: `
      precision mediump float;
      uniform float time, ratio;
      varying vec2 uv;

      float RAY_SPEED = 0.5;
      float RAY_WIDTH_1 = 18.0;
      float RAY_WIDTH_2 = 3.3;
      float RAY_WIDTH_3 = 0.8;
      float RAY_BRIGHTNESS = 0.11;

      void main () {
        // Make the beam position correct for different viewport ratios.
        float beamPosition = ratio * (
          // The slant needs to be corrected for the viewport ratio as well.
          uv.y * -0.4 / ratio
          + uv.x
        );

        float bright = (
          sin(beamPosition * RAY_WIDTH_1 + time * RAY_SPEED) +
          sin(beamPosition * RAY_WIDTH_2 + time * RAY_SPEED) +
          sin(beamPosition * RAY_WIDTH_3 + time * RAY_SPEED)
        );
        bright = RAY_BRIGHTNESS * pow(bright, mix(1.0, 2.0, uv.y));
        gl_FragColor = vec4(bright * 0.5, bright * 0.8, bright, 0.5);
      }
    `,
    attributes: {
      position: [
        -2, 0,
        0, -2,
        2, 2
      ]
    },
    count: 3,
    uniforms: {
      time: ({time}) => time * 0.75,
      ratio: ({viewportWidth, viewportHeight}) => viewportWidth / viewportHeight
    },
    blend: {
      enable: true,
      func: {
        srcRGB: 'src alpha',
        srcAlpha: 1,
        dstRGB: 'one',
        dstAlpha: 1
      },
      equation: {
        rgb: 'add',
        alpha: 'add'
      }
    },
    depth: {
      enable: false
    }
  })
}
