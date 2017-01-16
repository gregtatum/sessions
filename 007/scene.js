const vec3 = require('gl-vec3')
const TAU = 6.283185307179586
const createCamera = require('perspective-camera')

module.exports = function (regl) {
  const camera = createCamera({
    fov: TAU * 0.1,
    near: 0.01,
    far: 100,
    position: [0, 0, 1]
  })

  camera.update()

  let prevTick
  function update (callback) {
    return ({tick, viewportWidth, viewportHeight}) => {
      if (tick !== prevTick) {
        camera.viewport[2] = viewportWidth
        camera.viewport[3] = viewportHeight
        camera.update()
        prevTick = tick
      }
      return callback.apply(null, arguments)
    }
  }

  return regl({
    uniforms: {
      projection: update(() => camera.projection),
      view: update(() => camera.view),
      light1: vec3.normalize([], [-1, 0.5, 0.3])
    }
  })
}
