const mat4 = require('gl-mat4')
const TAU = 6.283185307179586

module.exports = function (regl) {
  const a1 = []
  const a2 = []

  return {
    projection: ({viewportWidth, viewportHeight}) => (
      mat4.perspective(
        a1,
        TAU * 0.05,
        viewportWidth / viewportHeight,
        0.01,
        1000
      )
    ),
    view: mat4.lookAt(a2, [1, 0.5, 1], [0, 0, 0], [0, 1, 0])
  }
}
