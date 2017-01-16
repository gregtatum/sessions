const mat4 = require('gl-mat4')
const mat3 = require('gl-mat3')
const vec3 = require('gl-vec3')
const TAU = 6.283185307179586
const createControls = require('orbit-controls')
const createCamera = require('perspective-camera')
const simplex = new (require('simplex-noise'))()

module.exports = function (regl) {
  const camera = createCamera({
    fov: TAU * 0.1,
    near: 0.01,
    far: 10000,
    position: [0, 0, 1]
  })

  const controls = createControls({
    phi: TAU * 0.1,
    distanceBounds: [0.75, 3.25],
    zoomSpeed: 0,
    pinchSpeed: 0,
    rotateSpeed: 0,
    damping: 0.05,
    parent: regl._gl.canvas,
    element: regl._gl.canvas
  })

  controls.update()
  camera.update()

  const cameraPositionNoise = [0, 0, 0]
  const cameraDirectionNoise = [0, 0, 0]
  const cameraNoiseSize = 0.05

  let prevTick
  function update (callback) {
    return ({tick, viewportWidth, viewportHeight, time}) => {
      if (tick !== prevTick) {
        controls.theta += 1.5
        controls.update()
        controls.copyInto(camera.position, camera.direction, camera.up)
        // vec3.rotateY(camera.position, camera.position, [0, 0, 0], time * 0.1)
        camera.viewport[2] = viewportWidth
        camera.viewport[3] = viewportHeight
        cameraPositionNoise[0] = cameraNoiseSize * simplex.noise2D(time * 0.15, 0)
        cameraPositionNoise[1] = cameraNoiseSize * simplex.noise2D(0, time * 0.15)
        cameraPositionNoise[2] = cameraNoiseSize * simplex.noise2D(100, time * 0.15)
        cameraDirectionNoise[0] = 0.04 * simplex.noise2D(time * 0.13, -100)
        vec3.add(camera.position, camera.position, cameraPositionNoise)
        vec3.normalize(camera.direction,
          vec3.add(camera.direction, camera.direction, cameraDirectionNoise)
        )

        camera.update()
        prevTick = tick
      }
      return callback.apply(null, arguments)
    }
  }

  const view = []
  const eyeStart = [0, 0, 1]

  return regl({
    uniforms: {
      time: ({time}) => time,
      projection: update(() => camera.projection),
      view: (() => {
        const eye = []
        const center = [0, 0, 0]
        const up = [0, 1, 0]
        const tilt = []
        return ({time}) => {
          vec3.rotateY(eye, eyeStart, center, time * 0.1)
          vec3.rotateX(tilt, up, center, simplex.noise2D(100, time * 0.15))
          return mat4.lookAt(view, eye, cameraPositionNoise, tilt)
        }
      })(),
      invView: withArrays(1, ([out]) => mat4.invert(out, view)),
      light0: vec3.normalize([], [0.2, 0.4, -1]),
      light1: vec3.normalize([], [-0.2, 0.5, 1]),
      lightColor0: [1.0, 1.0, 1.0],
      lightColor1: [0.2, 0.3, 0.3],
      viewNormal: withArrays(1, ([out]) => mat3.normalFromMat4(out, camera.view))
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
