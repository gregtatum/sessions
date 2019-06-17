const vec3 = require('gl-vec3')
const mat3 = require('gl-mat3')
const mat4 = require('gl-mat4')
const createControls = require('orbit-controls')
const createCamera = require('perspective-camera')
const simplex = new (require('simplex-noise'))()

const TAU = 6.283185307179586
const FOV = TAU * 0.1
const ORIGIN = [0, 0, 0]

module.exports = function (regl) {
  const position = [0, 0, 0.7]
  const camera = createCamera({
    fov: FOV,
    near: 0.01,
    far: 100,
    position
  })

  const controls = createControls({
    phi: Math.PI * 0.40,
    theta: 0.2,
    // thetaBounds: [0.1, 0.3],
    phiBounds: [Math.PI * 0.25, Math.PI * 0.50],
    position,
    zoomSpeed: 0,
    pinchSpeed: 0,
    rotateSpeed: 0.005,
    damping: 0.01,
    parent: regl._gl.canvas,
    element: regl._gl.canvas
  })

  camera.update()

  let prevTick
  function update (callback) {
    return ({time, tick, viewportWidth, viewportHeight}) => {
      if (tick !== prevTick) {
        controls.update()
        controls.copyInto(camera.position, camera.direction, camera.up)

        camera.position[0] += 0.01 * simplex.noise2D(time * 0.1, 0)
        camera.position[1] += 0.01 * simplex.noise2D(0, time * 0.1)
        camera.position[2] += 0.01 * simplex.noise2D(100, time * 0.1)

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
      view: () => camera.view,
      projView: () => camera.projView,
      inverseProjection: () => mat4.invert([], camera.projection),
      inverseView: () => mat4.invert([], camera.view),
      normalView: withArrays(1, ([out]) => mat3.normalFromMat4(out, camera.view)),
      projectionnormalView: withArrays(1, ([out]) => mat3.normalFromMat4(out, camera.projView)),
      light0: vec3.normalize([], [0, 1, 0.1]),
      light1: vec3.normalize([], [0.5, -1, 0.5]),
      light2: vec3.normalize([], [-0.5, 0.2, 0.8]),
      lightColor0: vec3.scale([], [1.0, 0.9, 0.9], 0.6 * 0),
      lightColor1: vec3.scale([], [0.8, 1.0, 1.0], 0.6 * 0),
      lightColor2: vec3.scale([], [0.8, 0.8, 1.0], 0.6 * 0),
      time: ({time}) => time,
      cameraPosition: () => camera.position
    },
    context: {
      fov: FOV
    }
  })
}

function withArrays (length, callback) {
  const arrays = []
  for (let i = 0; i < length; i++) {
    arrays.push([])
  }
  const args = [arrays]
  return (context, props) => {
    for (let i = 0; i < arguments.length; i++) {
      args[i + 1] = arguments[i]
    }
    return callback.apply(null, args)
  }
}
