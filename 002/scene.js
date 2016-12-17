const mat4 = require('gl-mat4')

module.exports = function(regl) {
  const a1 = []
  const a2 = []
  const a3 = []
  const a4 = []

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
    view: mat4.lookAt(a4, [1, 0.5, 1], [0, 0, 0], [0, 1, 0])
  }
}
