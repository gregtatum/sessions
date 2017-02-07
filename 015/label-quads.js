const quad = require('../common/quads')
const mat4 = require('gl-mat4')
const identity = mat4.identity([])
const glsl = require('glslify')
const POSITION_COLOR = [0.5, 0, 0]
const CELL_COLOR = [0, 0.5, 0]
const DIGIT_LENGTH = 3
const POSITION_FONT_SIZE = 0.025
const CELL_FONT_SIZE = 0.03
const NOOP = () => {}

module.exports = function (regl, quads) {
  if (quads.positions.length > 999 || quads.cells.length > 1000) {
    return {
      drawLines: NOOP,
      drawCellIndices: NOOP,
      drawPositionIndicies: NOOP
    }
  }
  const drawNumbers = createDrawNumbers(regl)
  return {
    drawLines: createDrawLines(regl, quads),
    drawCellIndices: createDrawCellIndices(regl, quads, drawNumbers),
    drawPositionIndicies: createDrawPositionIndices(regl, quads, drawNumbers)
  }
}

function createDrawLines (regl, quads) {
  return regl({
    vert: glsl`
      precision mediump float;
      attribute vec3 normal, position;
      uniform mat4 model, view, projection;
      varying vec3 vNormal;

      void main() {
        vNormal = normal;
        gl_Position = projection * view * model * vec4(position, 1.0);
      }
    `,
    frag: glsl`
      precision mediump float;
      varying vec3 vNormal;

      void main() {
        float brightness = mix(
          0.5,
          1.0,
          0.5 + 0.5 * dot(vNormal, vec3(0.0, 1.0, 0.0))
        );
        gl_FragColor = vec4(vec3(brightness), 1.0);
      }
    `,
    attributes: {
      position: quads.positions,
      normal: quads.normals
    },
    uniforms: {
      model: (_, props) => (props && props.model) ? props.model : identity
    },
    elements: quad.elementsFromQuads(regl, quads, 'lines'),
    primitive: 'lines',
    cull: { enable: false },
    depth: { enable: false }
  })
}

function createDrawNumbers (regl) {
  return regl({
    vert: glsl`
      precision mediump float;
      attribute vec3 normal, position;
      attribute vec3 digits;
      uniform mat4 model, view, projection;
      uniform float viewportHeight, fontHeight;
      varying vec3 vDigits;
      void main() {
        vDigits = digits;
        gl_Position = projection * view * model * vec4(position, 1.0);
        gl_PointSize = viewportHeight * fontHeight;
      }
    `,
    frag: glsl`
      precision mediump float;
      uniform sampler2D numbersTexture;
      uniform vec3 color;
      varying vec3 vDigits;

      float DIGIT_LENGTH = ${DIGIT_LENGTH.toFixed(1)};
      float TOP_OFFSET = (DIGIT_LENGTH - 1.0) / 2.0;
      float TEXTURE_GRID_SIZE = 4.0;
      float TEXTURE_GRID_SIZE_INVERSE = 1.0 / TEXTURE_GRID_SIZE;

      void main() {
        // Make the UV space to be the size of the digits.
        vec2 uv = gl_PointCoord * vec2(DIGIT_LENGTH);

        // Shift the UV basis coordinates to center the numbers in the Y axis. Use mod()
        // to keep the digit calculations correctly in range for the digit lookups.
        uv.y = mod(uv.y + TOP_OFFSET, DIGIT_LENGTH);

        // Lookup which digit we are on, based on the UV coordinate.
        float digitOffset = floor(uv.x);
        int digitOffsetInt = int(digitOffset);
        uv.x -= digitOffset;

        // Determine the number to display, based on which digit we are on.
        float number;
        for(int i = 0; i < ${DIGIT_LENGTH}; i++) {
          if (digitOffsetInt == i) {
            number = vDigits[int(i)];
          }
        }

        // If rendering outside the Y zone, discard this pixel.
        if (uv.y > 1.0) {
          discard;
        }

        // Adjust the UV to be offset and sized according to the numbers texture.
        vec2 textureUV = TEXTURE_GRID_SIZE_INVERSE * vec2(
          uv.x + mod(number, TEXTURE_GRID_SIZE),
          uv.y + floor(number * TEXTURE_GRID_SIZE_INVERSE)
        );
        vec4 textureColor = texture2D(numbersTexture, textureUV);
        gl_FragColor = vec4(color * textureColor.rgb, textureColor.a);
      }
    `,
    uniforms: {
      viewportHeight: regl.context('viewportHeight'),
      numbersTexture: regl.texture(createTexture()),
      model: (_, props) => (props && props.model) ? props.model : identity
    },
    primitive: 'points',
    depth: { enable: false },
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
    }
  })
}

function createDrawCellIndices (regl, quads, drawNumbers) {
  const centerPositions = quad.computeCenterPositions(quads)
  const digits = toDigits(centerPositions)

  const drawCells = regl({
    attributes: {
      position: centerPositions,
      digits: digits
    },
    uniforms: {
      fontHeight: (_, props) => (props && props.height) ? height : CELL_FONT_SIZE,
      color: (_, props) => (props && props.color) ? props.color : CELL_COLOR,
      model: (_, props) => (props && props.model) ? props.model : identity
    },
    count: centerPositions.length
  })

  return (props) => drawNumbers(() => drawCells(props))
}

function createDrawPositionIndices (regl, quads, drawNumbers) {
  const positions = quads.positions
  const digits = toDigits(positions)

  const drawPositions = regl({
    attributes: {
      position: positions,
      digits: digits
    },
    uniforms: {
      fontHeight: (_, props) => (props && props.height) ? props.height : POSITION_FONT_SIZE,
      color: (_, props) => (props && props.color) ? props.color : POSITION_COLOR,
      model: (_, props) => (props && props.model) ? props.model : identity
    },
    count: positions.length
  })

  return (props) => drawNumbers(() => drawPositions(props))
}

function toDigits (centers) {
  if (centers.length > 999) {
    throw new Error('This function only goes up to 999. Another digit needs to be added.')
  }
  const BLANK_DIGIT = 10
  return centers.map((_, cellIndex) => {
    let sum = 0
    let digits = []
    for (let i = 2; i >= 0; i--) {
      const zeros = Math.pow(10, i)
      const n = Math.floor((cellIndex - sum) / zeros)
      sum += n * zeros
      digits.push(n)
    }
    if (digits[0] === 0 && digits[1] === 0) {
      digits[1] = BLANK_DIGIT
    }
    if (digits[0] === 0) {
      digits[0] = BLANK_DIGIT
    }
    return digits
  })
}

function createTexture () {
  // Units of operation.
  const side = 256
  const row = 4
  const unit = side / row
  const unitHalf = unit / 2

  // Set up canvas and fonts.
  const canvas = document.createElement('canvas')
  canvas.width = side
  canvas.height = side
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, side, side)
  ctx.fillStyle = '#fff'
  ctx.font = `${Math.floor(1.2 * side / 4)}px sans-serif`
  const {width} = ctx.measureText('0')

  // Draw the numbers
  loop: for (let y = 0; y < row; y++) {
    for (let x = 0; x < row; x++) {
      const n = y * row + x
      if (n > 9) {
        break loop
      }
      ctx.fillText(n,
        x * unit + unitHalf - width / 2,
        y * unit + unitHalf + width * 0.6
      )
    }
  }

  // Draw debug grid, and append this to the DOM.
  // ctx.fillRect(0, unit * 1, side, 1)
  // ctx.fillRect(0, unit * 2, side, 1)
  // ctx.fillRect(0, unit * 3, side, 1)
  // ctx.fillRect(unit * 1, 0, 1, side)
  // ctx.fillRect(unit * 2, 0, 1, side)
  // ctx.fillRect(unit * 3, 0, 1, side)
  // document.body.appendChild(canvas)
  // canvas.style.position = 'absolute'
  // canvas.style.top = 0
  // canvas.style.bottom = 0

  return canvas
}
